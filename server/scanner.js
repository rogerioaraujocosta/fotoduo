const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

function getScreenshotDirs() {
  const userProfile = os.homedir();
  const dirs = [
    // Cache de imagens da área de transferência do Fotoduo (mais prioritário)
    path.join(userProfile, 'AppData', 'Local', 'Fotoduo', 'clipboard'),
    // Pastas de Capturas de tela (prioritárias)
    path.join(userProfile, 'OneDrive', 'Imagens', 'Capturas de tela'),
    path.join(userProfile, 'OneDrive', 'Pictures', 'Screenshots'),
    path.join(userProfile, 'Pictures', 'Capturas de tela'),
    path.join(userProfile, 'Pictures', 'Screenshots'),
    path.join(userProfile, 'Imagens', 'Capturas de tela'),
    // Cache de imagens da área de transferência do Raycast
    path.join(userProfile, 'AppData', 'Local', 'Raycast', 'clipboard'),
  ];

  return dirs.filter(dir => {
    try {
      return fs.existsSync(dir);
    } catch {
      return false;
    }
  });
}

function getClipboardHelperExe() {
  const candidates = [
    path.join(__dirname, 'bin', 'fotoduo-clipboard.exe'),
    path.join(__dirname, '..', 'assets', 'bin', 'fotoduo-clipboard.exe'),
    path.join(__dirname, 'assets', 'bin', 'fotoduo-clipboard.exe'),
    path.join(__dirname, '..', 'server', 'bin', 'fotoduo-clipboard.exe'),
  ];

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        return c;
      }
    } catch {}
  }
  return candidates[0];
}

function getClipboardImage() {
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

        resolve({
          file: {
            id: Buffer.from(data.path).toString('base64url'),
            name: fileName,
            path: data.path,
            size: data.size || stat.size,
            mtime: mtime,
            dateFormatted: 'Copiado agora',
            isClipboard: true,
          },
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

function getRecentScreenshots(limit = 40) {
  const dirs = getScreenshotDirs();
  const validExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
  const rawItems = [];
  const seenPaths = new Set();

  for (const dir of dirs) {
    try {
      const files = fs.readdirSync(dir);
      if (files.length === 0) continue;

      let candidateFiles = [];
      const dirLower = dir.toLowerCase();
      const isScreenshotDir = dirLower.includes('capturas de tela') || dirLower.includes('screenshots');
      const isClipboardDir = dirLower.includes('fotoduo') || dirLower.includes('raycast\\clipboard');

      if (isScreenshotDir) {
        const matches = files.filter(f => {
          const lower = f.toLowerCase();
          return (lower.startsWith('captura de tela') || lower.startsWith('screenshot')) &&
                 validExtensions.has(path.extname(lower));
        });
        matches.sort().reverse();
        candidateFiles = matches.slice(0, 25);
      } else if (isClipboardDir) {
        const valid = files.filter(f => validExtensions.has(path.extname(f).toLowerCase()));
        valid.sort().reverse();
        candidateFiles = valid.slice(0, 25);
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
              isClipboard: isClipboardDir,
              date: stat.mtime,
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

  // Ordenar pelos mais recentes
  rawItems.sort((a, b) => b.mtime - a.mtime);

  // Desduplicar capturas simultâneas
  const deduplicated = [];
  for (const item of rawItems) {
    const isDuplicate = deduplicated.some(existing => {
      if (existing.path === item.path) return true;

      const sameSize = existing.size === item.size;
      const timeDiff = Math.abs(existing.mtime - item.mtime);

      if (sameSize && timeDiff < 15000) return true;

      if (existing.isClipboard !== item.isClipboard && timeDiff < 6000 && Math.abs(existing.size - item.size) < 15000) {
        return true;
      }

      return false;
    });

    if (!isDuplicate) {
      deduplicated.push(item);
    }
  }

  return deduplicated.slice(0, limit).map(item => ({
    id: Buffer.from(item.path).toString('base64url'),
    name: item.isClipboard && !item.name.startsWith('📸') ? `📸 Print ${item.name}` : item.name,
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

async function getAllScreenshotsWithClipboard(limit = 40) {
  const [clipResult, diskScreenshots] = await Promise.all([
    getClipboardImage(),
    Promise.resolve(getRecentScreenshots(limit)),
  ]);

  let items = [...diskScreenshots];
  let newClipboardFile;

  if (clipResult && clipResult.file) {
    const clipFile = clipResult.file;
    const existingIndex = items.findIndex(
      it => it.path === clipFile.path || (Math.abs(it.mtime - clipFile.mtime) < 6000 && Math.abs(it.size - clipFile.size) < 15000)
    );

    if (existingIndex >= 0) {
      const [existing] = items.splice(existingIndex, 1);
      items.unshift({
        ...existing,
        name: clipResult.isNew ? '📸 Nova Captura da Área de Transferência' : existing.name,
        dateFormatted: clipResult.isNew ? 'Copiado agora' : existing.dateFormatted,
        isClipboard: true,
      });
      if (clipResult.isNew) {
        newClipboardFile = items[0];
      }
    } else {
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

module.exports = {
  getScreenshotDirs,
  getRecentScreenshots,
  getClipboardImage,
  getAllScreenshotsWithClipboard,
};
