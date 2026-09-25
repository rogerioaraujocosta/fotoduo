const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const rootDir = path.resolve(__dirname, '..');
const webDir = path.join(rootDir, 'web');

function log(msg) {
  console.log(`\x1b[36m[Fotoduo Setup]\x1b[0m ${msg}`);
}

function success(msg) {
  console.log(`\x1b[32m✔ ${msg}\x1b[0m`);
}

function warn(msg) {
  console.log(`\x1b[33m⚠ ${msg}\x1b[0m`);
}

function error(msg) {
  console.error(`\x1b[31m✖ ${msg}\x1b[0m`);
}

function runCmd(cmd, cwd = rootDir) {
  log(`Executando: ${cmd} (em ${path.relative(rootDir, cwd) || '.'})`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function getPackageManager() {
  try {
    execSync('pnpm --version', { stdio: 'ignore' });
    return 'pnpm';
  } catch {
    return 'npm';
  }
}

async function main() {
  console.log('\n==================================================');
  console.log('       📸 INSTALADOR AUTOMÁTICO DO FOTODUO        ');
  console.log('==================================================\n');

  const pm = getPackageManager();
  log(`Gerenciador de pacotes detectado: ${pm}`);

  // 1. Instalar dependências da raiz
  log('1/4 Instalando dependências principais do Raycast...');
  runCmd(`${pm} install`, rootDir);
  success('Dependências principais instaladas!');

  // 2. Instalar dependências da aplicação Web (Lousa / Canvas)
  log('2/4 Instalando dependências da Lousa Interativa (Web)...');
  runCmd(`${pm} install`, webDir);
  success('Dependências da aplicação Web instaladas!');

  // 3. Compilar a aplicação Web (Vite + React + Konva)
  log('3/4 Compilando frontend da Lousa Interativa...');
  runCmd(`${pm} run build`, webDir);
  success('Frontend Web compilado com sucesso em web/dist!');

  // 4. Compilar extensão do Raycast
  log('4/4 Compilando extensão do Raycast...');
  try {
    runCmd('npx ray build -e dist -o dist', rootDir);
  } catch (e) {
    runCmd(`${pm} run build`, rootDir);
  }

  // 5. Executar sincronização de arquivos
  const syncScript = path.join(__dirname, 'sync-build.js');
  if (fs.existsSync(syncScript)) {
    require('./sync-build.js');
  }

  // 6. Verificar status da extensão no Raycast
  const raycastExtDir = path.join(os.homedir(), '.config', 'raycast', 'extensions', 'fotoduo');
  console.log('\n==================================================');
  if (fs.existsSync(raycastExtDir)) {
    success('🎉 FOTODUO INSTALADO COM SUCESSO NO RAYCAST!');
    console.log(`Local da extensão: ${raycastExtDir}`);
  } else {
    success('🎉 COMPILAÇÃO DO FOTODUO CONCLUÍDA!');
    warn('Pasta ~/.config/raycast/extensions não encontrada. Para rodar em desenvolvimento execute:');
    console.log('   pnpm run dev  (ou npm run dev)');
  }
  console.log('==================================================');
  console.log('⚡ COMO USAR:');
  console.log('  1. Abra o Raycast (ou atalho Alt + V se configurado)');
  console.log('  2. Digite "fotoduo" e selecione "Fotoduo: Colagem de Prints"');
  console.log('  3. Marque seus prints com clique ou barra de espaço');
  console.log('  4. Pressione Enter para abrir na Lousa e colar com 1 clique!\n');
}

main().catch(err => {
  error(`Erro durante a instalação: ${err.message}`);
  process.exit(1);
});
