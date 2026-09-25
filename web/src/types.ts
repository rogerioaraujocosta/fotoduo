export interface CropConfig {
  top: number;    // em pixels originais da imagem
  right: number;  // em pixels originais da imagem
  bottom: number; // em pixels originais da imagem
  left: number;   // em pixels originais da imagem
}

export interface CanvasImageItem {
  id: string;
  type: 'image';
  src: string;
  originalPath: string;
  x: number;
  y: number;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
  crop: CropConfig;
  zIndex: number;
}

export interface CanvasTextItem {
  id: string;
  type: 'text';
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fill: string;
  backgroundColor?: string;
  isBold: boolean;
  width: number;
  height: number;
  zIndex: number;
}

export type RedactionKind = 'blackout' | 'whiteout' | 'blur' | 'eraser';

export interface CanvasRedactionItem {
  id: string;
  type: 'redaction';
  kind: RedactionKind;
  x: number;
  y: number;
  width: number;
  height: number;
  points?: number[]; // para traçado livre da borracha
  strokeWidth?: number;
  zIndex: number;
}

export type CanvasItem = CanvasImageItem | CanvasTextItem | CanvasRedactionItem;

export type ToolMode = 
  | 'select' 
  | 'crop' 
  | 'text' 
  | 'redact-box' 
  | 'redact-brush';

export type ThemeMode = 'light' | 'dark';

export interface ScreenshotMetadata {
  id: string;
  name: string;
  path: string;
  size: number;
  mtime: number;
  dateFormatted: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}
