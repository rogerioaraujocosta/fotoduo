import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { environment } from '@raycast/api';

export interface ScreenshotFile {
  id: string;
  name: string;
  path: string;
  size: number;
  mtime: number;
  dateFormatted: string;
  isClipboard?: boolean;
}

export interface ClipboardGrabResult {
  file: ScreenshotFile;
  isNew: boolean;
  width?: number;
  height?: number;
}

export function getScreenshotDirs(): string[] {
  const userProfile = os.homedir();
  const dirs = [
    // Cache local de clipboard do Fotoduo (mais prioritário)
    path.join(userProfile, 'AppData', 'Local', 'Fotoduo', 'clipboard'),
    // Pastas oficiais de Capturas de tela do Windows / OneDrive
    path.join(userProfile, 'OneDrive', 'Imagens', 'Capturas de tela'),
    path.join(userProfile, 'OneDrive', 'Pictures', 'Screenshots'),
    path.join(userProfile, 'Pictures', 'Capturas de tela'),
    path.join(userProfile, 'Pictures', 'Screenshots'),
    path.join(userProfile, 'Imagens', 'Capturas de tela'),
  ];

  return dirs.filter(dir => {
    try {
      return fs.existsSync(dir);
    } catch {
      return false;
    }
  });
}

export function getHelperExe(fileName: string): string {
  const candidates: string[] = [];

  try {
    if (environment && environment.assetsPath) {
      candidates.push(path.join(environment.assetsPath, 'bin', fileName));
    }
  } catch {}

  candidates.push(
    path.join(__dirname, '..', 'assets', 'bin', fileName),
    path.join(__dirname, 'assets', 'bin', fileName),
    path.join(__dirname, 'bin', fileName),
    path.join(__dirname, '..', 'server', 'bin', fileName),
    path.join(__dirname, 'server', 'bin', fileName),
  );

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        return c;
      }
    } catch {}
  }

  return candidates[2];
}

export function getClipboardHelperExe(): string {
  return getHelperExe('fotoduo-clipboard.exe');
}

/**
 * Lê diretamente a imagem da Área de Transferência do Windows via helper nativo C# (~50ms)
 */
export function getClipboardImage(): Promise<ClipboardGrabResult | null> {
  return new Promise((resolve) => {
    const exe = getClipboardHelperExe();
    if (!fs.existsSync(exe)) {
      return resolve(null);
    }

    execFile(exe, { windowsHide: true, timeout: 1500 }, (err, stdout) => {
      if (err || !stdout) {
        return resolve(null);
      }

      try {
        const data = JSON.parse(stdout.trim());
        if (!data.success || !data.path || !fs.existsSync(data.path)) {
          return resolve(null);
        }

        const isImage = data.type === 'clipboard_image';
        const fileName = isImage
          ? '📸 Captura da Área de Transferência'
          : `📋 Arquivo Copiado (${path.basename(data.path)})`;

        const stat = fs.statSync(data.path);
        const mtime = data.mtime || stat.mtimeMs || Date.now();

        const file: ScreenshotFile = {
          id: Buffer.from(data.path).toString('base64url'),
          name: fileName,
          path: data.path,
          size: data.size || stat.size,
          mtime: mtime,
          dateFormatted: 'Copiado agora',
          isClipboard: true,
        };

        resolve({
          file,
          isNew: !!data.isNew,
          width: data.width,
          height: data.height,
        });
      } catch {
        resolve(null);
      }
    });
  });
}

export function getImageDimensions(filePath: string): { width: number; height: number } | null {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(4096);
    const bytesRead = fs.readSync(fd, buf, 0, 4096, 0);
    fs.closeSync(fd);

    if (bytesRead < 24) return null;

    if (ext === '.png' && buf.toString('ascii', 1, 4) === 'PNG') {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }

    if (ext === '.jpg' || ext === '.jpeg') {
      let offset = 2;
      while (offset < bytesRead - 8) {
        if (buf[offset] !== 0xFF) break;
        const marker = buf[offset + 1];
        if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
          const height = buf.readUInt16BE(offset + 5);
          const width = buf.readUInt16BE(offset + 7);
          return { width, height };
        }
        const length = buf.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
    }
  } catch {}
  return null;
}

