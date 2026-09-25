import React, { useState, useEffect } from 'react';
import { 
  X, 
  RefreshCw, 
  Check, 
  Plus, 
  Image as ImageIcon,
  CheckSquare2,
  Square
} from 'lucide-react';
import { ScreenshotMetadata } from '../types';

interface RecentScreenshotsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddImages: (screenshots: ScreenshotMetadata[]) => void;
}

export const RecentScreenshotsDrawer: React.FC<RecentScreenshotsDrawerProps> = ({
  isOpen,
  onClose,
  onAddImages,
}) => {
  const [screenshots, setScreenshots] = useState<ScreenshotMetadata[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScreenshots = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/screenshots?limit=50');
      if (!res.ok) throw new Error('Não foi possível carregar as capturas');
      const data = await res.json();
      setScreenshots(data.screenshots || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchScreenshots();
    }
  }, [isOpen]);

  // Fechar com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const toggleSelect = (id: string) => {
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
    if (selectedIds.size === screenshots.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(screenshots.map(s => s.id)));
    }
  };

  const handleConfirm = () => {
    const selected = screenshots.filter(s => selectedIds.has(s.id));
    if (selected.length > 0) {
      onAddImages(selected);
      setSelectedIds(new Set());
      onClose();
    }
  };

  const handleAddSingle = (item: ScreenshotMetadata) => {
    onAddImages([item]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity duration-200">
      {/* Backdrop para fechar ao clicar fora */}
      <div className="flex-1" onClick={onClose} />

      {/* Sheet Panel estilo shadcn */}
      <div className="w-[430px] max-w-full h-full bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 flex flex-col shadow-2xl transition-colors animate-in slide-in-from-right duration-200">
        {/* Header do Drawer */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                <span>Capturas Recentes</span>
              </h2>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                {screenshots.length}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Escolha as imagens que deseja colocar na lousa
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={fetchScreenshots}
              disabled={isLoading}
              className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              title="Atualizar lista de prints"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              title="Fechar (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Barra de Ações Rápidas */}
        <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between text-xs">
          <button
            onClick={selectAll}
            className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition font-medium"
          >
            {selectedIds.size === screenshots.length && screenshots.length > 0 ? (
              <CheckSquare2 className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
            ) : (
              <Square className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
            )}
            <span>Marcar Todos ({selectedIds.size}/{screenshots.length})</span>
          </button>

          {selectedIds.size > 0 && (
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 underline text-xs"
            >
              Desmarcar todos
            </button>
          )}
        </div>

        {/* Lista de Capturas em Grade */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading && screenshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-400 text-xs gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-zinc-500" />
              <span>Buscando capturas recentes...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg text-rose-700 dark:text-rose-300 text-xs">
              <p className="font-semibold mb-1">Erro ao listar capturas</p>
              <p>{error}</p>
            </div>
          ) : screenshots.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 dark:text-zinc-400 text-xs space-y-2">
              <p className="font-medium text-zinc-700 dark:text-zinc-300">Nenhum print recente encontrado.</p>
              <p>Capture a tela com <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono">Win + Shift + S</kbd> e clique em Atualizar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {screenshots.map(item => {
                const isSelected = selectedIds.has(item.id);
                const thumbUrl = `/api/image?path=${encodeURIComponent(item.path)}`;

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleSelect(item.id)}
                    className={`group relative rounded-lg border overflow-hidden cursor-pointer transition-all bg-zinc-50/50 dark:bg-zinc-900/40 ${
                      isSelected
                        ? 'border-zinc-900 dark:border-zinc-100 ring-2 ring-zinc-900/10 dark:ring-zinc-100/20 shadow-sm'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs'
                    }`}
                  >
                    {/* Imagem do Print */}
                    <div className="aspect-video bg-zinc-100 dark:bg-zinc-900 overflow-hidden relative">
                      <img
                        src={thumbUrl}
                        alt={item.name}
                        className="w-full h-full object-cover object-top transition duration-200 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />

                      {/* Checkbox de seleção customizado */}
                      <div className="absolute top-2 left-2 z-10">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center transition-colors text-[10px] ${
                            isSelected
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                              : 'bg-white/80 dark:bg-zinc-900/80 border border-zinc-300 dark:border-zinc-700 text-transparent group-hover:border-zinc-500'
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      </div>

                      {/* Ação rápida para adicionar imediatamente */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddSingle(item);
                        }}
                        className="absolute bottom-2 right-2 p-1.5 rounded-md bg-zinc-900/90 text-white dark:bg-zinc-100/90 dark:text-zinc-900 opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-100 shadow-sm text-xs flex items-center gap-1"
                        title="Adicionar à lousa agora"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Metadados */}
                    <div className="p-2 text-[11px]">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate" title={item.name}>
                        {item.name}
                      </p>
                      <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500 text-[10px] mt-0.5 font-mono">
                        <span>{item.dateFormatted}</span>
                        <span>{Math.round(item.size / 1024)} KB</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé com Botão de Confirmação primário shadcn */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur">
          <button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            className="w-full py-2.5 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 text-white font-medium text-xs transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.99]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {selectedIds.size > 0
                ? `Adicionar à Lousa (${selectedIds.size} ${selectedIds.size === 1 ? 'print' : 'prints'})`
                : 'Selecione prints para adicionar'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
