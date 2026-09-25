import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface StitchOptions {
  layout: 'vertical' | 'horizontal';
  cropTop: number;
  cropBottom: number;
  cropLeft: number;
  cropRight: number;
  gap: number;
  backgroundColor: string;
  title?: string;
  redactSensitive?: boolean;
}

export interface StitchResult {
  filePath: string;
  fileUri?: string;
  dataUri?: string;
  width: number;
  height: number;
  sizeBytes: number;
}

function getNodeExecutable(): string {
  const candidates = [
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\Program Files (x86)\\nodejs\\node.exe',
    `${process.env.LOCALAPPDATA}\\Programs\\node\\node.exe`,
    `${process.env.APPDATA}\\nvm\\current\\node.exe`,
    'node',
  ];

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        return c;
      }
    } catch {
      // ignora
    }
  }

  return 'node';
}

function getCliScriptPath(): string {
  const candidatePaths = [
    path.join(__dirname, '..', 'server', 'stitch-cli.js'),
    path.join(__dirname, 'server', 'stitch-cli.js'),
    path.join(__dirname, '..', '..', 'server', 'stitch-cli.js'),
    path.join(process.cwd(), 'server', 'stitch-cli.js'),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return path.join(__dirname, '..', 'server', 'stitch-cli.js');
}

export function stitchScreenshots(
  imagePaths: string[],
  options: StitchOptions,
  targetFilePath?: string
): Promise<StitchResult> {
  return new Promise((resolve, reject) => {
    if (!imagePaths || imagePaths.length === 0) {
      return reject(new Error('Nenhuma imagem selecionada para montagem.'));
    }

    const scriptPath = getCliScriptPath();
    const nodeBin = getNodeExecutable();
    const projectDir = path.dirname(scriptPath) ? path.resolve(path.dirname(scriptPath), '..') : process.cwd();
    const nodeModulesDir = path.join(projectDir, 'node_modules');

    const child = spawn(nodeBin, [scriptPath], {
      cwd: projectDir,
      env: {
        ...process.env,
        NODE_PATH: nodeModulesDir,
      },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', chunk => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', chunk => {
      stderrData += chunk.toString();
    });

    child.on('error', err => {
      reject(err);
    });

    child.on('close', code => {
      if (code !== 0) {
        return reject(new Error(`Falha no processamento da imagem (código ${code}): ${stderrData || 'Erro desconhecido'}`));
      }

      try {
        const parsed: StitchResult = JSON.parse(stdoutData.trim());
        resolve(parsed);
      } catch (err: any) {
        reject(new Error(`Resposta inválida do processador de imagem: ${err.message}`));
      }
    });

    const payload = JSON.stringify({
      imagePaths,
      options,
      targetFilePath,
    });

    child.stdin.write(payload);
    child.stdin.end();
  });
}

export function copyImageFileToClipboard(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms;
      $img = [System.Drawing.Image]::FromFile('${filePath.replace(/'/g, "''")}');
      [System.Windows.Forms.Clipboard]::SetImage($img);
      $img.Dispose();
    `;
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encoded}`, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}
