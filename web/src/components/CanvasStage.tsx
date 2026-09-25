import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  CanvasItem, 
  CanvasImageItem, 
  CanvasTextItem, 
  CanvasRedactionItem, 
  ToolMode, 
  RedactionKind,
  ThemeMode 
} from '../types';
import { getSnapLines, GuideLine } from '../utils/alignment';

export const getTextDimensions = (
  text: string,
  fontSize: number,
  isBold: boolean,
  fontFamily = 'Inter, -apple-system, sans-serif'
) => {
  if (typeof document === 'undefined') {
    return { width: Math.max(60, text.length * fontSize * 0.6 + 16), height: Math.max(28, Math.ceil(fontSize * 1.35) + 8) };
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { width: Math.max(60, text.length * fontSize * 0.6 + 16), height: Math.max(28, Math.ceil(fontSize * 1.35) + 8) };
  }
  ctx.font = `${isBold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(text || ' ');
  return {
    width: Math.max(40, Math.ceil(metrics.width) + 16),
    height: Math.max(24, Math.ceil(fontSize * 1.35) + 8),
  };
};


interface CanvasStageProps {
  items: CanvasItem[];
  onChangeItems: (items: CanvasItem[]) => void;
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  currentTool: ToolMode;
  onSetTool: (tool: ToolMode) => void;
  scale: number;
  onScaleChange: (scale: number) => void;
  onSave: () => void;
  theme?: ThemeMode;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  items,
  onChangeItems,
  selectedId,
  onSelectId,
  currentTool,
  onSetTool,
  scale,
  onScaleChange,
  onSave,
  theme = 'light',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Posição da câmera (pan)
  const [offset, setOffset] = useState({ x: 80, y: 80 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, initialOffsetX: 0, initialOffsetY: 0 });

  // Guias de alinhamento magnético ativas
  const [activeGuides, setActiveGuides] = useState<GuideLine[]>([]);

  // Cache de imagens carregadas
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Estado de arrasto / redimensionamento de elemento
  const [dragState, setDragState] = useState<{
    itemId: string;
    action: 'move' | 'resize-se' | 'crop-top' | 'crop-bottom' | 'crop-left' | 'crop-right';
    startX: number;
    startY: number;
    initialItem: CanvasItem;
  } | null>(null);

  // Estado de desenho de tarja / borracha
  const [drawingRedaction, setDrawingRedaction] = useState<{
    kind: RedactionKind;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    points?: number[];
  } | null>(null);

  // Edição de texto inline
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextVal, setEditingTextVal] = useState('');
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  // Carregar imagens no cache
  useEffect(() => {
    items.forEach(item => {
      if (item.type === 'image' && !imageCacheRef.current.has(item.src)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = item.src;
        img.onload = () => {
          imageCacheRef.current.set(item.src, img);
          renderCanvas();
        };
      }
    });
  }, [items]);

  // Conversão de coordenadas: tela (mouse) para lousa (canvas space)
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = (screenX - rect.left - offset.x) / scale;
    const y = (screenY - rect.top - offset.y) / scale;
    return { x, y };
  }, [offset, scale]);

  // Conversão de coordenadas: lousa para tela
  const canvasToScreen = useCallback((canvasX: number, canvasY: number) => {
    return {
      x: canvasX * scale + offset.x,
      y: canvasY * scale + offset.y,
    };
  }, [offset, scale]);

  // Renderização principal em alta fidelidade
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isDark = theme === 'dark';

    // Ajuste para tela Retina / High-DPI
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Transformação do viewport (pan & zoom)
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Renderizar itens ordenados por zIndex
    const sorted = [...items].sort((a, b) => a.zIndex - b.zIndex);

    for (const item of sorted) {
      if (item.type === 'image') {
        const img = imageCacheRef.current.get(item.src);
        const crop = item.crop || { top: 0, right: 0, bottom: 0, left: 0 };

        if (img) {
          const sx = crop.left;
          const sy = crop.top;
          const sw = Math.max(1, item.naturalWidth - crop.left - crop.right);
          const sh = Math.max(1, item.naturalHeight - crop.top - crop.bottom);

          ctx.save();
          // Sombra suave e moderna inspirada em designs clean
          if (isDark) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
            ctx.shadowBlur = 24 / scale;
            ctx.shadowOffsetY = 8 / scale;
          } else {
            ctx.shadowColor = 'rgba(15, 23, 42, 0.10)';
            ctx.shadowBlur = 18 / scale;
            ctx.shadowOffsetY = 6 / scale;
          }

          ctx.drawImage(img, sx, sy, sw, sh, item.x, item.y, item.width, item.height);
          ctx.restore();
        } else {
          // Placeholder elegante enquanto carrega
          ctx.fillStyle = isDark ? '#18181b' : '#f1f5f9';
          ctx.fillRect(item.x, item.y, item.width, item.height);
          ctx.fillStyle = isDark ? '#71717a' : '#64748b';
          ctx.font = '13px Inter, sans-serif';
          ctx.fillText('Carregando imagem...', item.x + 12, item.y + 24);
        }
      } else if (item.type === 'text') {
        const textItem = item as CanvasTextItem;
        if (textItem.id === editingTextId) continue; // não desenha se estiver em edição inline

        ctx.save();
        const fontSize = textItem.fontSize || 26;
        ctx.font = `${textItem.isBold ? 'bold ' : ''}${fontSize}px ${textItem.fontFamily || 'Inter, -apple-system, sans-serif'}`;
        ctx.textBaseline = 'top';

        const metrics = ctx.measureText(textItem.text);
        const textW = Math.ceil(metrics.width);
        const boxW = item.width || (textW + 16);
        const boxH = item.height || Math.ceil(fontSize * 1.35 + 8);

        if (textItem.backgroundColor && textItem.backgroundColor !== 'transparent') {
          ctx.fillStyle = textItem.backgroundColor;
          ctx.fillRect(item.x, item.y, boxW, boxH);
        }

        ctx.fillStyle = textItem.fill || (isDark ? '#ffffff' : '#09090b');
        ctx.fillText(textItem.text, item.x + 8, item.y + 4);
        ctx.restore();
      } else if (item.type === 'redaction') {
        const red = item as CanvasRedactionItem;
        ctx.save();

        if (red.kind === 'blackout') {
          ctx.fillStyle = '#000000';
          ctx.fillRect(red.x, red.y, red.width, red.height);
        } else if (red.kind === 'whiteout') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(red.x, red.y, red.width, red.height);
        } else if (red.kind === 'blur') {
          // Tarja moderna fosca
          ctx.fillStyle = isDark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(244, 244, 245, 0.95)';
          ctx.fillRect(red.x, red.y, red.width, red.height);
          ctx.strokeStyle = isDark ? 'rgba(82, 82, 91, 0.6)' : 'rgba(212, 212, 216, 0.8)';
          ctx.lineWidth = 1 / scale;
          ctx.strokeRect(red.x, red.y, red.width, red.height);
        } else if (red.kind === 'eraser') {
          const bgEraser = isDark ? '#09090b' : '#f8fafc';
          if (red.points && red.points.length >= 2) {
            ctx.strokeStyle = bgEraser;
            ctx.lineWidth = (red.strokeWidth || 20);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(red.points[0], red.points[1]);
            for (let i = 2; i < red.points.length; i += 2) {
              ctx.lineTo(red.points[i], red.points[i + 1]);
            }
            ctx.stroke();
          } else {
            ctx.fillStyle = bgEraser;
            ctx.fillRect(red.x, red.y, red.width, red.height);
          }
        }
        ctx.restore();
      }
    }

    // Desenhar tarja sendo criada agora pelo mouse
    if (drawingRedaction) {
      ctx.save();
      const rw = drawingRedaction.currentX - drawingRedaction.startX;
      const rh = drawingRedaction.currentY - drawingRedaction.startY;
      const rx = rw < 0 ? drawingRedaction.currentX : drawingRedaction.startX;
      const ry = rh < 0 ? drawingRedaction.currentY : drawingRedaction.startY;
      const absW = Math.abs(rw);
      const absH = Math.abs(rh);

      if (drawingRedaction.kind === 'eraser' && drawingRedaction.points) {
        ctx.strokeStyle = isDark ? '#38bdf8' : '#2563eb';
        ctx.lineWidth = 20;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(drawingRedaction.points[0], drawingRedaction.points[1]);
        for (let i = 2; i < drawingRedaction.points.length; i += 2) {
          ctx.lineTo(drawingRedaction.points[i], drawingRedaction.points[i + 1]);
        }
        ctx.stroke();
      } else {
        ctx.fillStyle = drawingRedaction.kind === 'blackout' 
          ? 'rgba(0,0,0,0.85)' 
          : drawingRedaction.kind === 'whiteout' 
          ? 'rgba(255,255,255,0.85)' 
          : (isDark ? 'rgba(39, 39, 42, 0.85)' : 'rgba(228, 228, 231, 0.85)');
        ctx.fillRect(rx, ry, absW, absH);
        ctx.strokeStyle = isDark ? '#38bdf8' : '#2563eb';
        ctx.lineWidth = 1.5 / scale;
        ctx.strokeRect(rx, ry, absW, absH);
      }
      ctx.restore();
    }

    // Desenhar borda de seleção e alças para o item ativo no estilo shadcn/Figma
    const selectedItem = items.find(i => i.id === selectedId);
    if (selectedItem) {
      ctx.save();
      const sw = selectedItem.width || 50;
      const sh = selectedItem.height || 50;
      const primaryColor = isDark ? '#38bdf8' : '#2563eb';

      if (currentTool === 'crop' && selectedItem.type === 'image') {
        // Alças de Recorte de Bordas (Corte Não Destrutivo)
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2 / scale;
        ctx.setLineDash([5 / scale, 3 / scale]);
        ctx.strokeRect(selectedItem.x, selectedItem.y, sw, sh);
        ctx.setLineDash([]);

        // Barras de corte minimalistas nas 4 extremidades
        ctx.fillStyle = primaryColor;
        const barThickness = 5 / scale;
        const barLength = 32 / scale;

        // Top handle
        ctx.fillRect(selectedItem.x + sw / 2 - barLength / 2, selectedItem.y - barThickness / 2, barLength, barThickness);
        // Bottom handle
        ctx.fillRect(selectedItem.x + sw / 2 - barLength / 2, selectedItem.y + sh - barThickness / 2, barLength, barThickness);
        // Left handle
        ctx.fillRect(selectedItem.x - barThickness / 2, selectedItem.y + sh / 2 - barLength / 2, barThickness, barLength);
        // Right handle
        ctx.fillRect(selectedItem.x + sw - barThickness / 2, selectedItem.y + sh / 2 - barLength / 2, barThickness, barLength);
      } else {
        // Borda de seleção nítida e refinada
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 1.5 / scale;
        ctx.strokeRect(selectedItem.x, selectedItem.y, sw, sh);

        // Alça de redimensionamento no canto inferior direito
        const handleSize = 9 / scale;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(selectedItem.x + sw - handleSize / 2, selectedItem.y + sh - handleSize / 2, handleSize, handleSize);
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 1.5 / scale;
        ctx.strokeRect(selectedItem.x + sw - handleSize / 2, selectedItem.y + sh - handleSize / 2, handleSize, handleSize);
      }
      ctx.restore();
    }

    // Desenhar guias de alinhamento magnético ativas
    if (activeGuides.length > 0) {
      ctx.save();
      ctx.strokeStyle = isDark ? '#38bdf8' : '#2563eb';
      ctx.lineWidth = 1 / scale;
      ctx.setLineDash([4 / scale, 4 / scale]);

      for (const guide of activeGuides) {
        ctx.beginPath();
        if (guide.orientation === 'vertical') {
          ctx.moveTo(guide.position, -10000);
          ctx.lineTo(guide.position, 10000);
        } else {
          ctx.moveTo(-10000, guide.position);
          ctx.lineTo(10000, guide.position);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }, [items, selectedId, currentTool, scale, offset, activeGuides, drawingRedaction, editingTextId, theme]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Redimensionamento de janela
  useEffect(() => {
    const handleResize = () => renderCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderCanvas]);

  // Zoom pelo mouse wheel (Ctrl + Wheel ou Wheel simples suave)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    if (e.ctrlKey || Math.abs(e.deltaY) < 50) {
      // Zoom focalizado no ponteiro do mouse
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.min(Math.max(scale * zoomFactor, 0.1), 5.0);

      const mousePos = { x: e.clientX, y: e.clientY };
      const canvasPos = screenToCanvas(mousePos.x, mousePos.y);

      setOffset({
        x: mousePos.x - canvasPos.x * newScale - (containerRef.current?.getBoundingClientRect().left || 0),
        y: mousePos.y - canvasPos.y * newScale - (containerRef.current?.getBoundingClientRect().top || 0),
      });

      onScaleChange(newScale);
    } else {
      // Pan comum com scroll
      setOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  // Detecção de clique em itens ou alças
  const hitTest = (canvasX: number, canvasY: number) => {
    // 1. Verificar alças do item selecionado
    const sel = items.find(i => i.id === selectedId);
    if (sel) {
      const sw = sel.width || 50;
      const sh = sel.height || 50;
      const handleTolerance = 14 / scale;

      if (currentTool === 'crop' && sel.type === 'image') {
        if (Math.abs(canvasY - sel.y) < handleTolerance && canvasX >= sel.x && canvasX <= sel.x + sw) {
          return { item: sel, action: 'crop-top' as const };
        }
        if (Math.abs(canvasY - (sel.y + sh)) < handleTolerance && canvasX >= sel.x && canvasX <= sel.x + sw) {
          return { item: sel, action: 'crop-bottom' as const };
        }
        if (Math.abs(canvasX - sel.x) < handleTolerance && canvasY >= sel.y && canvasY <= sel.y + sh) {
          return { item: sel, action: 'crop-left' as const };
        }
        if (Math.abs(canvasX - (sel.x + sw)) < handleTolerance && canvasY >= sel.y && canvasY <= sel.y + sh) {
          return { item: sel, action: 'crop-right' as const };
        }
      } else {
        if (
          Math.abs(canvasX - (sel.x + sw)) < handleTolerance &&
          Math.abs(canvasY - (sel.y + sh)) < handleTolerance
        ) {
          return { item: sel, action: 'resize-se' as const };
        }
      }
    }

    // 2. Verificar itens do topo para a base (zIndex reverso)
    const sorted = [...items].sort((a, b) => b.zIndex - a.zIndex);
    for (const item of sorted) {
      const w = item.width || 50;
      const h = item.height || 50;
      if (
        canvasX >= item.x &&
        canvasX <= item.x + w &&
        canvasY >= item.y &&
        canvasY <= item.y + h
      ) {
        return { item, action: 'move' as const };
      }
    }

    return null;
  };

  const isSpacePressedRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        isSpacePressedRef.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Mouse Down
  const handleMouseDown = (e: React.MouseEvent) => {
    // Botão do meio do mouse, Barra de espaço ou Alt: Pan na lousa
    if (e.button === 1 || isSpacePressedRef.current || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        initialOffsetX: offset.x,
        initialOffsetY: offset.y,
      };
      return;
    }

    if (e.button !== 0) return; // Apenas botão esquerdo

    const { x: cx, y: cy } = screenToCanvas(e.clientX, e.clientY);

    // Modo Desenhar Tarja / Borracha
    if (currentTool === 'redact-box') {
      setDrawingRedaction({
        kind: 'blur',
        startX: cx,
        startY: cy,
        currentX: cx,
        currentY: cy,
      });
      return;
    }

    if (currentTool === 'redact-brush') {
      setDrawingRedaction({
        kind: 'eraser',
        startX: cx,
        startY: cy,
        currentX: cx,
        currentY: cy,
        points: [cx, cy],
      });
      return;
    }

    // Modo Adicionar Texto
    if (currentTool === 'text') {
      const isDark = theme === 'dark';
      const defaultText = 'Clique duas vezes para editar';
      const defaultFontSize = 26;
      const dims = getTextDimensions(defaultText, defaultFontSize, true, 'Inter, sans-serif');

      const newText: CanvasTextItem = {
        id: `text-${Date.now()}`,
        type: 'text',
        text: defaultText,
        x: cx,
        y: cy,
        fontSize: defaultFontSize,
        fontFamily: 'Inter, sans-serif',
        fill: isDark ? '#ffffff' : '#09090b',
        backgroundColor: isDark ? 'rgba(24, 24, 27, 0.85)' : 'rgba(255, 255, 255, 0.85)',
        isBold: true,
        width: dims.width,
        height: dims.height,
        zIndex: items.length + 1,
      };
      onChangeItems([...items, newText]);
      onSelectId(newText.id);
      onSetTool('select');
      startEditText(newText);
      return;
    }

    // Teste de colisão no item ou alça
    const hit = hitTest(cx, cy);
    if (hit) {
      onSelectId(hit.item.id);
      setDragState({
        itemId: hit.item.id,
        action: hit.action,
        startX: cx,
        startY: cy,
        initialItem: JSON.parse(JSON.stringify(hit.item)),
      });
    } else {
      // Clicou no espaço vazio da lousa: deseleciona e permite pan arrastando o fundo
      onSelectId(null);
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        initialOffsetX: offset.x,
        initialOffsetY: offset.y,
      };
    }
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    // Pan do viewport
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setOffset({
        x: panStartRef.current.initialOffsetX + dx,
        y: panStartRef.current.initialOffsetY + dy,
      });
      return;
    }

    const { x: cx, y: cy } = screenToCanvas(e.clientX, e.clientY);

    // Desenhar tarja / borracha
    if (drawingRedaction) {
      if (drawingRedaction.kind === 'eraser' && drawingRedaction.points) {
        setDrawingRedaction(prev => prev ? ({
          ...prev,
          points: [...prev.points!, cx, cy],
        }) : null);
      } else {
        setDrawingRedaction(prev => prev ? ({
          ...prev,
          currentX: cx,
          currentY: cy,
        }) : null);
      }
      return;
    }

    // Arrastar / Redimensionar / Cortar item
    if (dragState) {
      const dx = cx - dragState.startX;
      const dy = cy - dragState.startY;
      const init = dragState.initialItem;

      if (dragState.action === 'move') {
        const otherItems = items.filter(i => i.id !== init.id);
        const { x: snappedX, y: snappedY, guides } = getSnapLines(
          { x: init.x + dx, y: init.y + dy, width: init.width || 0, height: init.height || 0 },
          otherItems,
          scale
        );

        setActiveGuides(guides);

        onChangeItems(items.map(i => {
          if (i.id === init.id) {
            return { ...i, x: snappedX, y: snappedY };
          }
          return i;
        }));
      } else if (dragState.action === 'resize-se') {
        setActiveGuides([]);
        if (init.type === 'image') {
          const newW = Math.max(40, (init.width || 100) + dx);
          const ratio = (init.height || 1) / (init.width || 1);
          const newH = newW * ratio;
          onChangeItems(items.map(i => {
            if (i.id === init.id) {
              return { ...i, width: newW, height: newH };
            }
            return i;
          }));
        } else if (init.type === 'text') {
          const textItem = init as CanvasTextItem;
          const initialW = Math.max(30, textItem.width || 100);
          const initialH = Math.max(20, textItem.height || 40);
          const initialFontSize = textItem.fontSize || 26;

          const scaleW = (initialW + dx) / initialW;
          const scaleH = (initialH + dy) / initialH;
          const factor = Math.abs(dx) >= Math.abs(dy) ? scaleW : scaleH;
          const scaleFactor = Math.max(0.3, Math.min(8.0, factor));

          const newFontSize = Math.max(12, Math.min(180, Math.round(initialFontSize * scaleFactor)));
          const dims = getTextDimensions(textItem.text, newFontSize, textItem.isBold, textItem.fontFamily);

          onChangeItems(items.map(i => {
            if (i.id === init.id) {
              return {
                ...i,
                fontSize: newFontSize,
                width: dims.width,
                height: dims.height,
              };
            }
            return i;
          }));
        } else {
          const newW = Math.max(20, (init.width || 50) + dx);
          const newH = Math.max(20, (init.height || 50) + dy);
          onChangeItems(items.map(i => {
            if (i.id === init.id) {
              return { ...i, width: newW, height: newH };
            }
            return i;
          }));
        }
      } else if (dragState.action.startsWith('crop-')) {
        const imageItem = init as CanvasImageItem;
        const crop = { ...imageItem.crop };
        const naturalW = imageItem.naturalWidth;
        const naturalH = imageItem.naturalHeight;

        const scaleX = (naturalW - crop.left - crop.right) / imageItem.width;
        const scaleY = (naturalH - crop.top - crop.bottom) / imageItem.height;

        if (dragState.action === 'crop-top') {
          const deltaNatural = dy * scaleY;
          crop.top = Math.max(0, Math.min(naturalH - crop.bottom - 20, (imageItem.crop.top || 0) + deltaNatural));
        } else if (dragState.action === 'crop-bottom') {
          const deltaNatural = -dy * scaleY;
          crop.bottom = Math.max(0, Math.min(naturalH - crop.top - 20, (imageItem.crop.bottom || 0) + deltaNatural));
        } else if (dragState.action === 'crop-left') {
          const deltaNatural = dx * scaleX;
          crop.left = Math.max(0, Math.min(naturalW - crop.right - 20, (imageItem.crop.left || 0) + deltaNatural));
        } else if (dragState.action === 'crop-right') {
          const deltaNatural = -dx * scaleX;
          crop.right = Math.max(0, Math.min(naturalW - crop.left - 20, (imageItem.crop.right || 0) + deltaNatural));
        }

        const visibleNaturalW = naturalW - crop.left - crop.right;
        const visibleNaturalH = naturalH - crop.top - crop.bottom;

        onChangeItems(items.map(i => {
          if (i.id === init.id) {
            return {
              ...i,
              crop,
              width: visibleNaturalW / scaleX,
              height: visibleNaturalH / scaleY,
            };
          }
          return i;
        }));
      }
    }
  };

  // Mouse Up
  const handleMouseUp = () => {
    setIsPanning(false);
    setActiveGuides([]);

    // Finalizar criação de tarja / borracha
    if (drawingRedaction) {
      if (drawingRedaction.kind === 'eraser' && drawingRedaction.points && drawingRedaction.points.length >= 4) {
        const newEraser: CanvasRedactionItem = {
          id: `eraser-${Date.now()}`,
          type: 'redaction',
          kind: 'eraser',
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          points: drawingRedaction.points,
          strokeWidth: 20,
          zIndex: items.length + 1,
        };
        onChangeItems([...items, newEraser]);
      } else {
        const rw = drawingRedaction.currentX - drawingRedaction.startX;
        const rh = drawingRedaction.currentY - drawingRedaction.startY;
        if (Math.abs(rw) > 8 && Math.abs(rh) > 8) {
          const newRedact: CanvasRedactionItem = {
            id: `redact-${Date.now()}`,
            type: 'redaction',
            kind: 'blur',
            x: rw < 0 ? drawingRedaction.currentX : drawingRedaction.startX,
            y: rh < 0 ? drawingRedaction.currentY : drawingRedaction.startY,
            width: Math.abs(rw),
            height: Math.abs(rh),
            zIndex: items.length + 1,
          };
          onChangeItems([...items, newRedact]);
        }
      }
      setDrawingRedaction(null);
      onSetTool('select');
    }

    setDragState(null);
  };

  // Duplo clique para editar texto
  const handleDoubleClick = (e: React.MouseEvent) => {
    const { x: cx, y: cy } = screenToCanvas(e.clientX, e.clientY);
    const hit = hitTest(cx, cy);
    if (hit && hit.item.type === 'text') {
      startEditText(hit.item as CanvasTextItem);
    }
  };

  const startEditText = (item: CanvasTextItem) => {
    setEditingTextId(item.id);
    setEditingTextVal(item.text);
    setTimeout(() => {
      if (textInputRef.current) {
        textInputRef.current.focus();
        textInputRef.current.select();
      }
    }, 50);
  };

  const commitEditText = () => {
    if (editingTextId) {
      const trimmed = editingTextVal.trim();
      if (!trimmed) {
        onChangeItems(items.filter(i => i.id !== editingTextId));
      } else {
        onChangeItems(items.map(i => {
          if (i.id === editingTextId) {
            const textItem = i as CanvasTextItem;
            const dims = getTextDimensions(trimmed, textItem.fontSize || 26, textItem.isBold, textItem.fontFamily);
            return {
              ...i,
              text: trimmed,
              width: dims.width,
              height: dims.height,
            };
          }
          return i;
        }));
      }
      setEditingTextId(null);
    }
  };

  // Suporte a colar print direto da área de transferência (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      for (const item of clipboardItems) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const src = event.target?.result as string;
              const img = new Image();
              img.onload = () => {
                const screenCenter = screenToCanvas(
                  window.innerWidth / 2,
                  window.innerHeight / 2
                );

                const newImageItem: CanvasImageItem = {
                  id: `image-${Date.now()}`,
                  type: 'image',
                  src,
                  originalPath: 'clipboard',
                  x: screenCenter.x - img.naturalWidth / 2,
                  y: screenCenter.y - img.naturalHeight / 2,
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                  naturalWidth: img.naturalWidth,
                  naturalHeight: img.naturalHeight,
                  crop: { top: 0, right: 0, bottom: 0, left: 0 },
                  zIndex: items.length + 1,
                };
                onChangeItems([...items, newImageItem]);
                onSelectId(newImageItem.id);
              };
              img.src = src;
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [items, screenToCanvas, onChangeItems, onSelectId]);

  // Teclas de atalho na lousa
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingTextId || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'v' || e.key === 'V') onSetTool('select');
      if (e.key === 'c' || e.key === 'C') onSetTool('crop');
      if (e.key === 'b' || e.key === 'B') onSetTool('redact-box');
      if (e.key === 'e' || e.key === 'E') onSetTool('redact-brush');
      if (e.key === 't' || e.key === 'T') onSetTool('text');

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        onChangeItems(items.filter(i => i.id !== selectedId));
        onSelectId(null);
      }

      if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        onSave();
      }

      if (e.key === 'Escape') {
        onSelectId(null);
        onSetTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingTextId, selectedId, items, onSetTool, onChangeItems, onSelectId, onSave]);

  // Posição na tela para a caixa de edição de texto
  const editingTextItem = items.find(i => i.id === editingTextId) as CanvasTextItem | undefined;
  const editingScreenPos = editingTextItem 
    ? canvasToScreen(editingTextItem.x, editingTextItem.y)
    : null;

  return (
    <div 
      ref={containerRef}
      className="relative flex-1 w-full h-full overflow-hidden canvas-bg cursor-default select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Editor de texto inline quando em edição */}
      {editingTextItem && editingScreenPos && (
        <div
          className="absolute z-40"
          style={{
            left: `${editingScreenPos.x - 4}px`,
            top: `${editingScreenPos.y - 2}px`,
          }}
        >
          <textarea
            ref={textInputRef}
            value={editingTextVal}
            onChange={(e) => setEditingTextVal(e.target.value)}
            onBlur={commitEditText}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commitEditText();
              }
            }}
            className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 font-semibold px-2 py-1 rounded-md border-2 border-zinc-900 dark:border-zinc-100 outline-none resize-none shadow-2xl"
            style={{
              fontSize: `${(editingTextItem.fontSize || 26) * scale}px`,
              lineHeight: 1.35,
              minWidth: `${Math.max(160, (editingTextItem.width || 220) * scale)}px`,
              minHeight: `${Math.max(36, (editingTextItem.height || 40) * scale)}px`,
            }}
          />
        </div>
      )}

      {/* Legenda de atalhos rápidos e status no rodapé da lousa estilo dock shadcn */}
      <div className="absolute bottom-3 left-4 z-20 pointer-events-none flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono text-[10px]">V</kbd> Mover
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono text-[10px]">C</kbd> Cortar
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono text-[10px]">B</kbd> Tarja
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono text-[10px]">E</kbd> Borracha
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono text-[10px]">T</kbd> Texto
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono text-[10px]">Ctrl+V</kbd> Colar
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono text-[10px]">Espaço</kbd> Pan
        </span>
      </div>
    </div>
  );
};
