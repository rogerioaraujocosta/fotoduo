import { CanvasItem } from '../types';

export interface GuideLine {
  orientation: 'horizontal' | 'vertical';
  position: number;
}

const SNAP_THRESHOLD = 8; // Distância em pixels na tela para ativar o ímã

export function getSnapLines(
  activeItem: { x: number; y: number; width: number; height: number },
  otherItems: CanvasItem[],
  scale: number
): { x: number; y: number; guides: GuideLine[] } {
  let snappedX = activeItem.x;
  let snappedY = activeItem.y;
  const guides: GuideLine[] = [];

  const threshold = SNAP_THRESHOLD / scale;

  const aLeft = activeItem.x;
  const aRight = activeItem.x + activeItem.width;
  const aCenterX = activeItem.x + activeItem.width / 2;

  const aTop = activeItem.y;
  const aBottom = activeItem.y + activeItem.height;
  const aCenterY = activeItem.y + activeItem.height / 2;

  let snapXFound = false;
  let snapYFound = false;

  for (const item of otherItems) {
    const iWidth = item.width || 0;
    const iHeight = item.height || 0;
    const iLeft = item.x;
    const iRight = item.x + iWidth;
    const iCenterX = item.x + iWidth / 2;

    const iTop = item.y;
    const iBottom = item.y + iHeight;
    const iCenterY = item.y + iHeight / 2;

    // Alinhamento Horizontal (Eixo X)
    if (!snapXFound) {
      if (Math.abs(aLeft - iLeft) < threshold) {
        snappedX = iLeft;
        guides.push({ orientation: 'vertical', position: iLeft });
        snapXFound = true;
      } else if (Math.abs(aRight - iRight) < threshold) {
        snappedX = iRight - activeItem.width;
        guides.push({ orientation: 'vertical', position: iRight });
        snapXFound = true;
      } else if (Math.abs(aLeft - iRight) < threshold) { // Encaixe lado a lado perfeito
        snappedX = iRight;
        guides.push({ orientation: 'vertical', position: iRight });
        snapXFound = true;
      } else if (Math.abs(aRight - iLeft) < threshold) {
        snappedX = iLeft - activeItem.width;
        guides.push({ orientation: 'vertical', position: iLeft });
        snapXFound = true;
      } else if (Math.abs(aCenterX - iCenterX) < threshold) {
        snappedX = iCenterX - activeItem.width / 2;
        guides.push({ orientation: 'vertical', position: iCenterX });
        snapXFound = true;
      }
    }

    // Alinhamento Vertical (Eixo Y)
    if (!snapYFound) {
      if (Math.abs(aTop - iTop) < threshold) {
        snappedY = iTop;
        guides.push({ orientation: 'horizontal', position: iTop });
        snapYFound = true;
      } else if (Math.abs(aBottom - iBottom) < threshold) {
        snappedY = iBottom - activeItem.height;
        guides.push({ orientation: 'horizontal', position: iBottom });
        snapYFound = true;
      } else if (Math.abs(aTop - iBottom) < threshold) { // Encaixe empilhado perfeito
        snappedY = iBottom;
        guides.push({ orientation: 'horizontal', position: iBottom });
        snapYFound = true;
      } else if (Math.abs(aBottom - iTop) < threshold) {
        snappedY = iTop - activeItem.height;
        guides.push({ orientation: 'horizontal', position: iTop });
        snapYFound = true;
      } else if (Math.abs(aCenterY - iCenterY) < threshold) {
        snappedY = iCenterY - activeItem.height / 2;
        guides.push({ orientation: 'horizontal', position: iCenterY });
        snapYFound = true;
      }
    }
  }

  return { x: snappedX, y: snappedY, guides };
}
