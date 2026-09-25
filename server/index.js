const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, execFile, spawn } = require('child_process');
const { getRecentScreenshots, getAllScreenshotsWithClipboard } = require('./scanner');

const PORT = 4821;
const candidateDistDirs = [
  path.join(__dirname, '..', 'web', 'dist'),
  path.join(__dirname, 'web', 'dist'),
  path.join(__dirname, 'dist'),
];
const WEB_DIST_DIR = candidateDistDirs.find(d => fs.existsSync(d)) || candidateDistDirs[0];

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function handleCors(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end();
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (req.method === 'OPTIONS') {
    return handleCors(res);
  }

  // API: Health / Ping
  if (pathname === '/api/ping') {
    return sendJson(res, 200, { status: 'ok', name: 'fotoduo-server' });
  }

  // API: Listar capturas recentes
  if (pathname === '/api/screenshots' && req.method === 'GET') {
    (async () => {
      try {
        const limit = parseInt(parsedUrl.searchParams.get('limit') || '40', 10);
        const result = await getAllScreenshotsWithClipboard(limit);
        return sendJson(res, 200, { screenshots: result.items });
      } catch (err) {
        return sendJson(res, 500, { error: 'Falha ao buscar capturas', details: err.message });
      }
    })();
    return;
  }

  // API: Servir imagem em resolução total
  if (pathname === '/api/image' && req.method === 'GET') {
    let filePath = parsedUrl.searchParams.get('path');
    const id = parsedUrl.searchParams.get('id');

    if (!filePath && id) {
      try {
        filePath = Buffer.from(id, 'base64url').toString('utf8');
      } catch (e) {
        return sendJson(res, 400, { error: 'ID inválido' });
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return sendJson(res, 404, { error: 'Arquivo não encontrado' });
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
    };

    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400',
    });

    const stream = fs.createReadStream(filePath);
    return stream.pipe(res);
  }

  // API: Salvar imagem diretamente no Downloads
  if (pathname === '/api/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Proteção de tamanho limite: 100MB
      if (body.length > 100 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const dataUrl = payload.dataUrl;
        if (!dataUrl) {
          return sendJson(res, 400, { error: 'Nenhum dado de imagem recebido' });
        }

        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const filename = payload.filename || `fotoduo-${timestamp}.png`;

        const downloadsDir = path.join(os.homedir(), 'Downloads');
        const targetPath = path.join(downloadsDir, filename);

        fs.writeFileSync(targetPath, buffer);

        // Se solicitado, já copia para a área de transferência do Windows
        if (payload.copyToClipboard) {
          copyImageToClipboard(targetPath);
        }

        return sendJson(res, 200, {
          success: true,
          filename,
          filePath: targetPath,
          message: 'Imagem salva com sucesso na pasta Downloads!',
        });
      } catch (err) {
        return sendJson(res, 500, { error: 'Falha ao salvar arquivo', details: err.message });
      }
    });
    return;
  }

  // API: Copiar arquivo ou dataUrl de imagem para o Clipboard do Windows (100% silencioso)
  if (pathname === '/api/copy-clipboard' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        let targetPath = payload.filePath;

        // Se recebemos dataUrl diretamente: salva em cache temporário do Fotoduo e copia
        if (!targetPath && payload.dataUrl) {
          const base64Data = payload.dataUrl.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const tempDir = path.join(os.tmpdir(), 'fotoduo');
          if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
          targetPath = path.join(tempDir, 'clipboard-cache.png');
          fs.writeFileSync(targetPath, buffer);
        }

        if (!targetPath || !fs.existsSync(targetPath)) {
          return sendJson(res, 400, { error: 'Arquivo de imagem inválido ou inexistente' });
        }

        copyImageToClipboard(targetPath, (err) => {
          if (err) {
            return sendJson(res, 500, { error: 'Falha ao copiar para o clipboard', details: err.message });
          }
          return sendJson(res, 200, { success: true, message: 'Copiado para a área de transferência!' });
        });
      } catch (err) {
        return sendJson(res, 500, { error: 'Erro interno', details: err.message });
      }
    });
    return;
  }

  // API: Revelar arquivo no Windows Explorer (sem abrir janela de console)
  if (pathname === '/api/reveal' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { filePath } = JSON.parse(body || '{}');
        if (filePath && fs.existsSync(filePath)) {
          const explorerProc = spawn('explorer.exe', [`/select,"${filePath}"`], {
            windowsHide: true,
            detached: true,
            stdio: 'ignore',
            shell: false,
          });
          explorerProc.unref();
          return sendJson(res, 200, { success: true });
        }
        return sendJson(res, 400, { error: 'Arquivo inexistente' });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    });
    return;
  }

  // Servir frontend compilado (quando existir dist)
  if (fs.existsSync(WEB_DIST_DIR)) {
    let reqPath = pathname === '/' ? '/index.html' : pathname;
    let safePath = path.normalize(path.join(WEB_DIST_DIR, reqPath));

    if (!safePath.startsWith(WEB_DIST_DIR)) {
      res.writeHead(403);
      return res.end('Acesso negado');
    }

    if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
      safePath = path.join(WEB_DIST_DIR, 'index.html');
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.json': 'application/json',
    };

    res.writeHead(200, { 
      'Content-Type': contentTypes[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=31536000, immutable'
    });
    return fs.createReadStream(safePath).pipe(res);
  }

  // Caso dist ainda não exista, instrui a rodar o dev server
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <div style="font-family: sans-serif; padding: 40px; text-align: center;">
      <h1>Fotoduo - Servidor Ativo</h1>
      <p>O servidor da ponte local está em execução na porta ${PORT}.</p>
      <p>Acesse o ambiente de desenvolvimento em <b>http://localhost:5173</b> ou compile a aplicação com <code>npm run build</code>.</p>
    </div>
  `);
});

const candidateClipboardHelpers = [
  path.join(__dirname, 'bin', 'fotoduo-clipboard.exe'),
  path.join(__dirname, '..', 'assets', 'bin', 'fotoduo-clipboard.exe'),
  path.join(__dirname, 'assets', 'bin', 'fotoduo-clipboard.exe'),
  path.join(__dirname, '..', 'server', 'bin', 'fotoduo-clipboard.exe'),
];

function getClipboardHelperExe() {
  return candidateClipboardHelpers.find(exe => fs.existsSync(exe)) || null;
}

function copyImageToClipboard(filePath, callback) {
  const helperExe = getClipboardHelperExe();

  // 1. Tentar executar o helper nativo silencioso C# compilado como Windows GUI (nunca abre janela CMD)
  if (helperExe) {
    execFile(helperExe, ['-copy', filePath], { windowsHide: true, timeout: 5000 }, (err) => {
      if (!err) {
        if (callback) callback(null);
        return;
      }
      // Se falhou, recorre ao PowerShell silencioso
      copyImageViaPowerShellSilent(filePath, callback);
    });
    return;
  }

  // 2. Fallback: PowerShell executado via spawn direto (sem cmd.exe) com windowsHide: true
  copyImageViaPowerShellSilent(filePath, callback);
}

function copyImageViaPowerShellSilent(filePath, callback) {
  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms;
    $img = [System.Drawing.Image]::FromFile('${filePath.replace(/'/g, "''")}');
    [System.Windows.Forms.Clipboard]::SetImage($img);
    $img.Dispose();
  `;
  const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');

  const child = spawn('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-WindowStyle', 'Hidden',
    '-EncodedCommand', encodedCommand
  ], {
    windowsHide: true,
    stdio: 'ignore'
  });

  child.on('close', (code) => {
    if (callback) callback(code === 0 ? null : new Error(`PowerShell retornou código ${code}`));
  });

  child.on('error', (err) => {
    if (callback) callback(err);
  });
}

function startServer(port = PORT) {
  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      console.log(`[Fotoduo] Servidor rodando em http://localhost:${port}`);
      resolve(server);
    });
    server.on('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.log(`[Fotoduo] Porta ${port} já em uso. Servidor já está ativo.`);
        resolve(null);
      } else {
        reject(err);
      }
    });
  });
}

process.on('exit', (code) => {
  console.log(`[Fotoduo] Processo encerrado com código: ${code}`);
});

process.on('uncaughtException', (err) => {
  console.error('[Fotoduo] Erro não capturado:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Fotoduo] Rejeição não tratada:', reason);
});

if (require.main === module) {
  startServer();
}

module.exports = {
  server,
  startServer,
  PORT,
};
