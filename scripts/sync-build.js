const fs = require('fs');
const path = require('path');
const os = require('os');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

// 1. Garantir que dist/assets/bin existe e copiar helper do clipboard e ícone
const distAssetsBin = path.join(distDir, 'assets', 'bin');
fs.mkdirSync(distAssetsBin, { recursive: true });

const srcClipboardExe = path.join(rootDir, 'assets', 'bin', 'fotoduo-clipboard.exe');
if (fs.existsSync(srcClipboardExe)) {
  fs.copyFileSync(srcClipboardExe, path.join(distAssetsBin, 'fotoduo-clipboard.exe'));
}

const srcIcon = path.join(rootDir, 'assets', 'command-icon.png');
if (fs.existsSync(srcIcon)) {
  fs.copyFileSync(srcIcon, path.join(distDir, 'assets', 'command-icon.png'));
}

// 2. Copiar server/ para dist/server/
const srcServer = path.join(rootDir, 'server');
const distServer = path.join(distDir, 'server');
copyDirRecursive(srcServer, distServer);

// 3. Se web/dist existir, copiar para dist/web/dist
const srcWebDist = path.join(rootDir, 'web', 'dist');
const distWebDist = path.join(distDir, 'web', 'dist');
if (fs.existsSync(srcWebDist)) {
  copyDirRecursive(srcWebDist, distWebDist);
}

// 4. Se o usuário estiver no Windows com Raycast instalado, sincronizar com ~/.config/raycast/extensions/fotoduo
const userHome = os.homedir();
const raycastExtensionsDir = path.join(userHome, '.config', 'raycast', 'extensions');

if (fs.existsSync(raycastExtensionsDir)) {
  const targetExtensionDir = path.join(raycastExtensionsDir, 'fotoduo');
  fs.mkdirSync(targetExtensionDir, { recursive: true });
  copyDirRecursive(distDir, targetExtensionDir);
  console.log(`[Fotoduo] Sincronizado com sucesso com Raycast em: ${targetExtensionDir}`);
}
