# 📸 Fotoduo - Lousa Interativa & Colagem de Prints para Raycast

<p align="center">
  <b>Junte, organize, recorte e anote capturas de tela diretamente no Raycast com qualidade nativa de 100%, sem perda de nitidez e pronto para colar no WhatsApp.</b>
</p>

---

## ⚡ O que é o Fotoduo?

O **Fotoduo** é uma extensão de alta produtividade para o **Raycast** (com suporte nativo a Windows e macOS) que resolve o problema de juntar múltiplos prints rapidamente:

- 🏎️ **Detecção Instantânea**: Lista suas capturas mais recentes do Windows / OneDrive e imagens recém-copiadas para a Área de Transferência.
- 🎯 **Seleção com 1 Clique**: Clique nas fotos desejadas ou use a barra de espaço.
- 🎨 **Lousa Visual Completa (Canvas)**:
  - **Aparar Bordas (Crop)**: Remova barras de endereço, abas ou a barra de tarefas do Windows.
  - **Tarja de Privacidade / Borracha**: Oculte dados sensíveis (senhas, emails, valores) com tarjas elegantes.
  - **Anotações de Texto**: Adicione legendas e títulos nítidos.
  - **Reordenação e Alinhamento Inteligente**: Arraste para reposicionar livremente com guias magnéticas.
- 🚀 **Exportação em 1 Toque**: Pressione <kbd>Enter</kbd> para salvar em alta resolução na sua pasta `Downloads` e copiar automaticamente para a Área de Transferência (pronto para colar com <kbd>Ctrl</kbd> + <kbd>V</kbd>).
- 🔒 **100% Local & Seguro**: Nenhum arquivo ou imagem sai da sua máquina.

---

## 🚀 Instalação Rápida em 1 Comando (Pronto para Uso)

Você pode instalar o Fotoduo executando **apenas um comando** no seu terminal. O instalador baixa as bibliotecas necessárias, compila a lousa e a extensão, e **já registra tudo automaticamente no seu Raycast**.

### Opção 1: Com `pnpm` (Recomendado)
```bash
git clone https://github.com/rogerioaraujocosta/fotoduo.git
cd fotoduo
pnpm run setup
```

### Opção 2: Com `npm`
```bash
git clone https://github.com/rogerioaraujocosta/fotoduo.git
cd fotoduo
npm run setup
```

### Opção 3: No Windows PowerShell
```powershell
git clone https://github.com/rogerioaraujocosta/fotoduo.git; cd fotoduo; .\install.ps1
```

> **Pronto!** Assim que o comando terminar, o Fotoduo já estará instalado e disponível no Raycast. Basta abrir o Raycast e digitar `fotoduo`!

---

## 📋 Pré-requisitos & Bibliotecas Necessárias

Para rodar o Fotoduo na sua máquina, você só precisa de:

1. **[Raycast](https://www.raycast.com/)** instalado (Windows ou macOS).
2. **[Node.js](https://nodejs.org/)** (versão 18 ou superior).
3. **[pnpm](https://pnpm.io/)** (recomendado: `npm install -g pnpm`) ou `npm`.

### 📦 Principais Bibliotecas Utilizadas
- **Extensão Raycast**:
  - `@raycast/api`: Integração com o ecossistema e interface do Raycast.
  - `@raycast/utils`: Utilitários nativos.
  - `sharp`: Processamento de imagem de altíssimo desempenho.
- **Lousa Interativa (Frontend em `web/`)**:
  - `react` & `react-dom` (v18): Interface reativa.
  - `konva` & `react-konva`: Renderização de Canvas 2D acelerada via GPU com suporte a drag-and-drop, zoom e corte.
  - `tailwindcss` & `lucide-react`: Estilização moderna e ícones.
  - `vite`: Build ultrarrápido do frontend.
- **Ponte Local & Helper**:
  - `server/index.js`: Servidor local leve que conecta o Raycast à lousa.
  - `assets/bin/fotoduo-clipboard.exe`: Helper C# nativo ultrarrápido para leitura e gravação silenciosa da Área de Transferência do Windows.

---

## 🤖 Para Usuários de Agentes de IA (Antigravity, Claude Code, Codex, Cursor, etc.)

Se você utiliza assistentes ou agentes autônomos de código, basta enviar o seguinte prompt para o seu agente:

```text
Por favor, clone o repositório https://github.com/rogerioaraujocosta/fotoduo.git e execute 'pnpm run setup' (ou 'npm run setup') para compilar e instalar a extensão Fotoduo no meu Raycast. Consulte o arquivo AGENTS.md para detalhes de validação.
```

O agente executará a rotina de setup de forma 100% autônoma, validando os builds de `dist/` e `web/dist/`.

---

## ⚡ Como Usar o Fotoduo no Dia a Dia

### 1. Abrir a Extensão
- Abra o Raycast (ou configure o atalho rápido <kbd>Alt</kbd> + <kbd>V</kbd> nas preferências do Raycast).
- Digite `fotoduo` e pressione <kbd>Enter</kbd>.

### 2. Selecionar Capturas
- As **10 capturas de tela mais recentes** (incluindo prints da Área de Transferência e do OneDrive) são carregadas instantaneamente.
- **Clique com o mouse** em qualquer foto para selecioná-la (um indicador azul com <kbd>✓</kbd> aparecerá).
- Ou use as setas do teclado e pressione a **Barra de Espaço** para marcar/desmarcar.
- Atalhos extras:
  - <kbd>Ctrl</kbd> + <kbd>A</kbd>: Selecionar todas as capturas.
  - <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd>: Limpar seleção.
  - <kbd>Ctrl</kbd> + <kbd>R</kbd>: Atualizar lista de capturas.

### 3. Abrir na Lousa Fotoduo
- Pressione <kbd>Enter</kbd> (ou clique na ação principal).
- A Lousa Fotoduo se abrirá em uma janela nativa dedicada (modo aplicativo).

### 4. Editar e Exportar
- Ajuste a posição das imagens arrastando livremente.
- Use as ferramentas da barra superior:
  - ✂️ **Aparar Topo / Base**: Remova barras do navegador e do Windows com 1 clique.
  - ⬛ **Tarja de Privacidade**: Desenhe sobre áreas com dados pessoais ou sensíveis.
  - 📝 **Adicionar Texto**: Insira notas explicativas.
  - ↕️ **Layout Automático**: Empilhe verticalmente ou coloque lado a lado.
- Ao finalizar:
  - Clique em **"Salvar & Copiar"** (ou pressione <kbd>Enter</kbd>).
  - A imagem combinada é salva na sua pasta `Downloads` e copiada imediatamente para a Área de Transferência.
  - Cole diretamente no WhatsApp, Slack, Teams ou e-mail com <kbd>Ctrl</kbd> + <kbd>V</kbd>!

---

## 🛠️ Comandos de Desenvolvimento

Se você quiser customizar o Fotoduo ou contribuir:

```bash
# Rodar extensão em modo desenvolvimento do Raycast
pnpm run dev

# Rodar a Lousa Web com hot-reload no navegador (http://localhost:5173)
cd web && pnpm run dev

# Compilar todo o projeto e sincronizar com o Raycast
pnpm run setup
```

---

## 🔒 Privacidade e Segurança

- Todo o processamento de imagens é realizado **estritamente localmente** na sua máquina.
- Nenhuma telemetria, captura de tela ou dado sensível é transmitido para servidores externos.

---

## 📄 Licença

Distribuído sob a licença [MIT](LICENSE). Desenvolvido por **Rogério Araújo Costa**.
