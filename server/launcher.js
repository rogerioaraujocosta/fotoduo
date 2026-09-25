const http = require('http');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 4821;

function isServerRunning() {
  return new Promise(resolve => {
    const req = http.get(`http://localhost:${PORT}/api/ping`, { timeout: 1000 }, res => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function getNodeExecutable() {
  const candidates = [
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\Program Files (x86)\\nodejs\\node.exe',
    `${process.env.LOCALAPPDATA}\\Programs\\node\\node.exe`,
    `${process.env.APPDATA}\\nvm\\current\\node.exe`,
    'node.exe',
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

function ensureServerRunning() {
  return new Promise(async (resolve, reject) => {
    const running = await isServerRunning();
    if (running) {
      return resolve();
    }

    const nodeExe = getNodeExecutable();
    const serverScript = path.join(__dirname, 'index.js');
    const cwd = path.resolve(__dirname, '..');

    try {
      const { spawn } = require('child_process');
      const child = spawn(nodeExe, [serverScript], {
        cwd,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.unref();
    } catch (e) {
      // ignora
    }

    // Aguarda até 5 segundos o servidor responder
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const ok = await isServerRunning();
      if (ok) {
        clearInterval(interval);
        return resolve();
      }
      if (attempts > 25) {
        clearInterval(interval);
        return reject(new Error('Tempo limite excedido ao iniciar o servidor Fotoduo na porta 4821'));
      }
    }, 200);
  });
}

function getAppBrowserPath() {
  const possiblePaths = [
    `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${process.env['ProgramFiles']}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${process.env['LOCALAPPDATA']}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${process.env['ProgramFiles']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['LOCALAPPDATA']}\\Google\\Chrome\\Application\\chrome.exe`,
  ];

  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

async function openFotoduoWindow(selectedImagePaths = []) {
  await ensureServerRunning();

  const baseUrl = `http://localhost:${PORT}`;
  let targetUrl = baseUrl;

  if (selectedImagePaths && selectedImagePaths.length > 0) {
    const encoded = encodeURIComponent(JSON.stringify(selectedImagePaths));
    targetUrl = `${baseUrl}/?images=${encoded}`;
  }

  const browserPath = getAppBrowserPath();
  if (browserPath) {
    // Modo Aplicativo (--app): janela limpa e dedicada sem abas, sem URL, visual nativo
    exec(`"${browserPath}" --app="${targetUrl}"`);
  } else {
    // Fallback: abre no navegador padrão
    exec(`start "" "${targetUrl}"`);
  }
}

if (require.main === module) {
  let images = [];
  if (process.argv[2]) {
    try {
      images = JSON.parse(process.argv[2]);
    } catch {
      images = process.argv.slice(2);
    }
  }
  openFotoduoWindow(images);
}

module.exports = {
  openFotoduoWindow,
  ensureServerRunning,
  isServerRunning,
};
