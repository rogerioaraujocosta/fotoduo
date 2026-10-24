# 🤖 Instruções para Agentes de IA (Antigravity, Codex, Claude Code, Cursor, Windsurf)

Este documento foi preparado especialmente para orientar assistentes e agentes de IA a clonar, instalar, compilar e validar o **Fotoduo** de forma 100% autônoma e sem necessidade de intervenção manual do usuário.

---

## 📌 Visão Rápida do Projeto
- **Nome**: Fotoduo (Extensão para Raycast)
- **Objetivo**: Lousa interativa e combinador de prints com resolução 100% nativa, crop de bordas, tarja/borracha e exportação direta para área de transferência / Downloads.
- **Stack**:
  - Extensão Raycast: TypeScript, React, `@raycast/api`, `@raycast/utils`.
  - Frontend da Lousa: Vite, React, TypeScript, Konva / `react-konva`, TailwindCSS (`web/`).
  - Ponte Local & Helpers: Node.js HTTP Server (`server/`), C# Clipboard Helper (`assets/bin/fotoduo-clipboard.exe`), C# Explorer Helper (`assets/bin/fotoduo-explorer.exe`).

---

## 🚀 Como Instalar e Rodar em 1 Comando

Para instalar todas as dependências (raiz e `web`), compilar o frontend da lousa e a extensão do Raycast, e sincronizar automaticamente com a pasta de extensões do Raycast:

### Com `pnpm` (Recomendado):
```bash
pnpm run setup
```

### Com `npm`:
```bash
npm run setup
```

### No Windows PowerShell:
```powershell
.\install.ps1
```

O script `scripts/setup.js` executa automaticamente:
1. `pnpm install` na raiz
2. `pnpm install` em `web/`
3. `pnpm run build` em `web/` (gera `web/dist`)
4. `ray build -e dist -o dist` (gera `dist/`)
5. Sincroniza assets e copia a extensão compilada para `~/.config/raycast/extensions/fotoduo` (no Windows).

---

## 🔍 Como Validar a Instalação

Como agente, você pode verificar se tudo está correto executando:

```bash
# 1. Testar se o build da extensão Raycast foi gerado
node -e "console.log(require('fs').existsSync('dist/fotoduo.js') ? 'OK: dist/fotoduo.js presente' : 'ERRO')"

# 2. Testar se o frontend da lousa foi compilado
node -e "console.log(require('fs').existsSync('web/dist/index.html') ? 'OK: web/dist/index.html presente' : 'ERRO')"

# 3. Testar a inicialização do servidor de lousa
node server/launcher.js

# 4. Testar o helper de detecção do Explorer
node -e "require('child_process').execFile('assets/bin/fotoduo-explorer.exe', {windowsHide:true, timeout:4000}, (err, out) => console.log(JSON.parse(out).success ? 'OK: fotoduo-explorer.exe funcional' : 'ERRO'))"
```

---

## 🛠️ Comandos de Desenvolvimento Úteis

| Ação | Comando |
| :--- | :--- |
| **Instalação Completa** | `pnpm run setup` |
| **Modo Dev do Raycast** | `pnpm run dev` |
| **Modo Dev da Lousa Web** | `cd web && pnpm run dev` |
| **Recompilar Extensão** | `pnpm run build` |
| **Linting Raycast** | `pnpm run lint` |
