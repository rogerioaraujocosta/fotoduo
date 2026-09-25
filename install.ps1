# =======================================================
# 📸 Fotoduo - Instalador Automático para Windows / Raycast
# =======================================================

$ErrorActionPreference = "Stop"

Write-Host "Verificando ambiente..." -ForegroundColor Cyan

# 1. Verificar se Node.js está instalado
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js não foi encontrado no seu PATH!" -ForegroundColor Red
    Write-Host "Por favor, instale o Node.js (versão 18 ou superior) em: https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

$nodeVer = node -v
Write-Host "✔ Node.js detectado: $nodeVer" -ForegroundColor Green

# 2. Executar o script de setup do Fotoduo
node scripts/setup.js

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Pronto para usar no Raycast!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Ocorreu um erro durante a instalação." -ForegroundColor Red
}
