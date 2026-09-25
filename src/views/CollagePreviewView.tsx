import React, { useState, useEffect } from 'react';
import { 
  Detail, 
  ActionPanel, 
  Action, 
  Icon, 
  Color, 
  showToast, 
  Toast, 
  closeMainWindow, 
  useNavigation,
  open 
} from '@raycast/api';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { exec } from 'child_process';
import { 
  stitchScreenshots, 
  copyImageFileToClipboard, 
  StitchOptions, 
  StitchResult 
} from '../utils/stitcher';
import { CollageSettingsForm } from './CollageSettingsForm';

interface CollagePreviewViewProps {
  initialImagePaths: string[];
}

export const CollagePreviewView: React.FC<CollagePreviewViewProps> = ({
  initialImagePaths,
}) => {
  const { push } = useNavigation();

  const [imagePaths, setImagePaths] = useState<string[]>(initialImagePaths);
  const [options, setOptions] = useState<StitchOptions>({
    layout: 'vertical',
    cropTop: 0,
    cropBottom: 0,
    cropLeft: 0,
    cropRight: 0,
    gap: 16,
    backgroundColor: 'slate',
    title: '',
    redactSensitive: false,
  });

  const [result, setResult] = useState<StitchResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(true);

  const generateCollage = async () => {
    setIsProcessing(true);
    try {
      const res = await stitchScreenshots(imagePaths, options);
      setResult(res);
    } catch (err: any) {
      showToast({
        style: Toast.Style.Failure,
        title: 'Erro ao gerar colagem',
        message: err.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    generateCollage();
  }, [imagePaths, options]);

  // Salvar no Downloads e Copiar
  const handleSaveAndCopy = async (alsoClose = true) => {
    if (!result) return;

    try {
      await showToast({
        style: Toast.Style.Animated,
        title: 'Salvando em Downloads...',
      });

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `fotoduo-${timestamp}.png`;
      const downloadsDir = path.join(os.homedir(), 'Downloads');
      const targetPath = path.join(downloadsDir, filename);

      await fs.promises.copyFile(result.filePath, targetPath);
      await copyImageFileToClipboard(targetPath);

      await showToast({
        style: Toast.Style.Success,
        title: 'Salvo em Downloads e Copiado!',
        message: `${filename} (${result.width}x${result.height}px)`,
      });

      if (alsoClose) {
        await closeMainWindow();
      }
    } catch (err: any) {
      showToast({
        style: Toast.Style.Failure,
        title: 'Erro ao salvar',
        message: err.message,
      });
    }
  };

  // Alternar layout vertical / horizontal
  const toggleLayout = () => {
    setOptions(prev => ({
      ...prev,
      layout: prev.layout === 'vertical' ? 'horizontal' : 'vertical',
    }));
  };

  // Inverter ordem dos prints
  const reverseOrder = () => {
    setImagePaths(prev => [...prev].reverse());
  };

  // Alternar corte de abas de navegador (-80px)
  const toggleCropBrowser = () => {
    setOptions(prev => ({
      ...prev,
      cropTop: prev.cropTop === 0 ? 80 : 0,
    }));
  };

  // Alternar corte de barra de tarefas (-48px)
  const toggleCropTaskbar = () => {
    setOptions(prev => ({
      ...prev,
      cropBottom: prev.cropBottom === 0 ? 48 : 0,
    }));
  };

  // Markdown para exibição nativa no Detail do Raycast
  const imageSrc = result?.dataUri || (result?.fileUri ? result.fileUri : result?.filePath ? `file:///${result.filePath.replace(/\\/g, '/')}` : '');

  const markdown = `
# 📸 Colagem Fotoduo (${imagePaths.length} ${imagePaths.length === 1 ? 'captura' : 'capturas'})

${
  isProcessing
    ? '⏳ *Processando imagem em resolução máxima 100% nativa...*'
    : imageSrc
    ? `![Pré-visualização da Colagem](${imageSrc})`
    : '❌ *Erro ao processar imagem*'
}

---
### 🛠️ Comandos de Edição no Raycast:
* **\`Ctrl + E\`**: **Personalizar tudo** (definir cortes exatos em pixels, digitar título, ativar tarja)
* **\`Ctrl + L\`**: Alternar entre **Empilhado (Vertical)** e **Lado a Lado (Horizontal)**
* **\`Ctrl + T\`**: Aparar **abas do navegador** no topo (-80px)
* **\`Ctrl + B\`**: Aparar **barra de tarefas** na base (-48px)
* **\`Ctrl + I\`**: Inverter ordem das capturas
* **\`Enter\`**: **Salvar no Downloads e Copiar** para o Clipboard
`;

  return (
    <Detail
      isLoading={isProcessing}
      markdown={markdown}
      metadata={
        result ? (
          <Detail.Metadata>
            <Detail.Metadata.Label
              title="Resolução Original"
              text={`${result.width} × ${result.height} px (100% Nativo)`}
              icon={Icon.Eye}
            />
            <Detail.Metadata.Label
              title="Tamanho do Arquivo"
              text={`${Math.round(result.sizeBytes / 1024)} KB`}
              icon={Icon.HardDrive}
            />
            <Detail.Metadata.Separator />
            <Detail.Metadata.Label
              title="Disposição"
              text={options.layout === 'vertical' ? '⬇️ Empilhado (Vertical)' : '➡️ Lado a Lado (Horizontal)'}
              icon={options.layout === 'vertical' ? Icon.ArrowDown : Icon.ArrowRight}
            />
            <Detail.Metadata.Label
              title="Corte Superior (Topo)"
              text={options.cropTop > 0 ? `-${options.cropTop} px (Abas cortadas)` : 'Sem corte'}
              icon={Icon.Crop}
            />
            <Detail.Metadata.Label
              title="Corte Inferior (Base)"
              text={options.cropBottom > 0 ? `-${options.cropBottom} px (Barra cortada)` : 'Sem corte'}
              icon={Icon.Crop}
            />
            <Detail.Metadata.Separator />
            <Detail.Metadata.Label
              title="Título da Imagem"
              text={options.title || 'Nenhum'}
              icon={Icon.Text}
            />
            <Detail.Metadata.Label
              title="Tarja de Privacidade"
              text={options.redactSensitive ? 'Ativa' : 'Desativada'}
              icon={Icon.Shield}
            />
            <Detail.Metadata.Separator />
            <Detail.Metadata.Label
              title="Editar Detalhes"
              text="Pressione Ctrl + E"
              icon={Icon.Pencil}
            />
            <Detail.Metadata.Label
              title="Girar / Aparar"
              text="Ctrl+L / Ctrl+T / Ctrl+B"
              icon={Icon.Keyboard}
            />
          </Detail.Metadata>
        ) : undefined
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section title="Exportação Rápida">
            <Action
              title="Salvar no Downloads e Copiar"
              icon={Icon.Download}
              onAction={() => handleSaveAndCopy(true)}
            />
            <Action
              title="Copiar para Área de Transferência"
              icon={Icon.CopyClipboard}
              shortcut={{ modifiers: ["ctrl"], key: "c" }}
              onAction={async () => {
                if (result) {
                  await copyImageFileToClipboard(result.filePath);
                  showToast({ style: Toast.Style.Success, title: 'Copiado para o Clipboard!' });
                }
              }}
            />
            <Action
              title="Salvar no Downloads (Sem Fechar)"
              icon={Icon.SaveDocument}
              shortcut={{ modifiers: ["ctrl"], key: "s" }}
              onAction={() => handleSaveAndCopy(false)}
            />
          </ActionPanel.Section>

          <ActionPanel.Section title="Ajustes Rápidos">
            <Action
              title={
                options.layout === 'vertical'
                  ? "Mudar para Lado a Lado (Horizontal)"
                  : "Mudar para Empilhado (Vertical)"
              }
              icon={options.layout === 'vertical' ? Icon.ArrowRight : Icon.ArrowDown}
              shortcut={{ modifiers: ["ctrl"], key: "l" }}
              onAction={toggleLayout}
            />
            <Action
              title="Inverter Ordem dos Prints"
              icon={Icon.Switch}
              shortcut={{ modifiers: ["ctrl"], key: "i" }}
              onAction={reverseOrder}
            />
            <Action
              title={options.cropTop > 0 ? "Restaurar Topo (Sem Corte)" : "Aparar Abas de Navegador (-80px Topo)"}
              icon={Icon.Crop}
              shortcut={{ modifiers: ["ctrl"], key: "t" }}
              onAction={toggleCropBrowser}
            />
            <Action
              title={options.cropBottom > 0 ? "Restaurar Base (Sem Corte)" : "Aparar Barra de Tarefas (-48px Base)"}
              icon={Icon.Crop}
              shortcut={{ modifiers: ["ctrl"], key: "b" }}
              onAction={toggleCropTaskbar}
            />
            <Action
              title="Personalizar Cortes, Título e Tarja..."
              icon={Icon.Pencil}
              shortcut={{ modifiers: ["ctrl"], key: "e" }}
              onAction={() => {
                push(
                  <CollageSettingsForm
                    currentOptions={options}
                    onApply={(newOpts) => setOptions(newOpts)}
                  />
                );
              }}
            />
          </ActionPanel.Section>

          <ActionPanel.Section title="Utilitários">
            <Action
              title="Abrir Pasta Downloads"
              icon={Icon.Folder}
              shortcut={{ modifiers: ["ctrl"], key: "d" }}
              onAction={() => open(path.join(os.homedir(), 'Downloads'))}
            />
            {result && (
              <Action
                title="Abrir Imagem Gerada"
                icon={Icon.Eye}
                shortcut={{ modifiers: ["ctrl"], key: "o" }}
                onAction={() => open(result.filePath)}
              />
            )}
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
};
