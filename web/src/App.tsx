import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Layers, Images } from 'lucide-react';
import { Toolbar } from './components/Toolbar';
import { CanvasStage } from './components/CanvasStage';
import { RecentScreenshotsDrawer } from './components/RecentScreenshotsDrawer';
import { Toast } from './components/Toast';
import { 
  CanvasItem, 
  CanvasImageItem, 
  ToolMode, 
  ThemeMode,
  ScreenshotMetadata, 
  ToastMessage 
} from './types';
import { exportCanvasToImage } from './utils/exporter';

export const App: React.FC = () => {
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolMode>('select');
  const [scale, setScale] = useState<number>(1.0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Gerenciamento de tema Claro / Escuro (Padrão: Claro, com persistência)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('fotoduo-theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('fotoduo-theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // Histórico para Desfazer / Refazer
  const [history, setHistory] = useState<CanvasItem[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoRef = useRef(false);

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Atualizar itens e registrar histórico
  const handleUpdateItems = useCallback((newItems: CanvasItem[], recordHistory = true) => {
    setItems(newItems);

    if (recordHistory && !isUndoRedoRef.current) {
      setHistory(prev => {
        const next = prev.slice(0, historyIndex + 1);
        return [...next, newItems];
      });
      setHistoryIndex(prev => prev + 1);
    }
  }, [historyIndex]);

  // Desfazer (Ctrl+Z)
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoRef.current = true;
      const targetIndex = historyIndex - 1;
      setHistoryIndex(targetIndex);
      setItems(history[targetIndex]);
      setTimeout(() => { isUndoRedoRef.current = false; }, 0);
    }
  }, [history, historyIndex]);

  // Refazer (Ctrl+Y ou Ctrl+Shift+Z)
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoRef.current = true;
      const targetIndex = historyIndex + 1;
      setHistoryIndex(targetIndex);
      setItems(history[targetIndex]);
      setTimeout(() => { isUndoRedoRef.current = false; }, 0);
    }
  }, [history, historyIndex]);

  // Limpar lousa
  const handleClear = () => {
    if (items.length === 0) return;
    if (window.confirm('Deseja limpar todos os elementos da lousa?')) {
      handleUpdateItems([]);
      setSelectedId(null);
      addToast({
        type: 'info',
        title: 'Lousa limpa',
        description: 'Você pode adicionar novos prints a qualquer momento.',
      });
    }
  };

  // Carregar imagens enviadas pela URL inicial (vindo do Raycast)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawImages = params.get('images');
    if (rawImages) {
      try {
        const parsed: string[] = JSON.parse(decodeURIComponent(rawImages));
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadImagesFromPaths(parsed);
        }
      } catch (err) {
        console.error('Falha ao decodificar imagens da URL', err);
      }
    } else {
      // Se abriu vazio, abre o painel de capturas recentes para conveniência
      setIsDrawerOpen(true);
    }
  }, []);

  const loadImagesFromPaths = async (paths: string[]) => {
    const newItems: CanvasItem[] = [];
    let currentX = 60;

    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      const imageUrl = `/api/image?path=${encodeURIComponent(p)}`;

      try {
        const dimensions = await getImageDimensions(imageUrl);
        const item: CanvasImageItem = {
          id: `image-${Date.now()}-${i}`,
          type: 'image',
          src: imageUrl,
          originalPath: p,
          x: currentX,
          y: 60,
          width: dimensions.width,
          height: dimensions.height,
          naturalWidth: dimensions.width,
          naturalHeight: dimensions.height,
          crop: { top: 0, right: 0, bottom: 0, left: 0 },
          zIndex: i + 1,
        };
        newItems.push(item);
        currentX += dimensions.width + 30;
      } catch (err) {
        console.error('Falha ao carregar', p, err);
      }
    }

    if (newItems.length > 0) {
      handleUpdateItems(newItems);
      addToast({
        type: 'success',
        title: `${newItems.length} ${newItems.length === 1 ? 'print carregado' : 'prints carregados'}!`,
        description: 'Mova, recorte e ajuste os detalhes na lousa.',
      });
    }
  };

  const getImageDimensions = (src: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = src;
    });
  };

  // Adicionar capturas selecionadas na gaveta
  const handleAddFromDrawer = async (screenshots: ScreenshotMetadata[]) => {
    const newItems: CanvasItem[] = [...items];
    let startX = 60;
    if (items.length > 0) {
      const maxX = Math.max(...items.map(i => i.x + (i.width || 0)));
      startX = maxX + 30;
    }

    for (let i = 0; i < screenshots.length; i++) {
      const sc = screenshots[i];
      const imageUrl = `/api/image?path=${encodeURIComponent(sc.path)}`;
      try {
        const dimensions = await getImageDimensions(imageUrl);
        const item: CanvasImageItem = {
          id: `image-${Date.now()}-${i}`,
          type: 'image',
          src: imageUrl,
          originalPath: sc.path,
          x: startX,
          y: 60,
          width: dimensions.width,
          height: dimensions.height,
          naturalWidth: dimensions.width,
          naturalHeight: dimensions.height,
          crop: { top: 0, right: 0, bottom: 0, left: 0 },
          zIndex: newItems.length + 1,
        };
        newItems.push(item);
        startX += dimensions.width + 30;
      } catch (e) {
        console.error('Erro ao adicionar print', e);
      }
    }

    handleUpdateItems(newItems);
    addToast({
      type: 'success',
      title: `${screenshots.length} ${screenshots.length === 1 ? 'print adicionado' : 'prints adicionados'} à lousa!`,
    });
  };

  // Salvar no Downloads
  const handleSave = async () => {
    if (items.length === 0) return;
    setIsSaving(true);

    try {
      const exported = await exportCanvasToImage(items);
      if (!exported) {
        throw new Error('Não foi possível gerar a imagem.');
      }

      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataUrl: exported.dataUrl,
          copyToClipboard: false,
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao gravar arquivo em Downloads');
      }

      const data = await res.json();

      addToast({
        type: 'success',
        title: 'Colagem salva em Downloads!',
        description: `Arquivo salvo com resolução ${exported.width}x${exported.height}px em: ${data.filename}`,
        actionLabel: 'Abrir no Explorer',
        onAction: () => {
          fetch('/api/reveal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: data.filePath }),
          });
        },
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Erro ao salvar',
        description: err.message || 'Verifique o servidor local',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Copiar diretamente para a área de transferência
  const handleCopyClipboard = async () => {
    if (items.length === 0) return;

    try {
      const exported = await exportCanvasToImage(items);
      if (!exported) return;

      let copiedInBrowser = false;

      // 1. Tentar Clipboard API nativa do navegador (100% silenciosa, sem janelas ou processos externos)
      if (navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': exported.blob }),
          ]);
          copiedInBrowser = true;
        } catch (clipErr) {
          console.warn('Clipboard API do navegador indisponível, usando ponte silenciosa', clipErr);
        }
      }

      // 2. Se a API do navegador não conseguiu (ex: falta de foco), usa o endpoint dedicado silencioso
      if (!copiedInBrowser) {
        await fetch('/api/copy-clipboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataUrl: exported.dataUrl,
          }),
        });
      }

      addToast({
        type: 'success',
        title: 'Copiado para a Área de Transferência!',
        description: 'Você pode colar diretamente com Ctrl + V no WhatsApp, Slack ou Figma.',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Erro ao copiar',
        description: err.message,
      });
    }
  };

  // Ajustar à tela
  const handleFitToScreen = () => {
    if (items.length === 0) {
      setScale(1.0);
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const item of items) {
      minX = Math.min(minX, item.x);
      minY = Math.min(minY, item.y);
      maxX = Math.max(maxX, item.x + (item.width || 0));
      maxY = Math.max(maxY, item.y + (item.height || 0));
    }

    const contentW = maxX - minX;
    const contentH = maxY - minY;

    const availableW = window.innerWidth - 120;
    const availableH = window.innerHeight - 160;

    const scaleX = availableW / contentW;
    const scaleY = availableH / contentH;
    const bestScale = Math.min(scaleX, scaleY, 1.0);

    setScale(Math.max(0.1, bestScale));
  };

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 transition-colors">
      <Toolbar
        currentTool={currentTool}
        onSelectTool={setCurrentTool}
        scale={scale}
        onZoomIn={() => setScale(s => Math.min(s * 1.15, 5.0))}
        onZoomOut={() => setScale(s => Math.max(s / 1.15, 0.1))}
        onResetZoom={() => setScale(1.0)}
        onFitToScreen={handleFitToScreen}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onSave={handleSave}
        onCopyClipboard={handleCopyClipboard}
        isSaving={isSaving}
        itemCount={items.length}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <main className="flex-1 relative flex overflow-hidden">
        <CanvasStage
          items={items}
          onChangeItems={handleUpdateItems}
          selectedId={selectedId}
          onSelectId={setSelectedId}
          currentTool={currentTool}
          onSetTool={setCurrentTool}
          scale={scale}
          onScaleChange={setScale}
          onSave={handleSave}
          theme={theme}
        />

        {/* Empty State Elegante inspirado no shadcn/ui */}
        {items.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none z-10">
            <div className="pointer-events-auto max-w-sm w-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-7 text-center shadow-xl shadow-zinc-950/5 dark:shadow-black/40 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center justify-center text-zinc-900 dark:text-zinc-100 shadow-xs">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Sua lousa está pronta
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                Adicione capturas de tela recentes do Windows, cole com Ctrl+V ou faça edições livremente.
              </p>

              <div className="mt-5 flex flex-col gap-2">
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 text-white font-medium text-xs shadow-xs transition active:scale-[0.98]"
                >
                  <Images className="w-4 h-4" />
                  <span>Ver Capturas Recentes</span>
                </button>
              </div>

              <div className="mt-5 pt-4 border-t border-zinc-200/70 dark:border-zinc-800/80 flex items-center justify-center gap-3 text-[11px] text-zinc-400 dark:text-zinc-500">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-mono text-[10px]">Ctrl+V</kbd> Colar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-mono text-[10px]">Win+Shift+S</kbd> Novo print
                </span>
              </div>
            </div>
          </div>
        )}

        <RecentScreenshotsDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onAddImages={handleAddFromDrawer}
        />
      </main>

      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};

export default App;