export function isDuplicateScreenshot(
  a: { path: string; size: number; mtime: number; isClipboard?: boolean },
  b: { path: string; size: number; mtime: number; isClipboard?: boolean }
): boolean {
  if (a.path === b.path) return true;

  const sameSize = a.size === b.size;
  const timeDiff = Math.abs(a.mtime - b.mtime);

  // Arquivos com mesmo tamanho em janela de 60 segundos são duplicatas
  if (sameSize && timeDiff < 60000) return true;

  // Se um é print do disco (OneDrive/Capturas) e o outro é do cache de clipboard (Win+Shift+S salva em ambos)
  if (a.isClipboard !== b.isClipboard && timeDiff < 12000) {
    if (Math.abs(a.size - b.size) < 200000) {
      const dimA = getImageDimensions(a.path);
      const dimB = getImageDimensions(b.path);
      if (dimA && dimB && dimA.width === dimB.width && dimA.height === dimB.height) {
        return true;
      }
      if (timeDiff < 4000) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Escaneia pastas de capturas com otimização de alta performance (< 10ms mesmo com 10.000+ arquivos)
 */
export function getRecentScreenshots(limit = 40): ScreenshotFile[] {
  const dirs = getScreenshotDirs();
  const validExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
  const rawItems: { name: string; path: string; size: number; mtime: number; date: Date; isClipboard: boolean }[] = [];
  const seenPaths = new Set<string>();

  for (const dir of dirs) {
    try {
      const files = fs.readdirSync(dir);
      if (files.length === 0) continue;

      let candidateFiles: string[] = [];
      const dirLower = dir.toLowerCase();
      const isScreenshotDir = dirLower.includes('capturas de tela') || dirLower.includes('screenshots');
      const isClipboardDir = dirLower.includes('fotoduo') || dirLower.includes('raycast\\clipboard');

      if (isScreenshotDir) {
        // Snipping tool nomeia 'Captura de tela YYYY-MM-DD...' ou 'Screenshot...'
        // Ordenação alfabética reversa corresponde exatamente à cronológica
        const matches = files.filter(f => {
          const lower = f.toLowerCase();
          return (lower.startsWith('captura de tela') || lower.startsWith('screenshot')) &&
                 validExtensions.has(path.extname(lower));
        });
        matches.sort().reverse();
        candidateFiles = matches.slice(0, 25);
      } else if (isClipboardDir) {
        // No cache de clipboard, pegamos todos os válidos para ordenar por data exata
        const valid = files.filter(f => validExtensions.has(path.extname(f).toLowerCase()));
        candidateFiles = valid;
      } else if (files.length > 50) {
        const valid = files.filter(f => validExtensions.has(path.extname(f).toLowerCase()));
        valid.sort().reverse();
        candidateFiles = valid.slice(0, 30);
      } else {
        candidateFiles = files.filter(f => validExtensions.has(path.extname(f).toLowerCase()));
      }

      for (const file of candidateFiles) {
        const fullPath = path.join(dir, file);
        if (seenPaths.has(fullPath)) continue;

        try {
          const stat = fs.statSync(fullPath);
          if (stat.isFile() && stat.size > 1024) {
            seenPaths.add(fullPath);
            rawItems.push({
              name: file,
              path: fullPath,
              size: stat.size,
              mtime: stat.mtimeMs,
              date: stat.mtime,
              isClipboard: isClipboardDir,
            });
          }
        } catch {
          // ignora
        }
      }
    } catch {
      // ignora
    }
  }

  // Ordenar decrescente pelo tempo de modificação
  rawItems.sort((a, b) => b.mtime - a.mtime);

  // Desduplicar capturas que foram salvas simultaneamente no clipboard e no OneDrive/Windows
  const deduplicated: typeof rawItems = [];
  for (const item of rawItems) {
    const isDuplicate = deduplicated.some(existing => isDuplicateScreenshot(existing, item));
    if (!isDuplicate) {
      deduplicated.push(item);
    }
  }

  return deduplicated.slice(0, limit).map(item => ({
    id: Buffer.from(item.path).toString('base64url'),
    name: item.isClipboard
      ? (item.name.startsWith('clip-') ? '📸 Imagem Copiada' : item.name.startsWith('📸') ? item.name : `📸 ${item.name}`)
      : item.name,
    path: item.path,
    size: item.size,
    mtime: item.mtime,
    isClipboard: item.isClipboard,
    dateFormatted: new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(item.date),
  }));
}

/**
 * Carrega a lista completa com prioridade instantânea para a imagem da área de transferência
 */
export async function getAllScreenshotsWithClipboard(limit = 10): Promise<{
  items: ScreenshotFile[];
  newClipboardFile?: ScreenshotFile;
}> {
  const [clipResult, diskScreenshots] = await Promise.all([
    getClipboardImage(),
    Promise.resolve(getRecentScreenshots(limit)),
  ]);

  let items = [...diskScreenshots];
  let newClipboardFile: ScreenshotFile | undefined;

  if (clipResult && clipResult.file) {
    const clipFile = clipResult.file;
    const existingIndex = items.findIndex(it => isDuplicateScreenshot(it, clipFile));

    if (existingIndex >= 0) {
      const existing = items[existingIndex];
      if (!existing.isClipboard) {
        // Já existe como print oficial do disco (ex: "Captura de tela..."), não duplica
      } else {
        // Move para o topo se foi detectado como cópia recente
        items.splice(existingIndex, 1);
        items.unshift({
          ...existing,
          name: clipResult.isNew ? '📸 Imagem Copiada (Área de Transferência)' : existing.name,
          dateFormatted: clipResult.isNew ? 'Copiado agora' : existing.dateFormatted,
          isClipboard: true,
        });
        if (clipResult.isNew) {
          newClipboardFile = items[0];
        }
      }
    } else {
      // Adiciona no topo
      items.unshift(clipFile);
      if (clipResult.isNew) {
        newClipboardFile = clipFile;
      }
    }
  }

  return {
    items: items.slice(0, limit),
    newClipboardFile,
  };
}
