/* ================================================================
   MINI CODE RUNNER – Script
   localStorage File System + Monaco Editor + Code Execution
   ================================================================ */

;(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  // ── DOM Elements ──────────────────────────────────────────────
  const sidebar        = $('#sidebar');
  const activityIcons  = $$('.activitybar__icon[data-panel]');
  const sidebarLabel   = $('#sidebar-label');
  const collapseBtn    = $('#btn-collapse-sidebar');
  const tabsContainer  = $('#tabs');
  const bottomPanel    = $('#bottompanel');
  const resizeHandle   = $('#resize-handle');
  const panelCloseBtn  = $('#btn-close-panel');
  const panelToggle    = $('#btn-toggle-panel');
  const welcomeDiv     = $('#content-welcome');
  const monacoDiv      = $('#monaco-editor-host');
  const runBtn         = $('#btn-run-code');
  const clearBtn       = $('#btn-clear-output');
  const downloadBtn    = $('#btn-download-project');
  const sidebarRunBtn  = $('#sidebar-run-btn');
  const sidebarStopBtn = $('#sidebar-stop-btn');
  const terminalInput  = $('#terminal-input');
  const terminalOutput = $('#terminal-output');
  const outputArea     = $('#output-area');
  const paletteOverlay = $('#command-palette-overlay');
  const paletteInput   = $('#command-palette-input');
  const paletteList    = $('#command-palette-list');
  const toastContainer = $('#toast-container');
  const searchInput    = $('#search-input');
  const searchResults  = $('#search-results');
  const searchPlaceholder = $('#search-placeholder');
  const runStatusValue = $('#run-status-value');
  const runLangValue   = $('#run-lang-value');
  const runHistoryList = $('#run-history-list');
  const runHistoryPlaceholder = $('#run-history-placeholder');
  const statusLineCol  = $('#status-line-col');
  const statusLanguage = $('#status-language');
  const filetreeEl     = $('#filetree');
  const contextMenu    = $('#context-menu');
  const dialogOverlay  = $('#dialog-overlay');
  const dialogTitle    = $('#dialog-title');
  const dialogInput    = $('#dialog-input');
  const dialogConfirm  = $('#dialog-confirm');
  const dialogCancel   = $('#dialog-cancel');
  const btnNewFile     = $('#btn-new-file');
  const btnNewFolder   = $('#btn-new-folder');
  const btnDeleteAll   = $('#btn-delete-all');
  const previewIframe  = $('#preview-iframe');
  const btnRefreshPreview = $('#btn-refresh-preview');
  const btnOpenPreviewWin = $('#btn-open-preview-window');
  const themeSelector  = $('#theme-selector');

  // ── State ─────────────────────────────────────────────────────
  let activeActivity = 'explorer', activeTab = 'welcome', activeBTab = 'terminal';
  let panelCollapsed = false, sidebarOpen = true, paletteOpen = false, paletteIndex = 0;
  let isExecuting = false;
  let monacoEditor = null;
  const monacoModels = {};
  const openTabs = new Set(['welcome']);
  const termHistory = [];
  let termHistoryIdx = -1;
  let ctxTargetFile = null; // file targeted by context menu
  let dialogCallback = null;
  let currentTheme = localStorage.getItem('mcr_theme') || 'dark';

  // ═══════════════════════════════════════════
  //  THEME TOGGLE
  // ═══════════════════════════════════════════

  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mcr_theme', theme);
    if (themeSelector) themeSelector.value = theme;
    
    // Switch Monaco theme
    if (typeof monaco !== 'undefined') {
      const monacoThemeMap = {
        'light': 'vs',
        'dark': 'vs-dark',
        'dracula': 'dracula',
        'neon': 'neon'
      };
      monaco.editor.setTheme(monacoThemeMap[theme] || 'vs-dark');
    }
  }

  // Apply saved theme on load
  applyTheme(currentTheme);

  if (themeSelector) themeSelector.addEventListener('change', (e) => {
    applyTheme(e.target.value);
    showToast(`Switched to ${e.target.value} theme`, 'info');
  });

  // ══════════════════════════════════════════════════════════════
  //  LOCALSTORAGE FILE SYSTEM
  // ══════════════════════════════════════════════════════════════

  const FS_KEY = 'mcr_files';
  const FS_FOLDERS_KEY = 'mcr_folders';

  const DEFAULT_FILES = {
    'src/index.js': { language: 'javascript', content: `const express = require('express');\nconst app = express();\nconst PORT = 3000;\n\napp.use(express.json());\n\napp.get('/', (req, res) => {\n  res.json({ message: 'Hello, World!' });\n});\n\napp.get('/api/status', (req, res) => {\n  res.json({\n    status: 'running',\n    uptime: process.uptime(),\n    timestamp: new Date().toISOString()\n  });\n});\n\napp.listen(PORT, () => {\n  console.log(\`Server running on port \${PORT}\`);\n});` },
    'src/app.js': { language: 'javascript', content: `// Mini Code Runner – Try Ctrl+Enter to run!\n\nfunction fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nconst results = [];\nfor (let i = 0; i < 10; i++) {\n  results.push(fibonacci(i));\n}\n\nconsole.log('Fibonacci:', results.join(', '));\nconsole.log('Sum:', results.reduce((a, b) => a + b, 0));\n\nconst config = {\n  name: 'Mini Code Runner',\n  version: '1.0.0',\n  features: ['syntax highlighting', 'code execution', 'dark theme']\n};\nconsole.log('Config:', JSON.stringify(config, null, 2));\n\nconst nums = [1,2,3,4,5,6,7,8,9,10];\nconsole.log('Evens doubled:', nums.filter(n=>n%2===0).map(n=>n*2));` },
    'src/styles.css': { language: 'css', content: `/* Mini Code Runner Styles */\n:root {\n  --primary: #007acc;\n  --bg-dark: #1e1e1e;\n  --text-color: #cccccc;\n}\n\nbody {\n  font-family: 'Inter', sans-serif;\n  background: var(--bg-dark);\n  color: var(--text-color);\n}\n\n.btn {\n  padding: 8px 16px;\n  background: var(--primary);\n  color: white;\n  border: none;\n  border-radius: 4px;\n  cursor: pointer;\n}\n\n.btn:hover { background: #0098ff; }` },
    'public/index.html': { language: 'html', content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Mini Code Runner</title>\n  <link rel="stylesheet" href="styles.css" />\n</head>\n<body>\n  <div class="container">\n    <h1>Mini Code Runner</h1>\n    <p>Write and execute code in your browser</p>\n    <div id="editor"></div>\n    <button class="btn" id="run-btn">Run Code</button>\n  </div>\n  <script src="app.js"><\/script>\n</body>\n</html>` },
    'package.json': { language: 'json', content: `{\n  "name": "mini-code-runner",\n  "version": "1.0.0",\n  "description": "Browser-based code editor and runner",\n  "main": "src/index.js",\n  "scripts": {\n    "start": "node src/index.js",\n    "dev": "nodemon src/index.js",\n    "test": "jest --coverage"\n  },\n  "license": "MIT",\n  "dependencies": { "express": "^4.18.2" }\n}` },
    'README.md': { language: 'markdown', content: `# Mini Code Runner\n\nA browser-based code editor and runner built with Monaco Editor.\n\n## Features\n- **Code execution** – Run JavaScript in-browser\n- **Persistent files** – Stored in localStorage\n- **Syntax highlighting** – Via Monaco Editor\n- **Command palette** – Ctrl+Shift+P\n- **Interactive terminal** – Built-in CLI\n\n## Shortcuts\n| Key | Action |\n|-----|--------|\n| Ctrl+Enter | Run file |\n| Ctrl+Shift+P | Commands |\n| Ctrl+B | Sidebar |\n| Ctrl+\\\` | Terminal |` }
  };

  const DEFAULT_FOLDERS = ['src', 'public'];

  function fsLoad() {
    const raw = localStorage.getItem(FS_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function fsSave(files) { localStorage.setItem(FS_KEY, JSON.stringify(files)); }

  function foldersLoad() {
    const raw = localStorage.getItem(FS_FOLDERS_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function foldersSave(folders) { localStorage.setItem(FS_FOLDERS_KEY, JSON.stringify(folders)); }

  // Get or initialise files
  let FILES = fsLoad() || JSON.parse(JSON.stringify(DEFAULT_FILES));
  let FOLDERS = foldersLoad() || [...DEFAULT_FOLDERS];
  if (!fsLoad()) { fsSave(FILES); foldersSave(FOLDERS); }

  function inferLanguage(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const map = { js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript', py: 'python', css: 'css', html: 'html', json: 'json', md: 'markdown', xml: 'xml', txt: 'plaintext', svg: 'xml', yml: 'yaml', yaml: 'yaml' };
    return map[ext] || 'plaintext';
  }

  function languageDisplayName(langId) {
    const names = { javascript:'JavaScript', css:'CSS', html:'HTML', json:'JSON', markdown:'Markdown', python:'Python', typescript:'TypeScript', plaintext:'Plain Text', xml:'XML', yaml:'YAML' };
    return names[langId] || langId;
  }

  // ═══════════════════════════════════════════
  //  FILE CRUD OPERATIONS
  // ═══════════════════════════════════════════

  function createFile(filePath, content = '') {
    const lang = inferLanguage(filePath);
    FILES[filePath] = { language: lang, content };
    fsSave(FILES);
    // Create Monaco model
    if (typeof monaco !== 'undefined') {
      if (monacoModels[filePath]) monacoModels[filePath].dispose();
      monacoModels[filePath] = monaco.editor.createModel(content, lang, monaco.Uri.file(filePath));
      monacoModels[filePath].onDidChangeContent(() => autoSaveFile(filePath));
    }
    renderFileTree();
    showToast(`Created ${filePath}`, 'success');
    return filePath;
  }

  function deleteFile(filePath) {
    delete FILES[filePath];
    fsSave(FILES);
    // Dispose Monaco model
    if (monacoModels[filePath]) { monacoModels[filePath].dispose(); delete monacoModels[filePath]; }
    // Close tab if open
    closeTabById(filePath);
    renderFileTree();
    showToast(`Deleted ${filePath}`, 'info');
  }

  function renameFile(oldPath, newPath) {
    if (oldPath === newPath) return;
    if (FILES[newPath]) { showToast(`File ${newPath} already exists`, 'error'); return; }
    const data = FILES[oldPath];
    const newLang = inferLanguage(newPath);
    FILES[newPath] = { language: newLang, content: data.content };
    delete FILES[oldPath];
    fsSave(FILES);
    // Update Monaco model
    if (monacoModels[oldPath]) { monacoModels[oldPath].dispose(); delete monacoModels[oldPath]; }
    if (typeof monaco !== 'undefined') {
      monacoModels[newPath] = monaco.editor.createModel(data.content, newLang, monaco.Uri.file(newPath));
      monacoModels[newPath].onDidChangeContent(() => autoSaveFile(newPath));
    }
    // Update tab
    const tabEl = $(`.tabs__tab[data-tab="${CSS.escape(oldPath)}"]`, tabsContainer);
    if (tabEl) {
      tabEl.dataset.tab = newPath;
      const span = $('span', tabEl);
      if (span) span.textContent = newPath.split('/').pop();
      const closeBtn = $('.tabs__close', tabEl);
      if (closeBtn) closeBtn.dataset.close = newPath;
      tabEl.querySelector('.tabs__tab-icon')?.remove();
      tabEl.insertAdjacentHTML('afterbegin', getTabIcon(newPath));
      openTabs.delete(oldPath);
      openTabs.add(newPath);
    }
    if (activeTab === oldPath) {
      activeTab = newPath;
      monacoEditor?.setModel(monacoModels[newPath]);
      updateLanguageStatus(newLang);
    }
    renderFileTree();
    showToast(`Renamed to ${newPath}`, 'success');
  }

  function duplicateFile(filePath) {
    const ext = filePath.lastIndexOf('.');
    const base = ext > -1 ? filePath.slice(0, ext) : filePath;
    const extension = ext > -1 ? filePath.slice(ext) : '';
    let newPath = `${base}_copy${extension}`;
    let i = 2;
    while (FILES[newPath]) { newPath = `${base}_copy${i}${extension}`; i++; }
    createFile(newPath, FILES[filePath].content);
    openFileInTab(newPath);
  }

  function autoSaveFile(filePath) {
    if (FILES[filePath] && monacoModels[filePath]) {
      FILES[filePath].content = monacoModels[filePath].getValue();
      fsSave(FILES);
    }
  }

  function createFolder(name) {
    if (!FOLDERS.includes(name)) {
      FOLDERS.push(name);
      foldersSave(FOLDERS);
      renderFileTree();
      showToast(`Created folder ${name}`, 'success');
    }
  }

  function resetFiles() {
    FILES = JSON.parse(JSON.stringify(DEFAULT_FILES));
    FOLDERS = [...DEFAULT_FOLDERS];
    fsSave(FILES); foldersSave(FOLDERS);
    // Dispose all models
    Object.values(monacoModels).forEach(m => m.dispose());
    for (const k of Object.keys(monacoModels)) delete monacoModels[k];
    // Close all tabs
    $$('.tabs__tab', tabsContainer).forEach(t => { if (t.dataset.tab !== 'welcome') t.remove(); });
    openTabs.clear(); openTabs.add('welcome');
    activeTab = 'welcome';
    if (welcomeDiv) welcomeDiv.style.display = '';
    if (monacoDiv) monacoDiv.style.display = 'none';
    // Recreate models
    initModels();
    renderFileTree();
    showToast('Files reset to defaults', 'info');
  }

  // ═══════════════════════════════════════════
  //  FILE TREE RENDERING
  // ═══════════════════════════════════════════

  const FILE_ICONS = {
    js: { fill: '#e8d44d', text: 'JS', textFill: '#333', size: 10 },
    css: { fill: '#519aba', text: 'CSS', textFill: '#fff', size: 8 },
    html: { fill: '#e44d26', text: 'HTML', textFill: '#fff', size: 7 },
    json: { fill: '#8bc34a', text: '{ }', textFill: '#fff', size: 7 },
    md: { fill: '#42a5f5', text: 'MD', textFill: '#fff', size: 7 },
    py: { fill: '#3776ab', text: 'PY', textFill: '#fff', size: 9 },
    ts: { fill: '#3178c6', text: 'TS', textFill: '#fff', size: 9 },
    txt: { fill: '#888', text: 'TXT', textFill: '#fff', size: 7 },
  };

  function fileIconSvg(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const i = FILE_ICONS[ext];
    if (i) return `<svg class="filetree__icon" viewBox="0 0 24 24" width="16" height="16" fill="${i.fill}"><rect width="24" height="24" rx="3"/><text x="12" y="17" text-anchor="middle" fill="${i.textFill}" font-size="${i.size}" font-weight="bold">${i.text}</text></svg>`;
    return `<svg class="filetree__icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#569cd6" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
  }

  function folderIconSvg() {
    return `<svg class="filetree__icon" viewBox="0 0 24 24" width="16" height="16" fill="#dcb67a"><path d="M2 4a2 2 0 0 1 2-2h4.586a1 1 0 0 1 .707.293L11 4h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4z"/></svg>`;
  }

  function chevronSvg() {
    return `<svg class="filetree__chevron" viewBox="0 0 16 16" width="10" height="10" fill="currentColor"><path d="M5.354 11.354a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L7.793 8l-2.44 2.646a.5.5 0 0 0 0 .708z"/></svg>`;
  }

  function renderFileTree() {
    // Build tree structure
    const tree = {};
    const rootFiles = [];

    // Add folders first
    FOLDERS.forEach(f => { tree[f] = []; });

    // Add files
    Object.keys(FILES).sort().forEach(filePath => {
      const parts = filePath.split('/');
      if (parts.length > 1) {
        const folder = parts.slice(0, -1).join('/');
        if (!tree[folder]) { tree[folder] = []; FOLDERS.push(folder); foldersSave(FOLDERS); }
        tree[folder].push(filePath);
      } else {
        rootFiles.push(filePath);
      }
    });

    let html = '';
    // Render folders
    Object.keys(tree).sort().forEach(folderName => {
      const files = tree[folderName];
      html += `<li class="filetree__folder filetree__folder--open" data-folder="${folderName}">
        <span class="filetree__item">${chevronSvg()}${folderIconSvg()}<span class="filetree__name">${folderName}</span></span>
        <ul class="filetree__children">`;
      files.forEach(filePath => {
        const fileName = filePath.split('/').pop();
        const isActive = filePath === activeTab ? ' filetree__file--active' : '';
        html += `<li class="filetree__file${isActive}" data-file="${filePath}">
          <span class="filetree__item">${fileIconSvg(fileName)}<span class="filetree__name">${fileName}</span></span></li>`;
      });
      html += `</ul></li>`;
    });

    // Render root files
    rootFiles.forEach(filePath => {
      const fileName = filePath.split('/').pop();
      const isActive = filePath === activeTab ? ' filetree__file--active' : '';
      html += `<li class="filetree__file${isActive}" data-file="${filePath}">
        <span class="filetree__item">${fileIconSvg(fileName)}<span class="filetree__name">${fileName}</span></span></li>`;
    });

    filetreeEl.innerHTML = html;
  }

  // ═══════════════════════════════════════════
  //  TOAST SYSTEM
  // ═══════════════════════════════════════════

  const TOAST_ICONS = {
    success:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    warning:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
  };

  function showToast(message, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.innerHTML = `<span class="toast__icon">${TOAST_ICONS[type]||TOAST_ICONS.info}</span><span>${message}</span>`;
    toastContainer.appendChild(t);
    setTimeout(() => { if (t.parentElement) t.remove(); }, 3500);
  }

  // ═══════════════════════════════════════════
  //  DIALOG SYSTEM
  // ═══════════════════════════════════════════

  function showDialog(title, defaultValue, callback) {
    dialogTitle.textContent = title;
    dialogInput.value = defaultValue;
    dialogCallback = callback;
    dialogOverlay.classList.add('visible');
    setTimeout(() => {
      dialogInput.focus();
      dialogInput.select();
    }, 50);
  }

  function closeDialog() {
    dialogOverlay.classList.remove('visible');
    dialogCallback = null;
  }

  dialogConfirm.addEventListener('click', () => {
    if (dialogCallback) dialogCallback(dialogInput.value.trim());
    closeDialog();
  });
  dialogCancel.addEventListener('click', closeDialog);
  dialogInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); dialogConfirm.click(); }
    if (e.key === 'Escape') closeDialog();
  });
  dialogOverlay.addEventListener('click', (e) => { if (e.target === dialogOverlay) closeDialog(); });

  // ═══════════════════════════════════════════
  //  CONTEXT MENU
  // ═══════════════════════════════════════════

  function showContextMenu(x, y, filePath) {
    ctxTargetFile = filePath;
    contextMenu.style.left = Math.min(x, window.innerWidth - 180) + 'px';
    contextMenu.style.top = Math.min(y, window.innerHeight - 120) + 'px';
    contextMenu.classList.add('visible');
  }

  function hideContextMenu() { contextMenu.classList.remove('visible'); ctxTargetFile = null; }

  document.addEventListener('click', (e) => { if (!contextMenu.contains(e.target)) hideContextMenu(); });
  document.addEventListener('contextmenu', (e) => {
    const fileItem = e.target.closest('.filetree__file');
    if (fileItem) {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, fileItem.dataset.file);
    }
  });

  $('#ctx-rename').addEventListener('click', () => {
    if (!ctxTargetFile) return;
    const oldPath = ctxTargetFile;
    const oldName = oldPath.split('/').pop();
    hideContextMenu();
    showDialog('Rename File', oldName, (newName) => {
      if (!newName || newName === oldName) return;
      const dir = oldPath.includes('/') ? oldPath.slice(0, oldPath.lastIndexOf('/') + 1) : '';
      renameFile(oldPath, dir + newName);
    });
  });

  $('#ctx-delete').addEventListener('click', () => {
    if (!ctxTargetFile) return;
    const path = ctxTargetFile;
    hideContextMenu();
    if (confirm(`Delete "${path}"?`)) deleteFile(path);
  });

  $('#ctx-duplicate').addEventListener('click', () => {
    if (!ctxTargetFile) return;
    duplicateFile(ctxTargetFile);
    hideContextMenu();
  });

  // ═══════════════════════════════════════════
  //  TOOLBAR BUTTONS (New File, New Folder, Reset)
  // ═══════════════════════════════════════════

  btnNewFile.addEventListener('click', () => {
    showDialog('New File', 'untitled.js', (name) => {
      if (!name) return;
      if (FILES[name]) { showToast(`File "${name}" already exists`, 'warning'); return; }
      const path = createFile(name);
      openFileInTab(path);
    });
  });

  btnNewFolder.addEventListener('click', () => {
    showDialog('New Folder', 'new-folder', (name) => {
      if (!name) return;
      createFolder(name);
    });
  });

  btnDeleteAll.addEventListener('click', () => {
    if (confirm('Reset all files to defaults? Your changes will be lost.')) resetFiles();
  });

  // Welcome page links
  const linkNewFile = $('#link-new-file');
  if (linkNewFile) linkNewFile.addEventListener('click', (e) => { e.preventDefault(); btnNewFile.click(); });
  const linkOpenAppjs = $('#link-open-appjs');
  if (linkOpenAppjs) linkOpenAppjs.addEventListener('click', (e) => { e.preventDefault(); if (FILES['src/app.js']) openFileInTab('src/app.js'); });
  const linkOpenReadme = $('#link-open-readme');
  if (linkOpenReadme) linkOpenReadme.addEventListener('click', (e) => { e.preventDefault(); if (FILES['README.md']) openFileInTab('README.md'); });

  // ═══════════════════════════════════════════
  //  MONACO EDITOR
  // ═══════════════════════════════════════════

  function initModels() {
    Object.entries(FILES).forEach(([filePath, file]) => {
      if (!monacoModels[filePath]) {
        monacoModels[filePath] = monaco.editor.createModel(file.content, file.language, monaco.Uri.file(filePath));
        monacoModels[filePath].onDidChangeContent(() => autoSaveFile(filePath));
      }
    });
  }

  function initMonaco() {
    initModels();
    
    // Define Custom Themes
    monaco.editor.defineTheme('dracula', {
      base: 'vs-dark', inherit: true,
      rules: [ { background: '282A36' }, { token: 'comment', foreground: '6272A4' }, { token: 'keyword', foreground: 'FF79C6' }, { token: 'string', foreground: 'F1FA8C' }, { token: 'number', foreground: 'BD93F9' }, { token: 'type', foreground: '8BE9FD' } ],
      colors: { 'editor.background': '#282a36', 'editor.foreground': '#f8f8f2', 'editorLineNumber.foreground': '#6272a4', 'editorCursor.foreground': '#f8f8f0' }
    });
    monaco.editor.defineTheme('neon', {
      base: 'vs-dark', inherit: true,
      rules: [ { background: '0f0f14' }, { token: 'comment', foreground: '606080' }, { token: 'keyword', foreground: 'ff003c', fontStyle: 'bold' }, { token: 'string', foreground: '39ff14' }, { token: 'number', foreground: '00f0ff' }, { token: 'type', foreground: 'ff00ff' } ],
      colors: { 'editor.background': '#0f0f14', 'editor.foreground': '#eeeeee', 'editorLineNumber.foreground': '#606080', 'editorCursor.foreground': '#00f0ff' }
    });
    
    const monacoThemeMap = { 'light': 'vs', 'dark': 'vs-dark', 'dracula': 'dracula', 'neon': 'neon' };

    monacoEditor = monaco.editor.create(monacoDiv, {
      model: null, theme: monacoThemeMap[currentTheme] || 'vs-dark', fontSize: 13,
      fontFamily: "'Fira Code','Cascadia Code','Consolas',monospace", fontLigatures: true,
      lineNumbers: 'on', minimap: { enabled: true, scale: 1 },
      scrollBeyondLastLine: false, autoClosingBrackets: 'always', autoClosingQuotes: 'always',
      autoIndent: 'full', formatOnPaste: true, formatOnType: true, tabSize: 2,
      wordWrap: 'off', renderWhitespace: 'selection', smoothScrolling: true,
      cursorBlinking: 'smooth', cursorSmoothCaretAnimation: 'on',
      padding: { top: 8, bottom: 8 }, suggest: { showKeywords: true, showSnippets: true },
      bracketPairColorization: { enabled: true },
      quickSuggestions: { other: true, comments: false, strings: true },
    });
    monacoEditor.onDidChangeCursorPosition((e) => updateStatusBar(e.position.lineNumber, e.position.column));
    new ResizeObserver(() => { if (monacoDiv.style.display !== 'none') layoutEditor(); }).observe(monacoDiv);
    registerAICompletionProviders();
    renderFileTree();
    showToast('Editor ready', 'success');
  }

  function updateStatusBar(l, c) { if (statusLineCol) statusLineCol.textContent = `Ln ${l}, Col ${c}`; }
  function updateLanguageStatus(id) { if (statusLanguage) statusLanguage.textContent = languageDisplayName(id); }
  function layoutEditor() {
    if (!monacoEditor) return;
    const r = monacoDiv.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) monacoEditor.layout({ width: r.width, height: r.height });
  }

  // ═══════════════════════════════════════════
  //  TAB MANAGEMENT
  // ═══════════════════════════════════════════

  function getTabIcon(fileId) {
    const ext = fileId.split('.').pop().toLowerCase();
    const i = FILE_ICONS[ext];
    if (i) return `<svg class="tabs__tab-icon" viewBox="0 0 24 24" width="14" height="14" fill="${i.fill}"><rect width="24" height="24" rx="3"/><text x="12" y="17" text-anchor="middle" fill="${i.textFill}" font-size="${i.size}" font-weight="bold">${i.text}</text></svg>`;
    return `<svg class="tabs__tab-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#569cd6" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
  }

  function openFileInTab(fileId) {
    if (!FILES[fileId]) return;
    if (!openTabs.has(fileId)) {
      const tab = document.createElement('div');
      tab.className = 'tabs__tab';
      tab.dataset.tab = fileId;
      const displayName = fileId.split('/').pop();
      tab.innerHTML = `${getTabIcon(fileId)}<span>${displayName}</span>
        <button class="tabs__close" aria-label="Close tab" data-close="${fileId}">
          <svg viewBox="0 0 12 12" width="10" height="10"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        </button>`;
      tabsContainer.appendChild(tab);
      openTabs.add(fileId);
    }
    activateTab(fileId);
  }

  function activateTab(tabId) {
    activeTab = tabId;
    $$('.tabs__tab', tabsContainer).forEach(t => t.classList.toggle('tabs__tab--active', t.dataset.tab === tabId));
    const isFile = tabId !== 'welcome' && monacoModels[tabId];
    if (welcomeDiv) welcomeDiv.style.display = isFile ? 'none' : '';
    if (monacoDiv) monacoDiv.style.display = isFile ? '' : 'none';
    if (isFile) {
      monacoEditor.setModel(monacoModels[tabId]);
      const lang = FILES[tabId]?.language || 'plaintext';
      updateLanguageStatus(lang);
      if (runLangValue) runLangValue.textContent = languageDisplayName(lang);
      const pos = monacoEditor.getPosition();
      if (pos) updateStatusBar(pos.lineNumber, pos.column);
      requestAnimationFrame(() => { layoutEditor(); monacoEditor.focus(); });
    }
    // Highlight in file tree
    $$('.filetree__file', filetreeEl).forEach(f => f.classList.toggle('filetree__file--active', f.dataset.file === tabId));
  }

  function closeTabById(tabId) {
    const tab = $(`.tabs__tab[data-tab="${CSS.escape(tabId)}"]`, tabsContainer);
    if (tab) tab.remove();
    openTabs.delete(tabId);
    if (tabId === activeTab) {
      const remaining = $$('.tabs__tab', tabsContainer);
      if (remaining.length) activateTab(remaining[remaining.length - 1].dataset.tab);
      else { activeTab = ''; if (welcomeDiv) welcomeDiv.style.display = 'none'; if (monacoDiv) monacoDiv.style.display = 'none'; }
    }
  }

  tabsContainer.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('.tabs__close');
    if (closeBtn) { closeTabById(closeBtn.dataset.close); return; }
    const tab = e.target.closest('.tabs__tab');
    if (tab) activateTab(tab.dataset.tab);
  });

  // ═══════════════════════════════════════════
  //  ACTIVITY BAR
  // ═══════════════════════════════════════════
  activityIcons.forEach(icon => {
    icon.addEventListener('click', () => {
      const panel = icon.dataset.panel;
      if (panel === activeActivity && sidebarOpen) { toggleSidebar(); return; }
      activeActivity = panel;
      activityIcons.forEach(i => i.classList.remove('activitybar__icon--active'));
      icon.classList.add('activitybar__icon--active');
      $$('.sidebar__panel').forEach(p => p.classList.remove('sidebar__panel--active'));
      const target = $(`#panel-${panel}`);
      if (target) target.classList.add('sidebar__panel--active');
      sidebarLabel.textContent = panel.toUpperCase();
      if (!sidebarOpen) toggleSidebar(true);
    });
  });

  function toggleSidebar(forceOpen) {
    sidebarOpen = forceOpen === true ? true : !sidebarOpen;
    sidebar.classList.toggle('sidebar--collapsed', !sidebarOpen);
    setTimeout(layoutEditor, 300);
  }
  collapseBtn.addEventListener('click', () => toggleSidebar());

  // ═══════════════════════════════════════════
  //  FILE TREE CLICK (delegation)
  // ═══════════════════════════════════════════
  filetreeEl.addEventListener('click', (e) => {
    e.stopPropagation();
    const item = e.target.closest('.filetree__item');
    if (!item) return;
    const parent = item.parentElement;
    if (parent?.classList.contains('filetree__folder')) {
      const isDirectChild = item === parent.querySelector(':scope > .filetree__item');
      if (isDirectChild) { parent.classList.toggle('filetree__folder--open'); return; }
    }
    const file = item.closest('.filetree__file');
    if (file) {
      const fileId = file.dataset.file;
      if (fileId && FILES[fileId]) openFileInTab(fileId);
    }
  });

  // ═══════════════════════════════════════════
  //  BOTTOM PANEL
  // ═══════════════════════════════════════════
  $$('.bottompanel__tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const btab = tab.dataset.btab;
      activeBTab = btab;
      $$('.bottompanel__tab').forEach(t => t.classList.toggle('bottompanel__tab--active', t.dataset.btab === btab));
      $$('.bottompanel__content').forEach(c => c.classList.toggle('bottompanel__content--active', c.id === `bcontent-${btab}`));
    });
  });
  panelCloseBtn.addEventListener('click', () => setPanelCollapsed(true));
  panelToggle.addEventListener('click', () => setPanelCollapsed(!panelCollapsed));

  function setPanelCollapsed(c) {
    panelCollapsed = c;
    bottomPanel.classList.toggle('bottompanel--collapsed', c);
    resizeHandle.style.display = c ? 'none' : '';
    setTimeout(layoutEditor, 300);
  }

  // ═══════════════════════════════════════════
  //  CODE EXECUTION
  // ═══════════════════════════════════════════
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function addOutputEntry(content, type = 'log', fileName = '') {
    const ts = new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const e = document.createElement('div'); e.className = 'output-entry';
    e.innerHTML = `<div class="output-entry__header"><span class="output-entry__time">${ts}</span>${fileName?`<span class="output-entry__file">${fileName}</span>`:''}<span class="output-entry__type output-entry__type--${type}">${type}</span></div><div class="output-entry__content">${escapeHtml(String(content))}</div>`;
    outputArea.appendChild(e); outputArea.scrollTop = outputArea.scrollHeight;
  }

  function clearOutput() { outputArea.innerHTML = '<div class="terminal__line"><span class="terminal__info">[Ready] Output cleared.</span></div>'; showToast('Output cleared','info'); }

  // ═══════════════════════════════════════════
  //  PREVIEW HELPERS
  // ═══════════════════════════════════════════

  let lastPreviewHtml = '';

  function switchBottomTab(tabName) {
    activeBTab = tabName;
    $$('.bottompanel__tab').forEach(t => t.classList.toggle('bottompanel__tab--active', t.dataset.btab === tabName));
    $$('.bottompanel__content').forEach(c => c.classList.toggle('bottompanel__content--active', c.id === `bcontent-${tabName}`));
    if (panelCollapsed) setPanelCollapsed(false);
  }

  function renderPreview(htmlContent) {
    lastPreviewHtml = htmlContent;
    if (previewIframe) {
      previewIframe.srcdoc = htmlContent;
    }
  }

  function buildHtmlPreview(code, lang) {
    if (lang === 'html') {
      // Inject any same-name CSS/JS files from the virtual FS
      return code;
    }
    if (lang === 'css') {
      return `<!DOCTYPE html><html><head><style>${code}</style></head><body>
        <div style="font-family:sans-serif;padding:24px;">
          <h1>CSS Preview</h1>
          <p>Your styles are applied to this page.</p>
          <button class="btn">Sample Button</button>
          <div style="margin-top:16px;display:flex;gap:12px;">
            <div style="width:80px;height:80px;background:#007acc;border-radius:8px;"></div>
            <div style="width:80px;height:80px;background:#e44d26;border-radius:50%;"></div>
            <div style="width:80px;height:80px;background:#8bc34a;border-radius:8px;transform:rotate(15deg);"></div>
          </div>
        </div>
      </body></html>`;
    }
    return null;
  }

  // ═══════════════════════════════════════════
  //  PYTHON SIMULATOR
  // ═══════════════════════════════════════════

  function simulatePython(code) {
    const output = [];
    const lines = code.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // print(...)
      const printMatch = trimmed.match(/^print\s*\((.+)\)$/);
      if (printMatch) {
        let arg = printMatch[1].trim();
        // Handle f-strings (basic)
        arg = arg.replace(/^f['"](.+)['"]$/, '$1');
        // Strip quotes
        arg = arg.replace(/^['"]|['"]$/g, '');
        // Handle simple string concatenation
        arg = arg.replace(/['"]/g, '');
        output.push({ type: 'log', text: arg });
        continue;
      }

      // variable assignment
      const assignMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
      if (assignMatch) {
        output.push({ type: 'info', text: `${assignMatch[1]} = ${assignMatch[2]}` });
        continue;
      }

      // for/while/if/def/class
      if (/^(for|while|if|elif|else|def|class|import|from|try|except|with|return)\b/.test(trimmed)) {
        continue; // Skip control flow in simulation
      }
    }

    if (output.length === 0) {
      output.push({ type: 'info', text: '(No print statements found – Python simulation shows print() output only)' });
    }
    return output;
  }

  // ═══════════════════════════════════════════
  //  CODE EXECUTION ENGINE
  // ═══════════════════════════════════════════

  function addRunHistory(ok, ms) {
    if (runHistoryPlaceholder) runHistoryPlaceholder.style.display = 'none';
    const time = new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit'});
    const li = document.createElement('li'); li.className = 'run-history__item';
    li.innerHTML = `<span class="run-history__dot run-history__dot--${ok?'success':'error'}"></span><span class="run-history__file">${activeTab}</span><span class="run-history__time">${time} · ${ms}ms</span>`;
    runHistoryList.insertBefore(li, runHistoryList.firstChild);
  }

  function setRunState(running, ok) {
    isExecuting = running;
    runBtn.classList.toggle('running', running);
    if (sidebarStopBtn) sidebarStopBtn.disabled = !running;
    if (runStatusValue) {
      runStatusValue.textContent = running ? 'Running...' : (ok ? 'Completed' : 'Failed');
      runStatusValue.className = `run-panel__value run-panel__value--${running ? 'running' : (ok ? 'success' : 'error')}`;
    }
  }

  async function executeCode() {
    if (!monacoEditor || activeTab === 'welcome') { showToast('No file open to run','warning'); return; }
    const code = monacoEditor.getModel()?.getValue();
    const lang = FILES[activeTab]?.language;
    if (!code) return;

    const t0 = performance.now();
    setRunState(true, true);
    addOutputEntry(`▶ Executing ${activeTab}...`, 'info', activeTab);

    // ── HTML / CSS → iframe preview ──
    if (lang === 'html' || lang === 'css') {
      const previewHtml = buildHtmlPreview(code, lang);
      if (previewHtml) {
        renderPreview(previewHtml);
        switchBottomTab('preview');
        const ms = (performance.now() - t0).toFixed(1);
        addOutputEntry(`✓ Preview rendered in ${ms}ms`, 'info', activeTab);
        setRunState(false, true);
        addRunHistory(true, ms);
        showToast(`${activeTab} previewed (${ms}ms)`, 'success');
        return;
      }
    }

    // ── Python → simulated execution ──
    if (lang === 'python') {
      switchBottomTab('output');
      addOutputEntry('🐍 Python (simulated execution)', 'python', activeTab);
      const results = simulatePython(code);
      results.forEach(r => addOutputEntry(r.text, r.type, activeTab));
      const ms = (performance.now() - t0).toFixed(1);
      addOutputEntry(`✓ Simulation finished in ${ms}ms`, 'info', activeTab);
      setRunState(false, true);
      addRunHistory(true, ms);
      showToast(`${activeTab} simulated (${ms}ms)`, 'success');
      return;
    }

    // ── JSON → validate ──
    if (lang === 'json') {
      switchBottomTab('output');
      let ok = true;
      try { JSON.parse(code); addOutputEntry('✓ Valid JSON', 'log', activeTab); }
      catch(err) { ok = false; addOutputEntry(`Invalid JSON: ${err.message}`, 'error', activeTab); }
      const ms = (performance.now() - t0).toFixed(1);
      setRunState(false, ok);
      addRunHistory(ok, ms);
      showToast(ok ? 'Valid JSON' : 'Invalid JSON', ok ? 'success' : 'error');
      return;
    }

    // ── Markdown → preview ──
    if (lang === 'markdown') {
      // Simple markdown → HTML (basic conversion)
      let html = code
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code style="background:#f0f0f0;padding:2px 4px;border-radius:3px;">$1</code>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/\n/g, '<br>');
      html = `<!DOCTYPE html><html><head><style>body{font-family:'Inter',sans-serif;padding:24px;max-width:720px;line-height:1.6;color:#333;}h1,h2,h3{margin:16px 0 8px;}code{font-family:'Fira Code',monospace;}li{margin:4px 0;}</style></head><body>${html}</body></html>`;
      renderPreview(html);
      switchBottomTab('preview');
      const ms = (performance.now() - t0).toFixed(1);
      addOutputEntry(`✓ Markdown rendered in ${ms}ms`, 'info', activeTab);
      setRunState(false, true);
      addRunHistory(true, ms);
      showToast(`${activeTab} previewed`, 'success');
      return;
    }

    // ── JavaScript → execute with console capture ──
    switchBottomTab('output');

    const orig = { log:console.log, warn:console.warn, error:console.error, info:console.info, clear:console.clear };
    const capture = (m,t) => (...a) => { orig[m](...a); const msg = a.map(x => typeof x==='object'? JSON.stringify(x,null,2):String(x)).join(' '); addOutputEntry(msg,t,activeTab); };
    console.log = capture('log','log'); console.warn = capture('warn','warn'); console.error = capture('error','error'); console.info = capture('info','info'); console.clear = () => { orig.clear(); clearOutput(); };

    let ok = true;
    try { const r = new Function(code)(); if (r !== undefined) addOutputEntry(typeof r==='object'?JSON.stringify(r,null,2):String(r),'result',activeTab); }
    catch(err) { ok = false; addOutputEntry(`${err.name}: ${err.message}`,'error',activeTab); orig.error(err); }
    Object.assign(console, orig);

    const ms = (performance.now()-t0).toFixed(1);
    addOutputEntry(`✓ Finished in ${ms}ms`, ok?'info':'error', activeTab);
    setRunState(false, ok);
    addRunHistory(ok, ms);
    showToast(ok?`${activeTab} executed (${ms}ms)`:`${activeTab} failed`, ok?'success':'error');
  }

  if (runBtn) runBtn.addEventListener('click', executeCode);
  if (clearBtn) clearBtn.addEventListener('click', clearOutput);
  if (downloadBtn) downloadBtn.addEventListener('click', downloadProjectZip);
  if (sidebarRunBtn) sidebarRunBtn.addEventListener('click', executeCode);

  // Preview panel buttons
  if (btnRefreshPreview) btnRefreshPreview.addEventListener('click', () => {
    if (lastPreviewHtml) renderPreview(lastPreviewHtml);
    else executeCode();
  });
  if (btnOpenPreviewWin) btnOpenPreviewWin.addEventListener('click', () => {
    if (lastPreviewHtml) {
      const w = window.open('', '_blank', 'width=800,height=600');
      if (w) { w.document.open(); w.document.write(lastPreviewHtml); w.document.close(); }
    } else { showToast('Run a file first to generate preview', 'info'); }
  });

  // ═══════════════════════════════════════════
  //  INTERACTIVE TERMINAL
  // ═══════════════════════════════════════════
  const CMDS = {
    help: () => [{ type:'info', text:'Commands: help, clear, run, echo <text>, date, ls, cat <file>, touch <file>, rm <file>, mv <old> <new>, whoami, pwd, version, theme, zip, github' }],
    clear: () => { terminalOutput.innerHTML = ''; return []; },
    run: () => { executeCode(); return [{type:'success',text:'▶ Running...'}]; },
    echo: (a) => [{type:'text',text:a.join(' ')}],
    date: () => [{type:'info',text:new Date().toString()}],
    ls: () => [{type:'info',text:'Files:'}, ...Object.keys(FILES).map(f=>({type:'output',text:'  '+f}))],
    cat: (a) => { if(!a[0]) return [{type:'error',text:'Usage: cat <file>'}]; if(!FILES[a[0]]) return [{type:'error',text:`Not found: ${a[0]}`}]; return [{type:'info',text:`── ${a[0]} ──`},{type:'text',text:FILES[a[0]].content}]; },
    touch: (a) => { if(!a[0]) return [{type:'error',text:'Usage: touch <filename>'}]; if(FILES[a[0]]) return [{type:'warning',text:`Already exists: ${a[0]}`}]; createFile(a[0]); return [{type:'success',text:`Created ${a[0]}`}]; },
    rm: (a) => { if(!a[0]) return [{type:'error',text:'Usage: rm <file>'}]; if(!FILES[a[0]]) return [{type:'error',text:`Not found: ${a[0]}`}]; deleteFile(a[0]); return [{type:'success',text:`Deleted ${a[0]}`}]; },
    mv: (a) => { if(a.length<2) return [{type:'error',text:'Usage: mv <old> <new>'}]; if(!FILES[a[0]]) return [{type:'error',text:`Not found: ${a[0]}`}]; renameFile(a[0],a[1]); return [{type:'success',text:`Renamed ${a[0]} → ${a[1]}`}]; },
    whoami: () => [{type:'info',text:'developer@mini-code-runner'}],
    pwd: () => [{type:'info',text:'~/projects/mini-code-runner'}],
    version: () => [{type:'info',text:'Mini Code Runner v1.0.0'}],
    theme: () => { toggleTheme(); return [{type:'success',text:`Switched to ${currentTheme} theme`}]; },
  };

  function addTerminalLine(text, type='output') {
    const d = document.createElement('div'); d.className = 'terminal__line';
    const s = document.createElement('span'); s.className = `terminal__${type}`; s.textContent = text;
    d.appendChild(s); terminalOutput.appendChild(d); terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }

  function processCmd(input) {
    const t = input.trim(); if(!t) return;
    const cl = document.createElement('div'); cl.className = 'terminal__line';
    cl.innerHTML = `<span class="terminal__prompt">~/mini-code-runner $</span> <span class="terminal__text">${escapeHtml(t)}</span>`;
    terminalOutput.appendChild(cl);
    const [cmd,...args] = t.split(/\s+/);
    termHistory.push(t); termHistoryIdx = termHistory.length;
    const h = CMDS[cmd.toLowerCase()];
    if(h) h(args).forEach(r => addTerminalLine(r.text, r.type));
    else addTerminalLine(`Command not found: ${cmd}. Type 'help' for commands.`,'error');
    const blank = document.createElement('div'); blank.className = 'terminal__line'; blank.innerHTML = '<br/>';
    terminalOutput.appendChild(blank); terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }

  if (terminalInput) terminalInput.addEventListener('keydown', (e) => {
    if(e.key==='Enter') { e.preventDefault(); processCmd(terminalInput.value); terminalInput.value = ''; }
    else if(e.key==='ArrowUp') { e.preventDefault(); if(termHistoryIdx>0) { termHistoryIdx--; terminalInput.value = termHistory[termHistoryIdx]||''; } }
    else if(e.key==='ArrowDown') { e.preventDefault(); if(termHistoryIdx<termHistory.length-1) { termHistoryIdx++; terminalInput.value = termHistory[termHistoryIdx]||''; } else { termHistoryIdx=termHistory.length; terminalInput.value=''; } }
  });

  // ═══════════════════════════════════════════
  //  SEARCH
  // ═══════════════════════════════════════════
  if (searchInput) searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    searchResults.innerHTML = '';
    if(!q) { searchPlaceholder.style.display = ''; return; }
    searchPlaceholder.style.display = 'none';
    let found = 0;
    Object.entries(FILES).forEach(([fid,file]) => {
      file.content.split('\n').forEach((line,idx) => {
        if(line.toLowerCase().includes(q) && found < 20) {
          found++;
          const div = document.createElement('div'); div.className = 'search-result';
          const hl = line.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'gi'),'<span class="search-result__match">$1</span>');
          div.innerHTML = `<div class="search-result__file">${fid}:${idx+1}</div><div class="search-result__line">${hl}</div>`;
          div.addEventListener('click', () => { openFileInTab(fid); if(monacoEditor) { monacoEditor.revealLineInCenter(idx+1); monacoEditor.setPosition({lineNumber:idx+1,column:1}); monacoEditor.focus(); } });
          searchResults.appendChild(div);
        }
      });
    });
    if(!found) { searchPlaceholder.style.display=''; searchPlaceholder.textContent=`No results for "${searchInput.value}"`; }
  });

  // ═══════════════════════════════════════════
  //  COMMAND PALETTE
  // ═══════════════════════════════════════════
  function switchPanel(id) {
    activeActivity = id; activityIcons.forEach(i => i.classList.toggle('activitybar__icon--active', i.dataset.panel === id));
    $$('.sidebar__panel').forEach(p => p.classList.remove('sidebar__panel--active'));
    const t = $(`#panel-${id}`); if(t) t.classList.add('sidebar__panel--active');
    sidebarLabel.textContent = id.toUpperCase(); if(!sidebarOpen) toggleSidebar(true);
  }

  const COMMANDS = [
    { label:'New File', shortcut:'', icon:'📄', action: ()=>btnNewFile.click() },
    { label:'Run File', shortcut:'Ctrl+Enter', icon:'▶', action: executeCode },
    { label:'Clear Output', shortcut:'', icon:'✕', action: clearOutput },
    { label:'Toggle Sidebar', shortcut:'Ctrl+B', icon:'◧', action: ()=>toggleSidebar() },
    { label:'Toggle Terminal', shortcut:'Ctrl+`', icon:'⌨', action: ()=>setPanelCollapsed(!panelCollapsed) },
    { label:'Show Explorer', shortcut:'', icon:'📁', action: ()=>switchPanel('explorer') },
    { label:'Show Search', shortcut:'', icon:'🔍', action: ()=>switchPanel('search') },
    { label:'Reset Files', shortcut:'', icon:'🔄', action: resetFiles },
    { label:'Toggle Minimap', shortcut:'', icon:'🗺', action: ()=>{ if(monacoEditor){const m=monacoEditor.getOption(monaco.editor.EditorOption.minimap);monacoEditor.updateOptions({minimap:{enabled:!m.enabled}});showToast(`Minimap ${m.enabled?'disabled':'enabled'}`,'info');}}},
    { label:'Toggle Word Wrap', shortcut:'', icon:'↩', action: ()=>{ if(monacoEditor){const c=monacoEditor.getOption(monaco.editor.EditorOption.wordWrap);const n=c==='off'?'on':'off';monacoEditor.updateOptions({wordWrap:n});showToast(`Word wrap ${n}`,'info');}}},
    { label:'Increase Font Size', shortcut:'', icon:'A+', action: ()=>{ if(monacoEditor){const c=monacoEditor.getOption(monaco.editor.EditorOption.fontSize);monacoEditor.updateOptions({fontSize:c+1});showToast(`Font: ${c+1}px`,'info');}}},
    { label:'Decrease Font Size', shortcut:'', icon:'A-', action: ()=>{ if(monacoEditor){const c=monacoEditor.getOption(monaco.editor.EditorOption.fontSize);monacoEditor.updateOptions({fontSize:Math.max(8,c-1)});showToast(`Font: ${Math.max(8,c-1)}px`,'info');}}},
    { label:'Save File', shortcut:'Ctrl+S', icon:'💾', action: ()=>{ if(activeTab && activeTab !== 'welcome' && FILES[activeTab] && monacoModels[activeTab]) { FILES[activeTab].content = monacoModels[activeTab].getValue(); fsSave(FILES); showToast(`Saved ${activeTab}`, 'success'); }}},
    { label:'Find in File', shortcut:'Ctrl+F', icon:'🔎', action: ()=>{ if(monacoEditor && activeTab !== 'welcome') { monacoEditor.focus(); monacoEditor.getAction('actions.find').run(); }}},
    { label:'Find and Replace', shortcut:'Ctrl+H', icon:'🔄', action: ()=>{ if(monacoEditor && activeTab !== 'welcome') { monacoEditor.focus(); monacoEditor.getAction('editor.action.startFindReplaceAction').run(); }}},
    { label:'Toggle Theme', shortcut:'', icon:'🌓', action: toggleTheme },
  ];

  function openPalette() { paletteOpen=true; paletteOverlay.classList.add('visible'); paletteInput.value=''; paletteIndex=0; renderPalette(''); setTimeout(()=>paletteInput.focus(),50); }
  function closePalette() { paletteOpen=false; paletteOverlay.classList.remove('visible'); if(monacoEditor&&activeTab!=='welcome') monacoEditor.focus(); }

  function renderPalette(q) {
    const f = COMMANDS.filter(c => c.label.toLowerCase().includes(q.toLowerCase()));
    paletteList.innerHTML = '';
    paletteIndex = Math.min(paletteIndex, f.length-1); if(paletteIndex<0) paletteIndex=0;
    f.forEach((cmd,i) => {
      const li = document.createElement('li');
      li.className = `command-palette__item${i===paletteIndex?' command-palette__item--active':''}`;
      li.innerHTML = `<span class="command-palette__item-icon">${cmd.icon}</span><span class="command-palette__item-label">${cmd.label}</span>${cmd.shortcut?`<span class="command-palette__item-shortcut">${cmd.shortcut}</span>`:''}`;
      li.addEventListener('click', ()=>{ closePalette(); cmd.action(); });
      li.addEventListener('mouseenter', ()=>{ $$('.command-palette__item',paletteList).forEach(el=>el.classList.remove('command-palette__item--active')); li.classList.add('command-palette__item--active'); paletteIndex=i; });
      paletteList.appendChild(li);
    });
  }

  if(paletteInput) {
    paletteInput.addEventListener('input', ()=>{ paletteIndex=0; renderPalette(paletteInput.value); });
    paletteInput.addEventListener('keydown', (e)=>{
      const items = $$('.command-palette__item',paletteList);
      if(e.key==='ArrowDown') { e.preventDefault(); paletteIndex=Math.min(paletteIndex+1,items.length-1); items.forEach((el,i)=>el.classList.toggle('command-palette__item--active',i===paletteIndex)); items[paletteIndex]?.scrollIntoView({block:'nearest'}); }
      else if(e.key==='ArrowUp') { e.preventDefault(); paletteIndex=Math.max(paletteIndex-1,0); items.forEach((el,i)=>el.classList.toggle('command-palette__item--active',i===paletteIndex)); items[paletteIndex]?.scrollIntoView({block:'nearest'}); }
      else if(e.key==='Enter') { e.preventDefault(); items[paletteIndex]?.click(); }
      else if(e.key==='Escape') closePalette();
    });
  }
  if(paletteOverlay) paletteOverlay.addEventListener('click', (e)=>{ if(e.target===paletteOverlay) closePalette(); });

  // ═══════════════════════════════════════════
  //  RESIZE, SHORTCUTS, INIT
  // ═══════════════════════════════════════════
  let isResizing=false, startY=0, startH=0;
  resizeHandle.addEventListener('mousedown', (e)=>{ isResizing=true; startY=e.clientY; startH=bottomPanel.offsetHeight; resizeHandle.classList.add('resize-handle--active'); document.body.style.cursor='ns-resize'; document.body.style.userSelect='none'; e.preventDefault(); });
  document.addEventListener('mousemove', (e)=>{ if(!isResizing) return; const d=startY-e.clientY; bottomPanel.style.height=Math.max(80,Math.min(window.innerHeight*.6,startH+d))+'px'; layoutEditor(); });
  document.addEventListener('mouseup', ()=>{ if(!isResizing) return; isResizing=false; resizeHandle.classList.remove('resize-handle--active'); document.body.style.cursor=''; document.body.style.userSelect=''; layoutEditor(); });

  document.addEventListener('keydown', (e)=>{
    if(e.ctrlKey&&e.key==='b') { e.preventDefault(); toggleSidebar(); }
    if(e.ctrlKey&&e.key==='`') { e.preventDefault(); setPanelCollapsed(!panelCollapsed); }
    if(e.ctrlKey&&e.key==='Enter') { e.preventDefault(); executeCode(); }
    if(e.ctrlKey&&e.shiftKey&&e.key==='P') { e.preventDefault(); paletteOpen?closePalette():openPalette(); }
    if(e.key==='Escape') { if(paletteOpen) closePalette(); hideContextMenu(); }
    // Ctrl+S → save current file
    if(e.ctrlKey&&!e.shiftKey&&e.key==='s') {
      e.preventDefault();
      if(activeTab && activeTab !== 'welcome' && FILES[activeTab] && monacoModels[activeTab]) {
        FILES[activeTab].content = monacoModels[activeTab].getValue();
        fsSave(FILES);
        showToast(`Saved ${activeTab}`, 'success');
      }
    }
    // Ctrl+F → trigger Monaco find widget (Monaco handles this natively, just ensure no preventDefault)
    if(e.ctrlKey&&!e.shiftKey&&e.key==='f') {
      if(monacoEditor && activeTab !== 'welcome') {
        e.preventDefault();
        monacoEditor.focus();
        monacoEditor.getAction('actions.find').run();
      }
    }
    // Ctrl+H → trigger Monaco find & replace
    if(e.ctrlKey&&e.key==='h') {
      if(monacoEditor && activeTab !== 'welcome') {
        e.preventDefault();
        monacoEditor.focus();
        monacoEditor.getAction('editor.action.startFindReplaceAction').run();
      }
    }
  });

  window.addEventListener('resize', layoutEditor);

  // ═══════════════════════════════════════════
  //  AI CODE SUGGESTIONS (Monaco Completion)
  // ═══════════════════════════════════════════

  function registerAICompletionProviders() {
    if (typeof monaco === 'undefined') return;

    // ── Snippet-based suggestions (dropdown) ──
    const JS_SNIPPETS = [
      { label: 'clg', insert: 'console.log($1);', detail: 'console.log()' },
      { label: 'func', insert: 'function ${1:name}(${2:params}) {\n\t$0\n}', detail: 'Function declaration' },
      { label: 'afunc', insert: 'async function ${1:name}(${2:params}) {\n\t$0\n}', detail: 'Async function' },
      { label: 'arrow', insert: 'const ${1:name} = (${2:params}) => {\n\t$0\n};', detail: 'Arrow function' },
      { label: 'iife', insert: '(function() {\n\t$0\n})();', detail: 'IIFE' },
      { label: 'forloop', insert: 'for (let ${1:i} = 0; ${1:i} < ${2:arr}.length; ${1:i}++) {\n\t$0\n}', detail: 'For loop' },
      { label: 'foreach', insert: '${1:arr}.forEach((${2:item}) => {\n\t$0\n});', detail: 'forEach loop' },
      { label: 'map', insert: '${1:arr}.map((${2:item}) => {\n\t$0\n});', detail: 'Array.map()' },
      { label: 'filter', insert: '${1:arr}.filter((${2:item}) => {\n\t$0\n});', detail: 'Array.filter()' },
      { label: 'reduce', insert: '${1:arr}.reduce((${2:acc}, ${3:cur}) => {\n\t$0\n}, ${4:initial});', detail: 'Array.reduce()' },
      { label: 'promise', insert: 'new Promise((resolve, reject) => {\n\t$0\n});', detail: 'Promise' },
      { label: 'trycatch', insert: 'try {\n\t$1\n} catch (${2:err}) {\n\t$0\n}', detail: 'Try / Catch' },
      { label: 'class', insert: 'class ${1:Name} {\n\tconstructor(${2:params}) {\n\t\t$0\n\t}\n}', detail: 'Class' },
      { label: 'import', insert: "import { $1 } from '${2:module}';", detail: 'ES6 Import' },
      { label: 'export', insert: 'export default $1;', detail: 'Default export' },
      { label: 'fetch', insert: "fetch('${1:url}')\n\t.then(res => res.json())\n\t.then(data => {\n\t\t$0\n\t})\n\t.catch(err => console.error(err));", detail: 'Fetch API' },
      { label: 'ael', insert: "${1:el}.addEventListener('${2:event}', (${3:e}) => {\n\t$0\n});", detail: 'addEventListener' },
      { label: 'qs', insert: "document.querySelector('${1:selector}')", detail: 'querySelector' },
      { label: 'qsa', insert: "document.querySelectorAll('${1:selector}')", detail: 'querySelectorAll' },
      { label: 'timeout', insert: 'setTimeout(() => {\n\t$0\n}, ${1:1000});', detail: 'setTimeout' },
      { label: 'interval', insert: 'setInterval(() => {\n\t$0\n}, ${1:1000});', detail: 'setInterval' },
    ];

    const HTML_SNIPPETS = [
      { label: 'html5', insert: '<!DOCTYPE html>\n<html lang="en">\n<head>\n\t<meta charset="UTF-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\t<title>${1:Document}</title>\n</head>\n<body>\n\t$0\n</body>\n</html>', detail: 'HTML5 boilerplate' },
      { label: 'div', insert: '<div class="${1:class}">\n\t$0\n</div>', detail: '<div>' },
      { label: 'btn', insert: '<button class="${1:class}" id="${2:id}">$0</button>', detail: '<button>' },
      { label: 'link', insert: '<link rel="stylesheet" href="${1:styles.css}">', detail: '<link> stylesheet' },
      { label: 'script', insert: '<script src="${1:script.js}"></script>', detail: '<script>' },
      { label: 'img', insert: '<img src="${1:src}" alt="${2:alt}" />', detail: '<img>' },
      { label: 'input', insert: '<input type="${1:text}" id="${2:id}" placeholder="${3:placeholder}" />', detail: '<input>' },
      { label: 'form', insert: '<form action="${1:action}" method="${2:post}">\n\t$0\n</form>', detail: '<form>' },
      { label: 'ul', insert: '<ul>\n\t<li>$0</li>\n</ul>', detail: '<ul> List' },
      { label: 'a', insert: '<a href="${1:url}">$0</a>', detail: '<a> Link' },
    ];

    const CSS_SNIPPETS = [
      { label: 'flex', insert: 'display: flex;\nalign-items: ${1:center};\njustify-content: ${2:center};', detail: 'Flexbox center' },
      { label: 'grid', insert: 'display: grid;\ngrid-template-columns: ${1:repeat(3, 1fr)};\ngap: ${2:16px};', detail: 'CSS Grid' },
      { label: 'media', insert: '@media (max-width: ${1:768px}) {\n\t$0\n}', detail: 'Media query' },
      { label: 'transition', insert: 'transition: ${1:all} ${2:0.3s} ${3:ease};', detail: 'Transition' },
      { label: 'animation', insert: '@keyframes ${1:name} {\n\tfrom { $2 }\n\tto { $3 }\n}', detail: 'Keyframes' },
      { label: 'shadow', insert: 'box-shadow: ${1:0} ${2:4px} ${3:16px} ${4:rgba(0,0,0,.15)};', detail: 'Box shadow' },
      { label: 'gradient', insert: 'background: linear-gradient(${1:135deg}, ${2:#667eea}, ${3:#764ba2});', detail: 'Linear gradient' },
      { label: 'var', insert: 'var(--${1:name})', detail: 'CSS variable' },
      { label: 'center', insert: 'position: absolute;\ntop: 50%;\nleft: 50%;\ntransform: translate(-50%, -50%);', detail: 'Absolute center' },
    ];

    function makeProvider(snippets) {
      return {
        provideCompletionItems(model, position) {
          const word = model.getWordUntilPosition(position);
          const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
          return {
            suggestions: snippets.map(s => ({
              label: s.label, kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: s.insert, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: `⚡ ${s.detail}`, range,
              sortText: `0_${s.label}`,
            }))
          };
        }
      };
    }

    monaco.languages.registerCompletionItemProvider('javascript', makeProvider(JS_SNIPPETS));
    monaco.languages.registerCompletionItemProvider('html', makeProvider(HTML_SNIPPETS));
    monaco.languages.registerCompletionItemProvider('css', makeProvider(CSS_SNIPPETS));
    monaco.languages.registerCompletionItemProvider('typescript', makeProvider(JS_SNIPPETS));

    // ═══════════════════════════════════════════
    //  AI INLINE GHOST-TEXT AUTOCOMPLETE
    //  (Copilot-style: gray text → Tab to accept)
    // ═══════════════════════════════════════════

    const AI_PATTERNS = [
      // ── Variable declarations ──
      { re: /const\s+(\w+)\s*=\s*$/, fn: (m) => ({ 'app': "express();", 'router': "express.Router();", 'port': "process.env.PORT || 3000;", 'server': "http.createServer(app);", 'db': "new Database();", 'client': "new Client();", 'config': "{\n\t\n};", 'data': "[];", 'result': "null;", 'options': "{\n\t\n};", 'url': "'http://localhost:3000';", 'api': "'https://api.example.com';", 'token': "localStorage.getItem('token');", 'user': "null;", 'items': "[];", 'count': "0;", 'name': "'';", 'value': "0;" }[m[1]] || null) },
      { re: /let\s+(\w+)\s*=\s*$/, fn: (m) => ({ 'i': '0;', 'j': '0;', 'sum': '0;', 'count': '0;', 'result': "null;", 'temp': 'null;', 'flag': 'false;', 'index': '-1;', 'total': '0;', 'max': '0;', 'min': 'Infinity;' }[m[1]] || null) },

      // ── Function signatures ──
      { re: /function\s+(\w+)\s*\($/, fn: (m) => {
        const suggestions = { 'handle': 'req, res', 'render': 'data', 'process': 'input', 'calculate': 'a, b', 'validate': 'input', 'format': 'value', 'parse': 'str', 'convert': 'value', 'create': 'options', 'update': 'id, data', 'delete': 'id', 'find': 'query', 'get': 'id', 'set': 'key, value', 'init': '', 'start': '', 'stop': '', 'reset': '', 'load': 'path', 'save': 'data', 'fetch': 'url', 'send': 'data', 'receive': 'message' };
        return suggestions[m[1]] ? suggestions[m[1]] + ') {' : null;
      }},
      { re: /async\s+function\s+(\w+)\s*\($/, fn: (m) => {
        const s = { 'fetch': 'url) {\n\tconst response = await fetch(url);\n\treturn await response.json();', 'getData': ') {\n\ttry {\n\t\tconst res = await fetch(url);\n\t\treturn await res.json();\n\t} catch (err) {\n\t\tconsole.error(err);\n\t}', 'load': 'path) {', 'save': 'data) {', 'init': ') {', 'connect': ') {', 'process': 'data) {' };
        return s[m[1]] || null;
      }},

      // ── Common method chains ──
      { re: /\.then\(\s*$/, fn: () => 'res => res.json())' },
      { re: /\.then\(res\s*=>\s*$/, fn: () => 'res.json())' },
      { re: /\.then\(data\s*=>\s*\{\s*$/, fn: () => '\n\tconsole.log(data);\n})' },
      { re: /\.catch\(\s*$/, fn: () => 'err => console.error(err))' },
      { re: /\.filter\(\s*$/, fn: () => 'item => item)' },
      { re: /\.map\(\s*$/, fn: () => 'item => item)' },
      { re: /\.reduce\(\s*$/, fn: () => '(acc, cur) => acc + cur, 0)' },
      { re: /\.find\(\s*$/, fn: () => 'item => item.id === id)' },
      { re: /\.sort\(\s*$/, fn: () => '(a, b) => a - b)' },
      { re: /\.forEach\(\s*$/, fn: () => '(item, index) => {\n\t\n})' },
      { re: /\.addEventListener\(\s*$/, fn: () => "'click', (e) => {\n\t\n})" },
      { re: /\.addEventListener\('(\w+)',\s*$/, fn: (m) => `(e) => {\n\te.preventDefault();\n})` },
      { re: /\.replace\(\s*$/, fn: () => "//g, '')" },
      { re: /\.split\(\s*$/, fn: () => "'\\n')" },
      { re: /\.join\(\s*$/, fn: () => "', ')" },
      { re: /\.includes\(\s*$/, fn: () => "value)" },
      { re: /\.startsWith\(\s*$/, fn: () => "prefix)" },
      { re: /\.endsWith\(\s*$/, fn: () => "suffix)" },
      { re: /\.slice\(\s*$/, fn: () => "0, -1)" },
      { re: /\.splice\(\s*$/, fn: () => "index, 1)" },
      { re: /\.push\(\s*$/, fn: () => "item)" },
      { re: /\.indexOf\(\s*$/, fn: () => "value)" },
      { re: /\.substring\(\s*$/, fn: () => "0, 10)" },
      { re: /\.padStart\(\s*$/, fn: () => "2, '0')" },

      // ── Control structures ──
      { re: /if\s*\(\s*$/, fn: () => "condition) {\n\t\n}" },
      { re: /if\s*\(\s*(\w+)\s*$/, fn: (m) => {
        if (['err','error'].includes(m[1])) return ') {\n\tconsole.error(' + m[1] + ');\n\treturn;\n}';
        if (['data','result','res'].includes(m[1])) return ') {\n\tconsole.log(' + m[1] + ');\n}';
        if (m[1] === 'typeof') return " value === 'undefined') {\n\t\n}";
        return null;
      }},
      { re: /else\s+if\s*\($/, fn: () => "condition) {\n\t\n}" },
      { re: /else\s*\{$/, fn: () => "\n\t\n}" },
      { re: /for\s*\(\s*$/, fn: () => "let i = 0; i < arr.length; i++) {\n\t\n}" },
      { re: /for\s*\(\s*const\s+$/, fn: () => "item of items) {\n\t\n}" },
      { re: /for\s*\(\s*let\s+$/, fn: () => "i = 0; i < arr.length; i++) {\n\t\n}" },
      { re: /while\s*\(\s*$/, fn: () => "condition) {\n\t\n}" },
      { re: /switch\s*\(\s*$/, fn: () => "value) {\n\tcase 'a':\n\t\tbreak;\n\tdefault:\n\t\tbreak;\n}" },
      { re: /try\s*\{$/, fn: () => "\n\t\n} catch (err) {\n\tconsole.error(err);\n}" },

      // ── DOM ──
      { re: /document\.querySelector\(\s*$/, fn: () => "'#id')" },
      { re: /document\.querySelectorAll\(\s*$/, fn: () => "'.class')" },
      { re: /document\.getElementById\(\s*$/, fn: () => "'id')" },
      { re: /document\.createElement\(\s*$/, fn: () => "'div')" },
      { re: /document\.addEventListener\(\s*$/, fn: () => "'DOMContentLoaded', () => {\n\t\n})" },
      { re: /window\.addEventListener\(\s*$/, fn: () => "'load', () => {\n\t\n})" },
      { re: /e\.preventDefault\(\);\s*$/, fn: () => null },
      { re: /\.style\.\s*$/, fn: () => "display = 'none';" },
      { re: /\.classList\.\s*$/, fn: () => "add('active');" },
      { re: /\.innerHTML\s*=\s*$/, fn: () => "'<p>Content</p>';" },
      { re: /\.textContent\s*=\s*$/, fn: () => "'Text';" },
      { re: /\.setAttribute\(\s*$/, fn: () => "'class', 'value')" },
      { re: /\.getAttribute\(\s*$/, fn: () => "'data-id')" },

      // ── Console ──
      { re: /console\.log\(\s*$/, fn: () => ")" },
      { re: /console\.error\(\s*$/, fn: () => ")" },
      { re: /console\.warn\(\s*$/, fn: () => ")" },

      // ── Object/JSON ──
      { re: /JSON\.parse\(\s*$/, fn: () => "str)" },
      { re: /JSON\.stringify\(\s*$/, fn: () => "obj, null, 2)" },
      { re: /Object\.keys\(\s*$/, fn: () => "obj)" },
      { re: /Object\.values\(\s*$/, fn: () => "obj)" },
      { re: /Object\.entries\(\s*$/, fn: () => "obj)" },
      { re: /Object\.assign\(\s*$/, fn: () => "{}, source)" },
      { re: /Array\.from\(\s*$/, fn: () => "iterable)" },
      { re: /Array\.isArray\(\s*$/, fn: () => "value)" },

      // ── Math ──
      { re: /Math\.floor\(\s*$/, fn: () => "value)" },
      { re: /Math\.ceil\(\s*$/, fn: () => "value)" },
      { re: /Math\.round\(\s*$/, fn: () => "value)" },
      { re: /Math\.random\(\)\s*$/, fn: () => " * 100" },
      { re: /Math\.max\(\s*$/, fn: () => "a, b)" },
      { re: /Math\.min\(\s*$/, fn: () => "a, b)" },

      // ── Fetch / async ──
      { re: /await\s+fetch\(\s*$/, fn: () => "url);" },
      { re: /await\s+(\w+)\.json\(\);\s*$/, fn: () => null },
      { re: /const\s+response\s*=\s*await\s*$/, fn: () => "fetch(url);" },
      { re: /const\s+data\s*=\s*await\s*$/, fn: () => "response.json();" },
      { re: /fetch\('/, fn: () => null },

      // ── Return statements ──
      { re: /return\s+$/, fn: () => "null;" },
      { re: /return\s*\{$/, fn: () => "\n\t\n};" },
      { re: /return\s+new\s+$/, fn: () => "Promise((resolve, reject) => {\n\t\n});" },

      // ── Export / Import ──
      { re: /export\s+default\s+$/, fn: () => "function() {\n\t\n}" },
      { re: /export\s+const\s+$/, fn: () => "name = " },
      { re: /import\s+\{\s*$/, fn: () => " } from '';" },
      { re: /import\s+(\w+)\s+from\s*$/, fn: () => " '';" },
      { re: /from\s+'$/, fn: () => "module';" },
      { re: /require\(\s*$/, fn: () => "'module')" },

      // ── Arrow functions ──
      { re: /=>\s*\{\s*$/, fn: () => "\n\t\n}" },
      { re: /=>\s*$/, fn: () => "{\n\t\n}" },

      // ── Class methods ──
      { re: /constructor\(\s*$/, fn: () => "options) {\n\t\tthis.options = options;\n\t}" },
      { re: /this\.\s*$/, fn: () => "state = {};" },

      // ── Comments ──
      { re: /\/\/\s*TODO:\s*$/, fn: () => "implement this" },
      { re: /\/\/\s*FIXME:\s*$/, fn: () => "fix this issue" },
      { re: /\/\*\*\s*$/, fn: () => "\n * Description\n * @param {type} param\n * @returns {type}\n */" },

      // ── CSS property values ──
      { re: /display:\s*$/, fn: () => "flex;" },
      { re: /position:\s*$/, fn: () => "relative;" },
      { re: /justify-content:\s*$/, fn: () => "center;" },
      { re: /align-items:\s*$/, fn: () => "center;" },
      { re: /flex-direction:\s*$/, fn: () => "column;" },
      { re: /background:\s*$/, fn: () => "#ffffff;" },
      { re: /color:\s*$/, fn: () => "#333333;" },
      { re: /font-size:\s*$/, fn: () => "16px;" },
      { re: /font-weight:\s*$/, fn: () => "600;" },
      { re: /margin:\s*$/, fn: () => "0 auto;" },
      { re: /padding:\s*$/, fn: () => "16px;" },
      { re: /border:\s*$/, fn: () => "1px solid #ddd;" },
      { re: /border-radius:\s*$/, fn: () => "8px;" },
      { re: /width:\s*$/, fn: () => "100%;" },
      { re: /height:\s*$/, fn: () => "auto;" },
      { re: /overflow:\s*$/, fn: () => "hidden;" },
      { re: /cursor:\s*$/, fn: () => "pointer;" },
      { re: /opacity:\s*$/, fn: () => "1;" },
      { re: /z-index:\s*$/, fn: () => "10;" },
      { re: /gap:\s*$/, fn: () => "16px;" },
      { re: /transition:\s*$/, fn: () => "all 0.3s ease;" },
      { re: /transform:\s*$/, fn: () => "translateY(0);" },
      { re: /box-shadow:\s*$/, fn: () => "0 4px 16px rgba(0, 0, 0, 0.1);" },

      // ── Python ──
      { re: /def\s+(\w+)\s*\($/, fn: (m) => {
        const s = { 'init': 'self):', 'main': '):', 'process': 'data):', 'calculate': 'x, y):', 'get': 'self, key):', 'set': 'self, key, value):', 'run': 'self):', 'handle': 'request):', 'validate': 'input):' };
        return s[m[1]] || 'self):';
      }},
      { re: /class\s+(\w+)\s*$/, fn: () => ":\n\tdef __init__(self):\n\t\tpass" },
      { re: /print\(\s*$/, fn: () => ")" },
      { re: /for\s+(\w+)\s+in\s*$/, fn: () => "range(10):" },
      { re: /if\s+__name__\s*==\s*$/, fn: () => "'__main__':\n\tmain()" },
      { re: /import\s+$/, fn: () => "os" },
      { re: /from\s+(\w+)\s+import\s*$/, fn: () => "*" },
    ];

    // Debounce timer for inline suggestions
    let aiDebounce = null;
    let lastSuggestionText = '';

    function getAISuggestion(model, position) {
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);
      const trimmed = textBeforeCursor.trimStart();

      if (trimmed.length < 2) return null;

      for (const pattern of AI_PATTERNS) {
        const match = trimmed.match(pattern.re);
        if (match) {
          const suggestion = pattern.fn(match);
          if (suggestion) return suggestion;
        }
      }
      return null;
    }

    // Register inline completions provider (ghost text)
    const inlineProvider = {
      provideInlineCompletions(model, position, context, token) {
        const suggestion = getAISuggestion(model, position);
        if (!suggestion || token.isCancellationRequested) {
          return { items: [] };
        }

        lastSuggestionText = suggestion;
        return {
          items: [{
            insertText: suggestion,
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            },
          }],
        };
      },
      freeInlineCompletions() {},
    };

    // Register for all languages
    ['javascript', 'typescript', 'html', 'css', 'python', 'json'].forEach(lang => {
      monaco.languages.registerInlineCompletionsProvider(lang, inlineProvider);
    });

    showToast('AI Autocomplete enabled – suggestions appear as you type', 'info');
  }

  // ═══════════════════════════════════════════
  //  DOWNLOAD PROJECT AS ZIP
  // ═══════════════════════════════════════════

  async function downloadProjectZip() {
    if (typeof JSZip === 'undefined') { showToast('JSZip not loaded', 'error'); return; }
    const zip = new JSZip();
    for (const [path, file] of Object.entries(FILES)) {
      if (file.content !== undefined) {
        zip.file(path, file.content || '');
      }
    }
    try {
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'mini-code-runner-project.zip';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      showToast('Project downloaded as ZIP', 'success');
    } catch (err) {
      showToast(`ZIP failed: ${err.message}`, 'error');
    }
  }

  // ═══════════════════════════════════════════
  //  GITHUB REPOSITORY INTEGRATION
  // ═══════════════════════════════════════════

  const githubOverlay   = $('#github-dialog-overlay');
  const githubTokenIn   = $('#github-token-input');
  const githubRepoIn    = $('#github-repo-input');
  const githubCommitIn  = $('#github-commit-input');
  const githubSaveBtn   = $('#github-save-btn');
  const githubLoadBtn   = $('#github-load-btn');
  const githubCancelBtn = $('#github-dialog-cancel');

  function openGithubDialog() {
    if (githubOverlay) githubOverlay.classList.add('visible');
    const savedToken = localStorage.getItem('mcr_gh_token') || '';
    const savedRepo = localStorage.getItem('mcr_gh_repo') || '';
    if (githubTokenIn) githubTokenIn.value = savedToken;
    if (githubRepoIn) githubRepoIn.value = savedRepo;
  }
  function closeGithubDialog() { if (githubOverlay) githubOverlay.classList.remove('visible'); }

  if (githubCancelBtn) githubCancelBtn.addEventListener('click', closeGithubDialog);

  if (githubSaveBtn) githubSaveBtn.addEventListener('click', async () => {
    const token = githubTokenIn?.value?.trim();
    const repo = githubRepoIn?.value?.trim();
    const commitMsg = githubCommitIn?.value?.trim() || 'Update project files';

    if (!token || !repo) {
      showToast('Token and Repository name are required to commit.', 'warning');
      return;
    }

    localStorage.setItem('mcr_gh_token', token);
    localStorage.setItem('mcr_gh_repo', repo);

    const headers = { 
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };

    try {
      showToast('Preparing commit...', 'info');

      // 1. Get default branch
      let repoData = await fetch(`https://api.github.com/repos/${repo}`, { headers }).then(r => {
        if (!r.ok) throw new Error('Repository not found or no access');
        return r.json();
      });
      const branch = repoData.default_branch || 'main';

      // 2. Get latest commit SHA
      let refData = await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${branch}`, { headers }).then(r => r.json());
      const latestCommitSha = refData.object.sha;

      // 3. Get base tree SHA
      let commitData = await fetch(`https://api.github.com/repos/${repo}/git/commits/${latestCommitSha}`, { headers }).then(r => r.json());
      const baseTreeSha = commitData.tree.sha;

      // 4. Build new tree
      const newTree = [];
      for (const [path, file] of Object.entries(FILES)) {
        if (file.content !== undefined) {
          newTree.push({
            path: path,
            mode: '100644',
            type: 'blob',
            content: file.content || ''
          });
        }
      }

      showToast('Uploading files...', 'info');
      // 5. Create new tree
      let treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
        method: 'POST', headers,
        body: JSON.stringify({ base_tree: baseTreeSha, tree: newTree })
      });
      if (!treeRes.ok) throw new Error('Failed to create git tree');
      const newTreeData = await treeRes.json();
      const newTreeSha = newTreeData.sha;

      showToast('Creating commit...', 'info');
      // 6. Create commit
      let createCommitRes = await fetch(`https://api.github.com/repos/${repo}/git/commits`, {
        method: 'POST', headers,
        body: JSON.stringify({ message: commitMsg, tree: newTreeSha, parents: [latestCommitSha] })
      });
      if (!createCommitRes.ok) throw new Error('Failed to create commit');
      const newCommitData = await createCommitRes.json();
      const newCommitSha = newCommitData.sha;

      // 7. Update branch ref
      let updateRefRes = await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${branch}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ sha: newCommitSha })
      });
      if (!updateRefRes.ok) throw new Error('Failed to update branch reference');

      closeGithubDialog();
      showToast(`Successfully pushed to ${repo}`, 'success');

    } catch (err) {
      showToast(`Commit failed: ${err.message}`, 'error');
    }
  });

  if (githubLoadBtn) githubLoadBtn.addEventListener('click', async () => {
    const token = githubTokenIn?.value?.trim();
    const repo = githubRepoIn?.value?.trim();

    if (!repo) {
      showToast('Repository name is required to load.', 'warning');
      return;
    }

    if (token) localStorage.setItem('mcr_gh_token', token);
    localStorage.setItem('mcr_gh_repo', repo);

    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (token) headers['Authorization'] = `token ${token}`;

    try {
      showToast(`Fetching ${repo}...`, 'info');

      // 1. Get default branch
      let repoData = await fetch(`https://api.github.com/repos/${repo}`, { headers }).then(r => {
        if (!r.ok) throw new Error('Repository not found or no access');
        return r.json();
      });
      const branch = repoData.default_branch || 'main';

      // 2. Get tree recursively
      showToast('Loading file tree...', 'info');
      let treeData = await fetch(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`, { headers }).then(r => {
        if (!r.ok) throw new Error('Failed to fetch repository tree');
        return r.json();
      });

      const blobs = treeData.tree.filter(item => item.type === 'blob');
      if (blobs.length > 50) {
        if (!confirm(`This repository has ${blobs.length} files. Loading them all might be slow. Continue?`)) {
          return;
        }
      }

      showToast(`Downloading ${blobs.length} files...`, 'info');
      
      // Clear current workspace
      for (const key in FILES) delete FILES[key];

      // Download all blobs in parallel (chunked if too many, but `Promise.all` is fine for typical small repos)
      await Promise.all(blobs.map(async (blob) => {
        const path = blob.path;
        const ext = path.split('.').pop().toLowerCase();
        const langMap = {js:'javascript',ts:'typescript',py:'python',md:'markdown',json:'json',html:'html',css:'css',txt:'plaintext'};
        
        let content = '';
        try {
          // Fetch raw content
          let blobData = await fetch(blob.url, { headers }).then(r => r.json());
          // Content is base64 encoded
          content = decodeURIComponent(escape(atob(blobData.content)));
        } catch(e) {
          content = '// Failed to load binary/large content';
        }

        FILES[path] = {
          type: 'file',
          content: content,
          language: langMap[ext] || 'plaintext'
        };

        // Create parent folders
        const parts = path.split('/');
        if (parts.length > 1) {
          for (let i = 1; i < parts.length; i++) {
            const folder = parts.slice(0, i).join('/');
            if (!FILES[folder]) FILES[folder] = { type: 'folder' };
          }
        }
      }));

      fsSave(FILES);
      initModels();
      renderFileTree();
      closeGithubDialog();
      showToast(`Loaded ${blobs.length} files from ${repo}`, 'success');

    } catch (err) {
      showToast(`Load failed: ${err.message}`, 'error');
    }
  });

  // ═══════════════════════════════════════════
  //  DRAG & DROP FILE UPLOAD
  // ═══════════════════════════════════════════

  const dragDropOverlay = $('#dragdrop-overlay');
  let dragCounter = 0;

  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragDropOverlay) dragDropOverlay.classList.add('visible');
  });
  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) { dragCounter = 0; if (dragDropOverlay) dragDropOverlay.classList.remove('visible'); }
  });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    if (dragDropOverlay) dragDropOverlay.classList.remove('visible');

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    let loaded = 0;
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const ext = file.name.split('.').pop().toLowerCase();
        const langMap = {js:'javascript',ts:'typescript',py:'python',md:'markdown',json:'json',html:'html',css:'css',txt:'plaintext',jsx:'javascript',tsx:'typescript',scss:'scss',xml:'xml',yaml:'yaml',yml:'yaml',sh:'shell',bat:'bat'};
        FILES[file.name] = {
          type: 'file',
          content: ev.target.result,
          language: langMap[ext] || 'plaintext'
        };
        loaded++;
        if (loaded === files.length) {
          fsSave(FILES);
          initModels();
          renderFileTree();
          showToast(`Uploaded ${loaded} file${loaded > 1 ? 's' : ''}`, 'success');
          // Open the last dropped file
          openFileInTab(file.name);
        }
      };
      reader.readAsText(file);
    }
  });

  // ═══════════════════════════════════════════
  //  ADD COMMANDS TO PALETTE + TERMINAL
  // ═══════════════════════════════════════════

  COMMANDS.push(
    { label:'Download as ZIP', shortcut:'', icon:'📦', action: downloadProjectZip },
    { label:'GitHub: Repo Sync', shortcut:'', icon:'🐙', action: openGithubDialog },
  );

  CMDS['zip'] = () => { downloadProjectZip(); return [{type:'success',text:'Downloading project as ZIP...'}]; };
  CMDS['github'] = () => { openGithubDialog(); return [{type:'info',text:'Opening GitHub Repo dialog...'}]; };

  if (typeof monaco !== 'undefined') initMonaco();
})();
