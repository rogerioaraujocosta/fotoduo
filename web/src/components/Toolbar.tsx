import React from 'react';
import { 
  Move, 
  Crop, 
  Type, 
  ShieldAlert, 
  Eraser, 
  ZoomIn, 
  ZoomOut, 
  Undo2, 
  Redo2, 
  Download, 
  Copy, 
  Images, 
  Maximize2,
  Trash2,
  Sun,
  Moon,
  Loader2
} from 'lucide-react';
import { ToolMode, ThemeMode } from '../types';

interface ToolbarProps {
  currentTool: ToolMode;
  onSelectTool: (tool: ToolMode) => void;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitToScreen: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onOpenDrawer: () => void;
  onSave: () => void;
  onCopyClipboard: () => void;
  isSaving: boolean;
  itemCount: number;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  onSelectTool,
  scale,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToScreen,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onOpenDrawer,
  onSave,
  onCopyClipboard,
  isSaving,
  itemCount,
  theme,
  onToggleTheme,
}) => {
  return (
    <header className="h-14 w-full bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 px-4 flex items-center justify-between z-30 select-none transition-colors shrink-0">
      {/* Esquerda: Logo minimalista, badge e botão de Prints */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold text-xs tracking-wider shadow-sm select-none">
            FD
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Fotoduo
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-zinc-700/80">
              Canvas
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

        <button
          onClick={onOpenDrawer}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs font-medium shadow-sm transition-all active:scale-[0.98]"
          title="Ver capturas recentes do Windows e do Raycast para adicionar à lousa"
        >
          <Images className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
          <span>Capturas Recentes</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </button>
      </div>

      {/* Centro: Segmented Control / Pill de Ferramentas */}
      <div className="flex items-center bg-zinc-100/90 dark:bg-zinc-900/90 p-1 rounded-lg border border-zinc-200/80 dark:border-zinc-800 gap-0.5 shadow-xs">
        <button
          onClick={() => onSelectTool('select')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
            currentTool === 'select'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 shadow-sm font-medium'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-white/50 dark:hover:bg-zinc-800/50'
          }`}
          title="Mover e Redimensionar elementos (V)"
        >
          <Move className="w-3.5 h-3.5" />
          <span>Mover</span>
          <kbd className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono ml-0.5 font-normal">V</kbd>
        </button>

        <button
          onClick={() => onSelectTool('crop')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
            currentTool === 'crop'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 shadow-sm font-medium'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-white/50 dark:hover:bg-zinc-800/50'
          }`}
          title="Cortar extremidades das imagens (C)"
        >
          <Crop className="w-3.5 h-3.5" />
          <span>Cortar</span>
          <kbd className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono ml-0.5 font-normal">C</kbd>
        </button>

        <button
          onClick={() => onSelectTool('redact-box')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
            currentTool === 'redact-box'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 shadow-sm font-medium'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-white/50 dark:hover:bg-zinc-800/50'
          }`}
          title="Tarja de privacidade para ocultar dados (B)"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Tarja</span>
          <kbd className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono ml-0.5 font-normal">B</kbd>
        </button>

        <button
          onClick={() => onSelectTool('redact-brush')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
            currentTool === 'redact-brush'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 shadow-sm font-medium'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-white/50 dark:hover:bg-zinc-800/50'
          }`}
          title="Borracha livre estilo pincel (E)"
        >
          <Eraser className="w-3.5 h-3.5" />
          <span>Borracha</span>
          <kbd className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono ml-0.5 font-normal">E</kbd>
        </button>

        <button
          onClick={() => onSelectTool('text')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
            currentTool === 'text'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 shadow-sm font-medium'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-white/50 dark:hover:bg-zinc-800/50'
          }`}
          title="Adicionar texto livre na lousa (T)"
        >
          <Type className="w-3.5 h-3.5" />
          <span>Texto</span>
          <kbd className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono ml-0.5 font-normal">T</kbd>
        </button>
      </div>

      {/* Direita: Zoom, Histórico, Tema e Salvamento */}
      <div className="flex items-center gap-2">
        {/* Controles de Zoom em Pill minimalista */}
        <div className="inline-flex items-center bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 rounded-lg p-0.5 text-xs shadow-xs">
          <button
            onClick={onZoomOut}
            className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-800 rounded-md transition"
            title="Reduzir Zoom (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onResetZoom}
            className="px-2 py-1 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-800 font-mono text-[11px] rounded-md transition"
            title="Redefinir Zoom para 100%"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={onZoomIn}
            className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-800 rounded-md transition"
            title="Aumentar Zoom (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3.5 bg-zinc-200 dark:bg-zinc-800 mx-0.5" />
          <button
            onClick={onFitToScreen}
            className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-800 rounded-md transition"
            title="Ajustar elementos à tela"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Desfazer / Refazer / Limpar */}
        <div className="flex items-center gap-0.5 border-l border-zinc-200 dark:border-zinc-800 pl-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-md transition disabled:opacity-30 disabled:pointer-events-none"
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-md transition disabled:opacity-30 disabled:pointer-events-none"
            title="Refazer (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClear}
            disabled={itemCount === 0}
            className="p-1.5 text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md transition disabled:opacity-30 disabled:pointer-events-none"
            title="Limpar toda a lousa"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Alternador de Tema Claro / Escuro */}
        <div className="border-l border-zinc-200 dark:border-zinc-800 pl-2">
          <button
            onClick={onToggleTheme}
            className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition shadow-xs"
            title={theme === 'light' ? 'Mudar para Modo Escuro' : 'Mudar para Modo Claro'}
            aria-label="Alternar tema"
          >
            {theme === 'light' ? (
              <Moon className="w-3.5 h-3.5 transition-transform hover:-rotate-12" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-400 transition-transform hover:rotate-45" />
            )}
          </button>
        </div>

        {/* Ações de Exportação */}
        <div className="flex items-center gap-1.5 border-l border-zinc-200 dark:border-zinc-800 pl-2">
          <button
            onClick={onCopyClipboard}
            disabled={itemCount === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs font-medium shadow-xs transition active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
            title="Copiar imagem final para a Área de Transferência (Ctrl+C)"
          >
            <Copy className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>Copiar</span>
          </button>

          <button
            onClick={onSave}
            disabled={itemCount === 0 || isSaving}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 text-white text-xs font-medium shadow-sm transition active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
            title="Salvar imagem em alta resolução diretamente na pasta Downloads (Ctrl+S)"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{isSaving ? 'Salvando...' : 'Salvar no Downloads'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
