import { CanvasItem, CanvasImageItem, CanvasTextItem, CanvasRedactionItem } from '../types';

export interface ExportResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
}

export async function exportCanvasToImage(
  items: CanvasItem[],
  padding = 0
): Promise<ExportResult | null> {
  if (items.length === 0) return null;

  // 1. Calcular o bounding box exato de todos os elementos
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const item of items) {
    const w = item.width || 50;
    const h = item.height || 50;
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + w);
    maxY = Math.max(maxY, item.y + h);
  }

  // Adicionar margem opcional
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  const totalWidth = Math.ceil(maxX - minX);
  const totalHeight = Math.ceil(maxY - minY);

  if (totalWidth <= 0 || totalHeight <= 0) return null;

  // 2. Criar canvas offscreen com resolução nativa máxima
  const offscreen = document.createElement('canvas');
  offscreen.width = totalWidth;
  offscreen.height = totalHeight;
  const ctx = offscreen.getContext('2d', { alpha: true });
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Ordenar itens por zIndex
  const sortedItems = [...items].sort((a, b) => a.zIndex - b.zIndex);

  // Carregar instâncias das imagens para desenhar
  const loadedImages = new Map<string, HTMLImageElement>();
  for (const item of sortedItems) {
    if (item.type === 'image' && !loadedImages.has(item.src)) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${item.src}`));
        img.src = item.src;
      });
      loadedImages.set(item.src, img);
    }
  }

  // 3. Desenhar elementos preservando 100% da nitidez e qualidade
  for (const item of sortedItems) {
    const destX = item.x - minX;
    const destY = item.y - minY;

    if (item.type === 'image') {
      const img = loadedImages.get(item.src);
      if (!img) continue;

      const crop = item.crop || { top: 0, right: 0, bottom: 0, left: 0 };
      const sx = crop.left;
      const sy = crop.top;
      const sw = Math.max(1, item.naturalWidth - crop.left - crop.right);
      const sh = Math.max(1, item.naturalHeight - crop.top - crop.bottom);

      ctx.save();
      // Desenha a fatia recortada da imagem original diretamente no canvas
      ctx.drawImage(img, sx, sy, sw, sh, destX, destY, item.width, item.height);
      ctx.restore();
    } else if (item.type === 'text') {
      const textItem = item as CanvasTextItem;
      ctx.save();

      const fontSize = textItem.fontSize || 26;
      ctx.font = `${textItem.isBold ? 'bold ' : ''}${fontSize}px ${textItem.fontFamily || 'Inter, -apple-system, sans-serif'}`;
      ctx.textBaseline = 'top';

      const metrics = ctx.measureText(textItem.text);
      const textW = Math.ceil(metrics.width);
      const boxW = textItem.width || (textW + 16);
      const boxH = textItem.height || Math.ceil(fontSize * 1.35 + 8);

      // Fundo destacado opcional (marcador / tarja)
      if (textItem.backgroundColor && textItem.backgroundColor !== 'transparent') {
        ctx.fillStyle = textItem.backgroundColor;
        ctx.fillRect(destX, destY, boxW, boxH);
      }

      ctx.fillStyle = textItem.fill || '#ffffff';
      ctx.fillText(textItem.text, destX + 8, destY + 4);
      ctx.restore();
    } else if (item.type === 'redaction') {
      const red = item as CanvasRedactionItem;
      ctx.save();

      if (red.kind === 'blackout') {
        ctx.fillStyle = '#000000';
        ctx.fillRect(destX, destY, red.width, red.height);
      } else if (red.kind === 'whiteout') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(destX, destY, red.width, red.height);
      } else if (red.kind === 'blur') {
        // Simulação de desfoque/censura elegante (pixelate / blur suave)
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(destX, destY, red.width, red.height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(destX, destY, red.width, red.height);
      } else if (red.kind === 'eraser') {
        // Borracha: recorte / vazio
        if (red.points && red.points.length >= 2) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          ctx.moveTo(red.points[0] - minX, red.points[1] - minY);
          for (let i = 2; i < red.points.length; i += 2) {
            ctx.lineTo(red.points[i] - minX, red.points[i + 1] - minY);
          }
          ctx.lineWidth = red.strokeWidth || 20;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        } else {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillRect(destX, destY, red.width, red.height);
        }
      }
      ctx.restore();
    }
  }

  // 4. Exportar para PNG de alta fidelidade
  return new Promise((resolve) => {
    offscreen.toBlob((blob) => {
      if (!blob) {
        return resolve(null);
      }
      const dataUrl = offscreen.toDataURL('image/png', 1.0);
      resolve({
        dataUrl,
        blob,
        width: totalWidth,
        height: totalHeight,
      });
    }, 'image/png', 1.0);
  });
}
