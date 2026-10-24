import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { ScreenshotFile, getHelperExe } from './scanner';

export interface ExplorerFolder {
  path: string;
  name: string;
  isFileSystem: boolean;
}

export interface ExplorerDetection {
  folder: ExplorerFolder | null;
  candidates: ExplorerFolder[];
  method: string;
  zorderCount?: number;
  error?: string;
}

export interface SaveResult {
  saved: string[];
  skipped: string[];
  errors: { file: string; message: string }[];
}

const logDebug = (msg: string) => {
  try {
    const logPath = path.join(os.tmpdir(), 'fotoduo-debug.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
};

export function detectExplorerFolder(): Promise<ExplorerDetection> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      return resolve({ folder: null, candidates: [], method: 'unsupported' });
    }

    const exe = getHelperExe('fotoduo-explorer.exe');
    if (!fs.existsSync(exe)) {
      logDebug(`detectExplorerFolder: helper não encontrado em ${exe}`);
      return resolve({ folder: null, candidates: [], method: 'error', error: 'Helper fotoduo-explorer.exe não encontrado' });
    }

    execFile(exe, [], { windowsHide: true, timeout: 4000, encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err || !stdout) {
        const errorMsg = err?.message || stderr || 'Sem resposta do helper';
        logDebug(`detectExplorerFolder erro: ${errorMsg}`);
        return resolve({ folder: null, candidates: [], method: 'error', error: errorMsg });
      }

      try {
        const data = JSON.parse(stdout.trim());
        logDebug(`detectExplorerFolder sucesso: method=${data.method}, zorderCount=${data.zorderCount}, chosen=${data.folder?.path || 'nenhum'}`);
        resolve({
          folder: data.folder || null,
          candidates: Array.isArray(data.candidates) ? data.candidates : [],
          method: data.method || 'none',
          zorderCount: data.zorderCount,
        });
      } catch (parseErr: any) {
        logDebug(`detectExplorerFolder JSON parse erro: ${parseErr.message}`);
        resolve({ folder: null, candidates: [], method: 'error', error: parseErr.message });
      }
    });
  });
}

function formatDateForFileName(timestamp: number): string {
  const d = new Date(timestamp);
  const YYYY = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const DD = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${YYYY}-${MM}-${DD} ${hh}${mm}${ss}`;
}

export function saveImagesToFolder(files: ScreenshotFile[], destDir: string): SaveResult {
  const result: SaveResult = {
    saved: [],
    skipped: [],
    errors: [],
  };

  const normalizedDest = path.resolve(destDir).toLowerCase();

  for (const file of files) {
    const src = file.path;
    if (!fs.existsSync(src)) {
      result.errors.push({ file: src, message: 'Arquivo de origem não encontrado' });
      continue;
    }

    const srcDir = path.resolve(path.dirname(src)).toLowerCase();
    if (srcDir === normalizedDest) {
      result.skipped.push(src);
      continue;
    }

    const ext = path.extname(src) || '.png';
    const rawBaseName = path.basename(src, ext);

    let baseName: string;
    if (file.isClipboard || /^clip-[0-9a-f]+$/i.test(rawBaseName)) {
      baseName = `Imagem ${formatDateForFileName(file.mtime || Date.now())}`;
    } else {
      baseName = rawBaseName;
    }

    // Remover caracteres inválidos do Windows no nome do arquivo
    const sanitizedBase = baseName.replace(/[<>:"/\\|?*]/g, '-').trim() || 'Imagem';

    let targetPath = path.join(destDir, `${sanitizedBase}${ext}`);
    let counter = 2;

    while (true) {
      try {
        fs.copyFileSync(src, targetPath, fs.constants.COPYFILE_EXCL);
        result.saved.push(targetPath);
        break;
      } catch (err: any) {
        if (err.code === 'EEXIST') {
          targetPath = path.join(destDir, `${sanitizedBase} (${counter})${ext}`);
          counter++;
          if (counter > 1000) {
            result.errors.push({ file: src, message: 'Muitos arquivos com o mesmo nome' });
            break;
          }
        } else {
          result.errors.push({ file: src, message: err.message || 'Erro ao copiar arquivo' });
          break;
        }
      }
    }
  }

  return result;
}
