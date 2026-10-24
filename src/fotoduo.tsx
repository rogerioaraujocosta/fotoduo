import React, { useState, useEffect, useRef } from 'react';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, ChildProcess } from 'child_process';
import { 
  Grid, 
  ActionPanel, 
  Action, 
  Icon, 
  Color, 
  showToast, 
  Toast, 
  closeMainWindow,
  showHUD
} from '@raycast/api';
import { getAllScreenshotsWithClipboard, getRecentScreenshots, ScreenshotFile, getClipboardHelperExe } from './utils/scanner';
import { launchFotoduoWindow } from './utils/launcher';
import { detectExplorerFolder, saveImagesToFolder, ExplorerDetection, ExplorerFolder } from './utils/explorer';

function truncate(str: string, maxLen: number): string {
  if (!str) return '';
  return str.length <= maxLen ? str : str.slice(0, maxLen - 1) + '…';
}

const logDebug = (msg: string) => {
  try {
    const logPath = path.join(os.tmpdir(), 'fotoduo-debug.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
};

export default function Command() {
  const [screenshots, setScreenshots] = useState<ScreenshotFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [explorer, setExplorer] = useState<ExplorerDetection | null>(null);

  const isInitialMountRef = useRef<boolean>(true);
  const focusedItemIdRef = useRef<string | null>(null);
  const lastClickTimeRef = useRef<number>(0);
  const clickHandledTimeRef = useRef<number>(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadScreenshots = async () => {
    try {
      const { items } = await getAllScreenshotsWithClipboard(10);
      setScreenshots(prev => {
        if (
          prev.length === items.length &&
          prev.every((it, idx) => it.id === items[idx].id && it.name === items[idx].name)
        ) {
          return prev;
        }
        return items;
      });
    } catch (err: any) {
      logDebug(`loadScreenshots erro: ${err?.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 1. Carrega imediatamente fotos do disco (0ms)
    try {
      const initial = getRecentScreenshots(10);
      if (initial.length > 0) {
        setScreenshots(initial);
        setIsLoading(false);
      }
    } catch {}

    // 2. Busca imediatamente da área de transferência
    loadScreenshots();

    if (process.platform === 'win32') {
      detectExplorerFolder().then(setExplorer);
    }

    // 3. Monitora a cada 2s para detectar novas imagens copiadas (WhatsApp, navegador, etc.)
    const interval = setInterval(() => {
      loadScreenshots();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Monitor de cliques nativos no Raycast:
  // Garante que o clique na primeira imagem (ou em itens já focados) seja sempre capturado e alternado instantaneamente
  useEffect(() => {
    let child: ChildProcess | null = null;
    try {
      const helperExe = getClipboardHelperExe();
      if (fs.existsSync(helperExe)) {
        child = spawn(helperExe, ['-watch-clicks'], {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'ignore'],
        });

        child.stdout?.on('data', (data: Buffer) => {
          const text = data.toString();
          if (text.includes('CLICK')) {
            const now = Date.now();
            lastClickTimeRef.current = now;
            loadScreenshots();

            if (clickTimeoutRef.current) {
              clearTimeout(clickTimeoutRef.current);
            }

            // Se o usuário clicou no item que já estava focado (ex: Item 0 logo na abertura),
            // o Raycast não dispara onSelectionChange (pois o índice não mudou).
            // Aguardamos 75ms: se onSelectionChange não tratou, alternamos o item atualmente focado.
            clickTimeoutRef.current = setTimeout(() => {
              if (clickHandledTimeRef.current < now) {
                if (focusedItemIdRef.current) {
                  logDebug(`ClickWatcher: alternando item focado ${focusedItemIdRef.current}`);
                  toggleSelect(focusedItemIdRef.current);
                }
              }
            }, 75);
          }
        });

        child.on('error', (err) => {
          logDebug(`ClickWatcher erro no processo: ${err.message}`);
        });
      }
    } catch (err: any) {
      logDebug(`ClickWatcher falha ao iniciar: ${err?.message}`);
    }

    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
      if (child) {
        try {
          child.kill();
        } catch {}
      }
    };
  }, []);

  const toggleSelect = (id: string) => {
    logDebug(`toggleSelect called for ${id}`);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(screenshots.map(s => s.id)));
    showToast({
      style: Toast.Style.Success,
      title: 'Todas as fotos selecionadas',
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleOpenLousa = async (paths?: string[]) => {
    let targetPaths = paths;
    if (!targetPaths || targetPaths.length === 0) {
      targetPaths = screenshots
        .filter(s => selectedIds.has(s.id))
        .map(s => s.path);
    }

    if (!targetPaths || targetPaths.length === 0) {
      showToast({
        style: Toast.Style.Failure,
        title: 'Nenhuma foto selecionada',
        message: 'Clique ou pressione Espaço em pelo menos uma foto antes de abrir a lousa.',
      });
      return;
    }

    await showToast({
      style: Toast.Style.Animated,
      title: 'Abrindo Lousa Fotoduo...',
      message: `${targetPaths.length} fotos enviadas para o Canvas`,
    });

    try {
      await launchFotoduoWindow(targetPaths);
      await closeMainWindow();
    } catch (err: any) {
      showToast({
        style: Toast.Style.Failure,
        title: 'Erro ao abrir a lousa',
        message: err.message,
      });
    }
  };

  const handleSaveToFolder = async (targetItems: ScreenshotFile[], forcedFolder?: ExplorerFolder) => {
    if (!targetItems || targetItems.length === 0) {
      showToast({
        style: Toast.Style.Failure,
        title: 'Nenhuma foto selecionada',
        message: 'Clique ou pressione Espaço em pelo menos uma foto antes de salvar.',
      });
      return;
    }

    const det = forcedFolder ? null : await detectExplorerFolder();
    if (det) {
      setExplorer(det);
    }

    const folder = forcedFolder ?? det?.folder ?? explorer?.folder;

    if (!folder) {
      const candidates = det?.candidates ?? explorer?.candidates ?? [];
      if (candidates.length === 0) {
        showToast({
          style: Toast.Style.Failure,
          title: 'Nenhuma pasta do Explorer aberta',
          message: 'Abra a pasta de destino no Windows Explorer e tente novamente.',
        });
        return;
      } else {
        showToast({
          style: Toast.Style.Failure,
          title: 'Várias pastas abertas',
          message: "Use a opção 'Salvar em Outra Pasta Aberta…' (Ctrl+Shift+S) para escolher.",
        });
        return;
      }
    }

    if (!folder.isFileSystem) {
      showToast({
        style: Toast.Style.Failure,
        title: 'Pasta não suportada',
        message: `"${folder.name}" não é uma pasta do disco. Abra uma pasta real no Explorer.`,
      });
      return;
    }

    try {
      const result = saveImagesToFolder(targetItems, folder.path);

      if (result.errors.length === 0 && result.saved.length > 0) {
        clearSelection();
        const count = result.saved.length;
        const msg = `✔ ${count} ${count === 1 ? 'imagem salva' : 'imagens salvas'} em ${folder.name}`;
        await showHUD(msg);
      } else if (result.saved.length > 0) {
        clearSelection();
        showToast({
          style: Toast.Style.Success,
          title: 'Fotos salvas parcialmente',
          message: `${result.saved.length} salvas, ${result.skipped.length} ignoradas, ${result.errors.length} erro(s): ${result.errors[0]?.message}`,
        });
      } else if (result.skipped.length > 0 && result.errors.length === 0) {
        showToast({
          style: Toast.Style.Animated,
          title: 'Arquivos já estão nesta pasta',
          message: 'As imagens selecionadas já se encontram na pasta de destino.',
        });
      } else {
        showToast({
          style: Toast.Style.Failure,
          title: 'Erro ao salvar fotos',
          message: result.errors[0]?.message || 'Não foi possível salvar os arquivos.',
        });
      }
    } catch (err: any) {
      showToast({
        style: Toast.Style.Failure,
        title: 'Erro inesperado ao salvar',
        message: err.message,
      });
    }
  };

  const handleSelectionChange = (id: string | null) => {
    logDebug(`handleSelectionChange: id=${id}`);
    if (!id) return;

    focusedItemIdRef.current = id;

    // Na inicialização, o Raycast foca automaticamente o Item 0 e dispara onSelectionChange.
    // Ignoramos essa primeira chamada automática para que nenhuma imagem comece selecionada.
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      logDebug(`handleSelectionChange: ignorado foco automático inicial em ${id}`);
      return;
    }

    const now = Date.now();
    // Se houve clique do mouse nos últimos 250ms, esta mudança foi disparada por clique!
    const wasMouseClick = (now - lastClickTimeRef.current) < 250;

    if (wasMouseClick) {
      logDebug(`handleSelectionChange: clique do mouse em ${id}`);
      clickHandledTimeRef.current = now;
      toggleSelect(id);
    } else {
      logDebug(`handleSelectionChange: navegação via teclado para ${id}`);
      // Navegação por setas do teclado: atualiza o item focado sem alternar seleção (seleciona com Espaço)
    }
  };

  const selectedCount = selectedIds.size;
  const selectedItems = screenshots.filter(s => selectedIds.has(s.id));

  const searchPlaceholder = selectedCount > 0
    ? `${selectedCount} ${selectedCount === 1 ? 'print selecionado' : 'prints selecionados'} • Espaço para marcar • Enter Lousa • Ctrl+S Salvar na pasta`
    : 'Clique na foto ou use Espaço • Enter Lousa • Ctrl+S Salvar na pasta';

  const refreshAll = () => {
    loadScreenshots();
    if (process.platform === 'win32') {
      detectExplorerFolder().then(setExplorer);
    }
  };

  return (
    <Grid
      columns={3}
      inset={Grid.Inset.Large}
      isLoading={isLoading}
      searchBarPlaceholder={searchPlaceholder}
      onSelectionChange={handleSelectionChange}
    >
      <Grid.EmptyView
        icon={Icon.Camera}
        title="Nenhuma captura recente encontrada"
        description="Tire um print com Win + Shift + S e pressione Ctrl + R para atualizar."
        actions={
          <ActionPanel>
            <Action
              title="Atualizar Lista"
              icon={Icon.ArrowClockwise}
              onAction={refreshAll}
            />
          </ActionPanel>
        }
      />

      {screenshots.map((item, index) => {
        const isSelected = selectedIds.has(item.id);
        const targetFiles = selectedCount > 0 ? selectedItems : [item];
        const qtdLabel = selectedCount > 0
          ? `${selectedCount} ${selectedCount === 1 ? 'Foto' : 'Fotos'}`
          : 'Foto';

        return (
          <Grid.Item
            key={item.id}
            id={item.id}
            content={item.path}
            title={`${index + 1}. ${item.name}`}
            subtitle={item.dateFormatted}
            accessory={
              isSelected
                ? {
                    icon: { source: Icon.CheckCircle, tintColor: Color.Blue },
                    tooltip: 'Selecionado para a lousa (Clique ou Espaço para desmarcar)',
                  }
                : {
                    icon: { source: Icon.Circle, tintColor: Color.SecondaryText },
                    tooltip: 'Clique ou pressione Espaço para selecionar',
                  }
            }
            actions={
              <ActionPanel>
                {/* 1. AÇÃO PRINCIPAL DIRETAMENTE NA BARRA PRINCIPAL (ENTER / CLIQUE DO MOUSE): ABRIR NA LOUSA */}
                <Action
                  title={
                    selectedCount > 0 
                      ? `Abrir ${selectedCount} ${selectedCount === 1 ? 'Foto' : 'Fotos'} na Lousa Fotoduo` 
                      : "Abrir Foto na Lousa Fotoduo"
                  }
                  icon={Icon.Window}
                  onAction={() => handleOpenLousa(selectedCount > 0 ? undefined : [item.path])}
                />

                {/* 2. SALVAR NA PASTA DO WINDOWS EXPLORER (CTRL + S) */}
                {process.platform === 'win32' && (
                  <>
                    <Action
                      title={
                        explorer?.folder
                          ? `Salvar ${qtdLabel} na Pasta "${truncate(explorer.folder.name, 28)}"`
                          : `Salvar ${qtdLabel} na Pasta Aberta do Explorer`
                      }
                      icon={Icon.SaveDocument}
                      shortcut={{ modifiers: ["ctrl"], key: "s" }}
                      onAction={() => handleSaveToFolder(targetFiles)}
                    />

                    <ActionPanel.Submenu
                      title="Salvar em Outra Pasta Aberta…"
                      icon={Icon.Folder}
                      shortcut={{ modifiers: ["ctrl", "shift"], key: "s" }}
                      onOpen={() => detectExplorerFolder().then(setExplorer)}
                    >
                      {(explorer?.candidates ?? []).filter(c => c.isFileSystem).map(c => (
                        <Action
                          key={c.path}
                          title={c.name}
                          icon={Icon.Folder}
                          onAction={() => handleSaveToFolder(targetFiles, c)}
                        />
                      ))}
                    </ActionPanel.Submenu>
                  </>
                )}

                {/* 3. ALTERNAR SELEÇÃO VIA TECLADO COM BARRA DE ESPAÇO */}
                <Action
                  title={isSelected ? "Desmarcar este Print (Espaço)" : "Marcar este Print (Espaço)"}
                  icon={isSelected ? Icon.Circle : Icon.CheckCircle}
                  shortcut={{ modifiers: [], key: "space" }}
                  onAction={() => toggleSelect(item.id)}
                />

                <ActionPanel.Section title="Mais Opções">
                  <Action
                    title="Selecionar Todas as 10 Fotos"
                    icon={Icon.CheckCircle}
                    shortcut={{ modifiers: ["ctrl"], key: "a" }}
                    onAction={selectAll}
                  />
                  <Action
                    title="Limpar Seleção"
                    icon={Icon.XmarkCircle}
                    shortcut={{ modifiers: ["ctrl", "shift"], key: "a" }}
                    onAction={clearSelection}
                  />
                  <Action
                    title="Atualizar Lista"
                    icon={Icon.ArrowClockwise}
                    shortcut={{ modifiers: ["ctrl"], key: "r" }}
                    onAction={refreshAll}
                  />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        );
      })}
    </Grid>
  );
}
