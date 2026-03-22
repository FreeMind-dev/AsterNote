const { app, BrowserWindow, Menu, dialog, ipcMain, session, shell } = require('electron');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const packageMetadata = require('../package.json');
const { loadAiSessionStore, saveAiSessionStore } = require('./lib/ai-session-store.cjs');
const { createUpdateManager } = require('./lib/app-updates.cjs');
const { TerminalManager } = require('./lib/terminal.cjs');
const {
  buildSearchPlan,
  formatSearchContext,
  getDefaultSearchBaseUrl,
  getLastUserMessage,
  getSearchProviderLabel,
  sanitizeWebSearchConfig,
  searchWeb,
  validateWebSearch,
  webSearchForRenderer,
} = require('./lib/web-search.cjs');

const PRODUCT_NAME = 'AsterNote';
const PRODUCT_DESCRIPTION = 'A luminous desktop Markdown editor with AI and web-assisted writing tools.';
const PRODUCT_REPOSITORY_URL = packageMetadata?.repository?.url || packageMetadata?.homepage || '';
const LEGACY_USER_DATA_DIR_NAMES = ['asternote'];

const DEFAULT_SETTINGS = {
  theme: 'paper',
  fontSize: 16,
  uiLanguage: 'en',
  defaultViewMode: 'rich',
  recentFiles: [],
  aiProviders: [],
  webSearch: {
    enabled: false,
    provider: 'brave',
    baseUrl: getDefaultSearchBaseUrl('brave'),
    resultCount: 5,
    country: 'US',
    searchLang: 'en',
    searchEngineId: '',
    apiKey: '',
  },
  aiMemory: {
    enabled: true,
  },
};

const LEGACY_SEEDED_PROVIDER_SIGNATURES = {
  kimi: {
    name: 'Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'kimi-k2.5',
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
};

const BASE_AI_SYSTEM_PROMPT =
  'You are AsterNote, a concise writing assistant for Markdown authors. Return clean prose only unless the user explicitly asks for structure such as lists or tables.';

const QUICK_ACTION_PROMPTS = {
  polish:
    'Polish the selected text for clarity and flow. Keep the original meaning. Return only the revised text.',
  summarize:
    'Summarize the selected text into a compact, accurate version. Return only the summary.',
  translate:
    'Translate the selected text into polished English. Return only the translation.',
  continue:
    'Continue the draft in a matching tone and structure. Return only the next passage.',
  chat: '',
};

const MAIN_UI_TEXT = {
  en: {
    language: 'en',
    recentFilesEmpty: 'No Recent Files',
    unableToOpenFile: 'Unable to Open File',
    openMarkdownFiles: 'Open Markdown Files',
    markdown: 'Markdown',
    allFiles: 'All Files',
    saveMarkdownFile: 'Save Markdown File',
    exportHtml: 'Export HTML',
    exportPdf: 'Export PDF',
    html: 'HTML',
    pdf: 'PDF',
    insertImage: 'Insert Image',
    images: 'Images',
    apiKeyRequired: 'API key is required.',
    baseUrlRequired: 'Base URL is required.',
    connectionFailed: 'Connection failed.',
    connectionVerified: 'Connection verified.',
    webSearchApiKeyRequired: 'Search API key is required.',
    webSearchBaseUrlRequired: 'Search base URL is required.',
    searchEngineIdRequired: 'Google Search engine ID is required.',
    webSearchVerified: (provider, count) =>
      `${provider} search verified. Retrieved ${count} result${count === 1 ? '' : 's'}.`,
    webSearchValidationFailed: 'Search validation failed.',
    noAiProviderConfigured: 'No AI provider is configured.',
    envLoadedKey: 'Loaded from .env.local',
    aboutTitle: `About ${PRODUCT_NAME}`,
    updates: {
      currentVersion: (version) => `Current version: ${version}`,
      latestVersion: (version) => `Latest version: ${version}`,
      publishedAt: (value) => `Published: ${value}`,
      downloadAsset: (name, size) => `Download: ${name}${size ? ` (${size})` : ''}`,
      noDirectDownload: 'No direct installer was found for this platform.',
      releaseNotesLabel: 'Release notes:',
      updateAvailableTitle: 'Update Available',
      updateAvailableMessage: (name) => `${name} is ready to download.`,
      downloadNow: 'Download Update',
      openDirectDownload: 'Open Direct Download',
      openReleasePage: 'Open Download Page',
      later: 'Later',
      close: 'Close',
      upToDateTitle: 'You Are Up to Date',
      upToDateMessage: 'AsterNote is already on the latest available version.',
      checkFailedTitle: 'Unable to Check for Updates',
      checkFailedMessage: 'AsterNote could not reach the release server.',
      checkFailedFallback: 'Please try again later or open the download page manually.',
      downloadCompleteTitle: 'Update Downloaded',
      downloadCompleteMessage: 'The update package has been downloaded.',
      savedTo: (filePath) => `Saved to: ${filePath}`,
      installHint: 'Open the downloaded package to install the new version.',
      showInFolder: 'Show in Folder',
      downloadFailedTitle: 'Download Failed',
      downloadFailedMessage: 'AsterNote could not finish downloading the update package.',
      downloadFailedFallback: 'Open the download page and install the update manually.',
      downloadFailedState: (state) => `Download ended with state: ${state}`,
    },
    menu: {
      file: 'File',
      new: 'New',
      open: 'Open...',
      openRecent: 'Open Recent',
      closeTab: 'Close Tab',
      save: 'Save',
      saveAs: 'Save As...',
      saveAll: 'Save All',
      exportHtml: 'Export HTML...',
      exportPdf: 'Export PDF...',
      reveal: 'Reveal in Finder/Explorer',
      edit: 'Edit',
      undo: 'Undo',
      redo: 'Redo',
      cut: 'Cut',
      copy: 'Copy',
      paste: 'Paste',
      selectAll: 'Select All',
      find: 'Find',
      replace: 'Replace',
      view: 'View',
      toggleSidebar: 'Toggle Sidebar',
      toggleAiPanel: 'Toggle AI Panel',
      toggleTerminal: 'Toggle Terminal',
      toggleSourceMode: 'Toggle Source Mode',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      resetZoom: 'Reset Zoom',
      fullScreen: 'Full Screen',
      insert: 'Insert',
      heading1: 'Heading 1',
      heading2: 'Heading 2',
      heading3: 'Heading 3',
      bold: 'Bold',
      italic: 'Italic',
      code: 'Code',
      link: 'Link',
      image: 'Image',
      table: 'Table',
      blockquote: 'Blockquote',
      codeBlock: 'Code Block',
      horizontalRule: 'Horizontal Rule',
      math: 'Math',
      emoji: 'Emoji',
      ai: 'AI',
      askSelection: 'Ask About Selection',
      polishSelection: 'Polish Selection',
      summarizeSelection: 'Summarize Selection',
      translateSelection: 'Translate Selection',
      continueWriting: 'Continue Writing',
      aiSettings: 'AI Settings',
      settings: 'Settings',
      preferences: 'Preferences',
      theme: 'Theme',
      editorFontSize: 'Editor Font Size',
      aiProviders: 'AI Providers',
      webSearch: 'Web Search',
      resetPreferences: 'Reset Preferences',
      window: 'Window',
      minimize: 'Minimize',
      zoom: 'Zoom',
      bringAllToFront: 'Bring All to Front',
      help: 'Help',
      quickStart: 'Quick Start',
      keyboardShortcuts: 'Keyboard Shortcuts',
      checkForUpdates: 'Check for Updates...',
      releaseNotes: 'Release Notes',
    },
  },
  'zh-CN': {
    language: 'zh-CN',
    recentFilesEmpty: '没有最近文件',
    unableToOpenFile: '无法打开文件',
    openMarkdownFiles: '打开 Markdown 文件',
    markdown: 'Markdown',
    allFiles: '所有文件',
    saveMarkdownFile: '保存 Markdown 文件',
    exportHtml: '导出 HTML',
    exportPdf: '导出 PDF',
    html: 'HTML',
    pdf: 'PDF',
    insertImage: '插入图片',
    images: '图片',
    apiKeyRequired: '需要提供 API Key。',
    baseUrlRequired: '需要提供 Base URL。',
    connectionFailed: '连接失败。',
    connectionVerified: '连接验证成功。',
    webSearchApiKeyRequired: '需要提供搜索 API Key。',
    webSearchBaseUrlRequired: '需要提供搜索 Base URL。',
    searchEngineIdRequired: '需要提供 Google Search Engine ID。',
    webSearchVerified: (provider, count) => `${provider} 搜索验证成功。已获取 ${count} 条结果。`,
    webSearchValidationFailed: '搜索验证失败。',
    noAiProviderConfigured: '尚未配置可用的 AI 提供商。',
    envLoadedKey: '从 .env.local 加载',
    aboutTitle: `关于 ${PRODUCT_NAME}`,
    updates: {
      currentVersion: (version) => `当前版本：${version}`,
      latestVersion: (version) => `最新版本：${version}`,
      publishedAt: (value) => `发布时间：${value}`,
      downloadAsset: (name, size) => `下载包：${name}${size ? `（${size}）` : ''}`,
      noDirectDownload: '当前平台没有匹配的安装包，可打开下载页面查看。',
      releaseNotesLabel: '发行说明：',
      updateAvailableTitle: '发现新版本',
      updateAvailableMessage: (name) => `${name} 可以下载了。`,
      downloadNow: '下载更新',
      openDirectDownload: '打开直接下载链接',
      openReleasePage: '打开下载页面',
      later: '稍后',
      close: '关闭',
      upToDateTitle: '已是最新版本',
      upToDateMessage: 'AsterNote 当前已经是可用的最新版本。',
      checkFailedTitle: '无法检查更新',
      checkFailedMessage: 'AsterNote 暂时无法连接到发布服务器。',
      checkFailedFallback: '请稍后再试，或手动打开下载页面。',
      downloadCompleteTitle: '更新已下载',
      downloadCompleteMessage: '更新安装包已经下载完成。',
      savedTo: (filePath) => `保存位置：${filePath}`,
      installHint: '打开下载好的安装包即可安装新版本。',
      showInFolder: '在文件夹中显示',
      downloadFailedTitle: '下载失败',
      downloadFailedMessage: 'AsterNote 未能完成更新包下载。',
      downloadFailedFallback: '请打开下载页面手动下载安装。',
      downloadFailedState: (state) => `下载结束状态：${state}`,
    },
    menu: {
      file: '文件',
      new: '新建',
      open: '打开...',
      openRecent: '打开最近文件',
      closeTab: '关闭标签',
      save: '保存',
      saveAs: '另存为...',
      saveAll: '全部保存',
      exportHtml: '导出 HTML...',
      exportPdf: '导出 PDF...',
      reveal: '在文件夹中显示',
      edit: '编辑',
      undo: '撤销',
      redo: '重做',
      cut: '剪切',
      copy: '复制',
      paste: '粘贴',
      selectAll: '全选',
      find: '查找',
      replace: '替换',
      view: '视图',
      toggleSidebar: '切换侧栏',
      toggleAiPanel: '切换 AI 面板',
      toggleTerminal: '切换终端',
      toggleSourceMode: '切换源码模式',
      zoomIn: '放大',
      zoomOut: '缩小',
      resetZoom: '重置缩放',
      fullScreen: '全屏',
      insert: '插入',
      heading1: '一级标题',
      heading2: '二级标题',
      heading3: '三级标题',
      bold: '加粗',
      italic: '斜体',
      code: '代码',
      link: '链接',
      image: '图片',
      table: '表格',
      blockquote: '引用',
      codeBlock: '代码块',
      horizontalRule: '分隔线',
      math: '公式',
      emoji: '表情',
      ai: 'AI',
      askSelection: '询问所选内容',
      polishSelection: '润色所选内容',
      summarizeSelection: '总结所选内容',
      translateSelection: '翻译所选内容',
      continueWriting: '继续写作',
      aiSettings: 'AI 设置',
      settings: '设置',
      preferences: '偏好设置',
      theme: '主题',
      editorFontSize: '编辑器字号',
      aiProviders: 'AI 提供商',
      webSearch: '网页搜索',
      resetPreferences: '重置偏好设置',
      window: '窗口',
      minimize: '最小化',
      zoom: '缩放',
      bringAllToFront: '全部置前',
      help: '帮助',
      quickStart: '快速开始',
      keyboardShortcuts: '快捷键',
      checkForUpdates: '检查更新...',
      releaseNotes: '发行说明',
    },
  },
};

function canonicalUserDataPath() {
  return path.join(app.getPath('appData'), PRODUCT_NAME);
}

function legacyUserDataPaths() {
  return LEGACY_USER_DATA_DIR_NAMES
    .map((name) => path.join(app.getPath('appData'), name))
    .filter((dirPath, index, list) => list.indexOf(dirPath) === index && dirPath !== canonicalUserDataPath());
}

function configureUserDataPath() {
  const targetPath = canonicalUserDataPath();
  if (app.getPath('userData') !== targetPath) {
    app.setPath('userData', targetPath);
  }
}

configureUserDataPath();

function resolveUiLanguage(language) {
  return language === 'zh-CN' ? 'zh-CN' : 'en';
}

function getMainUi(language = loadSettings().uiLanguage) {
  return MAIN_UI_TEXT[resolveUiLanguage(language)];
}

let mainWindow = null;
let pendingOpenedFilePaths = [];
const terminalManager = new TerminalManager({
  sendData(payload) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('quietmark:terminal:data', payload);
  },
  sendExit(payload) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('quietmark:terminal:exit', payload);
  },
});
const updateManager = createUpdateManager({
  app,
  dialog,
  electronSession: session,
  getMainWindow: () => mainWindow,
  getUi: () => getMainUi(),
  productName: PRODUCT_NAME,
  repositoryUrl: PRODUCT_REPOSITORY_URL,
  shell,
});

function settingsPath() {
  return path.join(app.getPath('userData'), 'asternote-settings.json');
}

function aiSessionStorePath(userDataPath = app.getPath('userData')) {
  return path.join(userDataPath, 'asternote-ai-sessions.json');
}

function isMarkdownFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const ext = path.extname(filePath).toLowerCase();
  if (!['.md', '.markdown', '.mdown', '.mkd'].includes(ext)) return false;

  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function normalizeOpenableFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return '';
  const resolved = path.resolve(filePath);
  return isMarkdownFilePath(resolved) ? resolved : '';
}

function extractMarkdownPathsFromArgv(argv = []) {
  return argv
    .slice(1)
    .filter((arg) => typeof arg === 'string' && !arg.startsWith('-'))
    .map(normalizeOpenableFilePath)
    .filter(Boolean);
}

function queueOpenedFilePaths(filePaths = []) {
  const unique = new Set(pendingOpenedFilePaths);
  for (const filePath of filePaths.map(normalizeOpenableFilePath).filter(Boolean)) {
    unique.add(filePath);
  }
  pendingOpenedFilePaths = [...unique];
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function normalizeEnvSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function trimEnvValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseEnvLocalFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }

  const values = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value.replace(/\\n/g, '\n').trim();
  }

  return values;
}

function pushEnvLocalCandidates(candidates, seen, startPath, depth = 3) {
  if (!startPath) return;

  let current = path.resolve(startPath);
  for (let index = 0; index <= depth; index += 1) {
    const filePath = path.join(current, '.env.local');
    if (!seen.has(filePath)) {
      seen.add(filePath);
      candidates.push(filePath);
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function findEnvLocalPaths() {
  const candidates = [];
  const seen = new Set();

  if (!app.isPackaged) {
    try {
      pushEnvLocalCandidates(candidates, seen, process.cwd(), 3);
    } catch {}
    try {
      pushEnvLocalCandidates(candidates, seen, app.getAppPath(), 3);
    } catch {}
  }

  try {
    pushEnvLocalCandidates(candidates, seen, app.getPath('userData'), 1);
  } catch {}

  try {
    pushEnvLocalCandidates(candidates, seen, path.dirname(app.getPath('exe')), app.isPackaged ? 0 : 3);
  } catch {}

  if (process.env.APPIMAGE) {
    pushEnvLocalCandidates(candidates, seen, path.dirname(process.env.APPIMAGE), app.isPackaged ? 0 : 3);
  }

  return candidates.filter((filePath) => fs.existsSync(filePath));
}

function loadExternalSecrets() {
  const envFiles = findEnvLocalPaths();
  const merged = {};

  for (const filePath of envFiles) {
    Object.assign(merged, parseEnvLocalFile(filePath));
  }

  const providerApiKeys = {};
  for (const [key, value] of Object.entries(merged)) {
    const providerMatch = key.match(/^ASTERNOTE_PROVIDER_([A-Z0-9_]+)_API_KEY$/);
    if (providerMatch) {
      providerApiKeys[providerMatch[1]] = trimEnvValue(value);
      continue;
    }

    const shortProviderMatch = key.match(/^ASTERNOTE_([A-Z0-9_]+)_API_KEY$/);
    if (shortProviderMatch && shortProviderMatch[1] !== 'WEB_SEARCH') {
      providerApiKeys[shortProviderMatch[1]] = trimEnvValue(value);
    }
  }

  return {
    envFiles,
    providerApiKeys,
    values: merged,
  };
}

function resolveProviderEnvApiKey(secrets, providerId) {
  return trimEnvValue(secrets.providerApiKeys[normalizeEnvSegment(providerId)]);
}

function resolveWebSearchEnvApiKey(secrets, provider) {
  return trimEnvValue(
    secrets.values.ASTERNOTE_WEB_SEARCH_API_KEY
      || secrets.values[`ASTERNOTE_${normalizeEnvSegment(provider)}_SEARCH_API_KEY`]
  );
}

function resolveWebSearchEnvSearchEngineId(secrets) {
  return trimEnvValue(secrets.values.ASTERNOTE_WEB_SEARCH_SEARCH_ENGINE_ID);
}

function applyExternalSecrets(settings, secrets = loadExternalSecrets()) {
  const aiProviders = settings.aiProviders.map((provider) => {
    const envApiKey = resolveProviderEnvApiKey(secrets, provider.id);
    if (!envApiKey) return provider;
    return {
      ...provider,
      apiKey: envApiKey,
    };
  });

  const webSearchApiKey = resolveWebSearchEnvApiKey(secrets, settings.webSearch.provider);
  const webSearchSearchEngineId = resolveWebSearchEnvSearchEngineId(secrets);

  return {
    ...settings,
    aiProviders,
    webSearch: {
      ...settings.webSearch,
      apiKey: webSearchApiKey || settings.webSearch.apiKey,
      searchEngineId: webSearchSearchEngineId || settings.webSearch.searchEngineId,
    },
  };
}

function mergeSettings(raw) {
  const base = structuredClone(DEFAULT_SETTINGS);
  if (!raw || typeof raw !== 'object') {
    return base;
  }

  const mergedProviders =
    Array.isArray(raw.aiProviders) && raw.aiProviders.length > 0
      ? ensureSingleDefault(
          pruneUnconfiguredSeededProviders(
            raw.aiProviders.map((provider, index) => sanitizeProvider(provider, index, {}))
          )
        )
      : base.aiProviders;

  return {
    ...base,
    ...raw,
    uiLanguage: raw.uiLanguage === 'zh-CN' ? 'zh-CN' : base.uiLanguage,
    recentFiles: Array.isArray(raw.recentFiles)
      ? raw.recentFiles.filter((item) => typeof item === 'string')
      : base.recentFiles,
    aiProviders: mergedProviders,
    webSearch: sanitizeWebSearchConfig(raw.webSearch, base.webSearch),
    aiMemory: {
      enabled:
        typeof raw.aiMemory?.enabled === 'boolean'
          ? raw.aiMemory.enabled
          : base.aiMemory.enabled,
    },
  };
}

function loadStoredSettings() {
  try {
    if (!fs.existsSync(settingsPath())) {
      return structuredClone(DEFAULT_SETTINGS);
    }

    const raw = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
    const merged = mergeSettings(raw);
    if (JSON.stringify(raw) !== JSON.stringify(merged)) {
      saveSettings(merged);
    }
    return merged;
  } catch (error) {
    console.error('[QuietMark] Failed to load settings:', error);
    return structuredClone(DEFAULT_SETTINGS);
  }
}

function loadSettings() {
  return applyExternalSecrets(loadStoredSettings());
}

function saveSettings(settings) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), 'utf8');
}

function migrateLegacyUserData() {
  const targetDir = app.getPath('userData');
  fs.mkdirSync(targetDir, { recursive: true });

  const targetSettingsPath = settingsPath();
  const targetSessionPath = aiSessionStorePath(targetDir);

  for (const legacyDir of legacyUserDataPaths()) {
    if (!fs.existsSync(legacyDir)) continue;

    const legacySettingsPath = path.join(legacyDir, 'asternote-settings.json');
    if (!fs.existsSync(targetSettingsPath) && fs.existsSync(legacySettingsPath)) {
      try {
        const rawSettings = JSON.parse(fs.readFileSync(legacySettingsPath, 'utf8'));
        saveSettings(mergeSettings(rawSettings));
      } catch (error) {
        console.error('[AsterNote] Failed to migrate legacy settings:', error);
      }
    }

    const legacySessionPath = aiSessionStorePath(legacyDir);
    if (!fs.existsSync(targetSessionPath) && fs.existsSync(legacySessionPath)) {
      try {
        fs.copyFileSync(legacySessionPath, targetSessionPath);
      } catch (error) {
        console.error('[AsterNote] Failed to migrate legacy AI sessions:', error);
      }
    }
  }
}

function maskApiKey(apiKey) {
  if (!apiKey) return '';
  if (apiKey.length <= 8) return '••••••••';
  return `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}`;
}

function sanitizeProvider(provider, index, previousById = {}) {
  const previous = provider?.id ? previousById[provider.id] : undefined;
  const nextId = String(provider?.id || previous?.id || `provider-${index + 1}`).trim();
  const incomingKey =
    typeof provider?.apiKey === 'string' ? provider.apiKey.trim() : undefined;

  return {
    id: nextId,
    name: String(provider?.name || previous?.name || `Provider ${index + 1}`).trim(),
    baseUrl: String(provider?.baseUrl || previous?.baseUrl || '').trim().replace(/\/$/, ''),
    model: String(provider?.model || previous?.model || '').trim(),
    apiKey:
      incomingKey === undefined || incomingKey === ''
        ? String(previous?.apiKey || '')
        : incomingKey,
    enabled: provider?.enabled ?? previous?.enabled ?? true,
    isDefault: provider?.isDefault ?? previous?.isDefault ?? false,
  };
}

function isLegacySeededProvider(provider) {
  const signature = LEGACY_SEEDED_PROVIDER_SIGNATURES[provider?.id];
  if (!signature) return false;

  return !provider.apiKey
    && provider.name === signature.name
    && provider.baseUrl === signature.baseUrl
    && provider.model === signature.model;
}

function pruneUnconfiguredSeededProviders(providers) {
  return providers.filter((provider) => !isLegacySeededProvider(provider));
}

function ensureSingleDefault(providers) {
  const enabledProviders = providers.filter((provider) => provider.enabled);
  if (enabledProviders.length === 0) {
    return providers.map((provider, index) => ({
      ...provider,
      isDefault: index === 0,
    }));
  }

  let sawDefault = false;
  return providers.map((provider) => {
    if (!provider.enabled) {
      return { ...provider, isDefault: false };
    }

    if (provider.isDefault && !sawDefault) {
      sawDefault = true;
      return provider;
    }

    return { ...provider, isDefault: false };
  }).map((provider, index, list) => {
    if (sawDefault) return provider;
    const firstEnabled = list.find((item) => item.enabled);
    return provider.id === firstEnabled?.id ? { ...provider, isDefault: true } : provider;
  });
}

function settingsForRenderer(settings = loadStoredSettings()) {
  const resolved = applyExternalSecrets(settings);

  return {
    theme: resolved.theme,
    fontSize: resolved.fontSize,
    uiLanguage: resolved.uiLanguage,
    defaultViewMode: resolved.defaultViewMode,
    recentFiles: resolved.recentFiles,
    aiProviders: resolved.aiProviders.map((provider) => {
      return {
        id: provider.id,
        name: provider.name,
        baseUrl: provider.baseUrl,
        model: provider.model,
        enabled: provider.enabled,
        isDefault: provider.isDefault,
        hasApiKey: Boolean(provider.apiKey),
        apiKeyMasked: maskApiKey(provider.apiKey),
      };
    }),
    webSearch: (() => {
      const next = webSearchForRenderer(resolved.webSearch);
      return {
        ...next,
        hasApiKey: Boolean(resolved.webSearch.apiKey),
        apiKeyMasked: maskApiKey(resolved.webSearch.apiKey),
      };
    })(),
    aiMemory: {
      enabled: Boolean(resolved.aiMemory?.enabled),
    },
  };
}

function updateStoredSettings(partial) {
  const current = loadStoredSettings();
  const previousById = Object.fromEntries(current.aiProviders.map((provider) => [provider.id, provider]));

  const nextProviders = Array.isArray(partial?.aiProviders)
    ? ensureSingleDefault(
        pruneUnconfiguredSeededProviders(
          partial.aiProviders.map((provider, index) => sanitizeProvider(provider, index, previousById))
        )
      )
    : current.aiProviders;

  const next = {
    ...current,
    theme: partial?.theme ?? current.theme,
    fontSize:
      typeof partial?.fontSize === 'number' && Number.isFinite(partial.fontSize)
        ? partial.fontSize
        : current.fontSize,
    uiLanguage:
      partial?.uiLanguage === 'zh-CN'
        ? 'zh-CN'
        : partial?.uiLanguage === 'en'
          ? 'en'
          : current.uiLanguage,
    defaultViewMode:
      partial?.defaultViewMode === 'source' ? 'source' : partial?.defaultViewMode === 'rich'
        ? 'rich'
        : current.defaultViewMode,
    recentFiles: Array.isArray(partial?.recentFiles) ? partial.recentFiles : current.recentFiles,
    aiProviders: nextProviders,
    webSearch: partial?.webSearch
      ? sanitizeWebSearchConfig(partial.webSearch, current.webSearch)
      : current.webSearch,
    aiMemory: {
      enabled:
        typeof partial?.aiMemory?.enabled === 'boolean'
          ? partial.aiMemory.enabled
          : current.aiMemory.enabled,
    },
  };

  saveSettings(next);
  return next;
}

function updateRecentFiles(filePath) {
  if (!filePath) return loadStoredSettings().recentFiles;

  const current = loadStoredSettings();
  const recentFiles = [filePath, ...current.recentFiles.filter((item) => item !== filePath)].slice(0, 10);
  const next = { ...current, recentFiles };
  saveSettings(next);
  if (mainWindow) {
    buildMenu();
  }
  return recentFiles;
}

async function readFileEntry(filePath) {
  const stats = await fsp.stat(filePath);
  const content = await fsp.readFile(filePath, 'utf8');

  return {
    path: filePath,
    name: path.basename(filePath),
    content,
    lastModified: stats.mtime.toISOString(),
  };
}

async function loadEntriesFromPaths(filePaths = []) {
  const entries = [];

  for (const filePath of [...new Set(filePaths.map(normalizeOpenableFilePath).filter(Boolean))]) {
    try {
      entries.push(await readFileEntry(filePath));
      updateRecentFiles(filePath);
    } catch (error) {
      console.error('[AsterNote] Failed to open associated file:', filePath, error);
    }
  }

  if (entries.length > 0) {
    buildMenu();
  }

  return entries;
}

async function consumePendingOpenedEntries() {
  const queued = pendingOpenedFilePaths;
  pendingOpenedFilePaths = [];
  return loadEntriesFromPaths(queued);
}

async function flushPendingOpenedFiles() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.webContents.isLoadingMainFrame()) return;

  const entries = await consumePendingOpenedEntries();
  if (entries.length > 0) {
    mainWindow.webContents.send('quietmark:files-opened', entries);
  }
}

async function openFilesDialog() {
  if (!mainWindow) return [];
  const ui = getMainUi();

  const result = await dialog.showOpenDialog(mainWindow, {
    title: ui.openMarkdownFiles,
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: ui.markdown, extensions: ['md', 'markdown', 'mdown', 'mkd'] },
      { name: ui.allFiles, extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return [];
  }

  const entries = [];
  for (const filePath of result.filePaths) {
    entries.push(await readFileEntry(filePath));
    updateRecentFiles(filePath);
  }

  buildMenu();
  return entries;
}

async function openFileFromPath(filePath) {
  const entry = await readFileEntry(filePath);
  updateRecentFiles(filePath);
  buildMenu();
  return entry;
}

async function saveMarkdownFile(filePath, content) {
  await fsp.writeFile(filePath, content, 'utf8');
  const stats = await fsp.stat(filePath);
  updateRecentFiles(filePath);
  buildMenu();
  return {
    path: filePath,
    name: path.basename(filePath),
    lastModified: stats.mtime.toISOString(),
  };
}

function ensureMarkdownExtension(filePath) {
  if (!filePath) return filePath;
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.md' || ext === '.markdown' ? filePath : `${filePath}.md`;
}

function resolveAssetPath(documentPath, assetPath) {
  if (!assetPath) return '';
  if (!documentPath) {
    return path.basename(assetPath).replace(/\\/g, '/');
  }
  return path.relative(path.dirname(documentPath), assetPath).replace(/\\/g, '/');
}

function buildExportHtmlPage(innerHtml) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${PRODUCT_NAME} Export</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #1b1e24;
        --paper: #f7f2e8;
        --rule: #d6cfbe;
        --accent: #20596c;
      }
      body {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
        background: var(--paper);
        color: var(--ink);
      }
      main {
        max-width: 860px;
        margin: 0 auto;
        padding: 64px 56px 88px;
        line-height: 1.8;
        font-size: 18px;
      }
      h1, h2, h3, h4, h5, h6 {
        font-family: "Avenir Next", "Segoe UI", sans-serif;
        line-height: 1.2;
        letter-spacing: -0.02em;
        margin-top: 2em;
        margin-bottom: 0.75em;
      }
      h1 { font-size: 2.3rem; }
      h2 { font-size: 1.75rem; border-top: 1px solid var(--rule); padding-top: 1.25rem; }
      h3 { font-size: 1.35rem; }
      a { color: var(--accent); }
      blockquote {
        margin: 1.5rem 0;
        padding-left: 1rem;
        border-left: 3px solid var(--accent);
        color: #39444f;
      }
      pre, code {
        font-family: "SFMono-Regular", Menlo, Consolas, monospace;
      }
      pre {
        background: #f0eadf;
        border: 1px solid var(--rule);
        border-radius: 12px;
        padding: 1rem;
        overflow: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 1.5rem 0;
      }
      th, td {
        border: 1px solid var(--rule);
        padding: 0.6rem 0.75rem;
        text-align: left;
      }
      img {
        max-width: 100%;
        border-radius: 12px;
      }
      hr {
        border: 0;
        border-top: 1px solid var(--rule);
        margin: 2rem 0;
      }
      .qm-math {
        display: inline-block;
        padding: 0.1rem 0.35rem;
        background: rgba(32, 89, 108, 0.08);
        border-radius: 0.35rem;
      }
      .qm-math-block {
        display: block;
        padding: 0.85rem 1rem;
        margin: 1.5rem 0;
        background: rgba(32, 89, 108, 0.08);
        border-radius: 1rem;
      }
    </style>
  </head>
  <body>
    <main>${innerHtml}</main>
  </body>
</html>`;
}

async function exportPdf(filePath, innerHtml) {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
    },
  });

  try {
    const html = buildExportHtmlPage(innerHtml);
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfBuffer = await printWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
    });
    await fsp.writeFile(filePath, pdfBuffer);
  } finally {
    printWindow.destroy();
  }
}

function extractContentText(messageContent) {
  if (typeof messageContent === 'string') {
    return messageContent;
  }

  if (Array.isArray(messageContent)) {
    return messageContent
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.type === 'text') return item.text || '';
        return '';
      })
      .join('\n')
      .trim();
  }

  return '';
}

function selectProvider(providerId) {
  const settings = loadSettings();
  if (providerId) {
    return settings.aiProviders.find((provider) => provider.id === providerId);
  }
  return settings.aiProviders.find((provider) => provider.enabled && provider.isDefault)
    || settings.aiProviders.find((provider) => provider.enabled);
}

function resolveTemperature(model, requestedTemperature) {
  const normalizedModel = String(model || '').trim().toLowerCase();
  if (normalizedModel === 'kimi-k2.5') {
    return 1;
  }
  return typeof requestedTemperature === 'number' ? requestedTemperature : 0.5;
}

function trimLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function summarizeAssistantReply(answer) {
  let clean = trimLine(answer);
  const evalStart = clean.indexOf('<!--SELF_EVAL-->');
  if (evalStart >= 0) {
    clean = clean.slice(0, evalStart).trim();
  }
  for (const marker of ['## References', '## references', '## Ref']) {
    const markerIndex = clean.indexOf(marker);
    if (markerIndex >= 0) {
      clean = clean.slice(0, markerIndex).trim();
      break;
    }
  }
  if (clean.length <= 400) {
    return clean;
  }
  return `${clean.slice(0, 400).trim()}...`;
}

function buildConversationTurns(messages) {
  const turns = [];
  let pendingQuestion = '';
  messages.forEach((message) => {
    if (message.role === 'user') {
      pendingQuestion = trimLine(message.content);
      return;
    }
    if (!pendingQuestion || message.role !== 'assistant') return;
    turns.push({
      question: pendingQuestion,
      answerSummary: summarizeAssistantReply(message.content),
    });
    pendingQuestion = '';
  });
  return turns;
}

function buildConversationSummary(messages) {
  const turns = buildConversationTurns(messages);
  if (turns.length <= 5) return '';
  const parts = [];
  turns.slice(0, turns.length - 5).forEach((turn) => {
    parts.push(`Q: ${turn.question}`);
    parts.push(`A: ${turn.answerSummary.slice(0, 150)}${turn.answerSummary.length > 150 ? '...' : ''}`);
  });
  const merged = parts.join('\n');
  return merged.length <= 1200 ? merged : merged.slice(-1200);
}

function buildLongTermMemoryContext(memory) {
  const items = Array.isArray(memory?.items) ? memory.items : [];
  if (items.length === 0) return '';
  return items
    .slice(0, 8)
    .map((item) => `- ${item.type}: ${item.value}`)
    .join('\n');
}

function buildDocumentContext(documentContext) {
  const parts = [];
  if (documentContext?.fileName) {
    parts.push(`Current file: ${documentContext.fileName}`);
  }
  if (trimLine(documentContext?.selectedText)) {
    parts.push(`Selected text:\n${String(documentContext.selectedText).trim().slice(0, 2200)}`);
  }
  if (trimLine(documentContext?.draftExcerpt)) {
    parts.push(`Draft excerpt:\n${String(documentContext.draftExcerpt).trim().slice(0, 3200)}`);
  }
  return parts.join('\n\n');
}

function buildPromptMessages(payload, settings, sessionStore, webQuery, sources) {
  const action = payload.action || 'chat';
  const summary = buildConversationSummary(payload.messages || []);
  const recentMessages = Array.isArray(payload.messages)
    ? payload.messages
        .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
        .slice(-10)
        .map((message) => ({
          role: message.role,
          content: String(message.content || ''),
        }))
    : [];

  const systemParts = [BASE_AI_SYSTEM_PROMPT];
  if (QUICK_ACTION_PROMPTS[action]) {
    systemParts.push(QUICK_ACTION_PROMPTS[action]);
  }

  const documentContextText = buildDocumentContext(payload.documentContext);
  if (documentContextText) {
    systemParts.push(documentContextText);
  }

  if (settings.aiMemory?.enabled) {
    const memoryText = buildLongTermMemoryContext(sessionStore.memory);
    if (memoryText) {
      systemParts.push(`Long-term user memory:\n${memoryText}`);
    }
  }

  if (summary) {
    systemParts.push(`Earlier conversation summary:\n${summary}`);
  }

  const messages = [
    {
      role: 'system',
      content: systemParts.join('\n\n'),
    },
    ...recentMessages,
  ];

  if (sources.length > 0 && webQuery) {
    messages.unshift({
      role: 'system',
      content:
        'Web search context is attached below. Use it only when relevant, prefer the freshest and most authoritative sources available, and cite URLs briefly when you rely on web evidence.\n\n'
        + formatSearchContext(webQuery, sources),
    });
  }

  return messages;
}

async function chatWithProvider(payload) {
  const settings = loadSettings();
  const ui = getMainUi(settings.uiLanguage);
  const provider = selectProvider(payload.providerId);
  if (!provider) {
    throw new Error(ui.noAiProviderConfigured);
  }

  if (!provider.apiKey) {
    throw new Error(`API key missing for ${provider.name}.`);
  }

  const sessionStore = loadAiSessionStore(app.getPath('userData'));
  const latestUserQuery = trimLine(payload.searchQuery || getLastUserMessage(payload.messages));
  const searchPlan = buildSearchPlan({
    query: latestUserQuery,
    messages: payload.messages,
    action: payload.action || 'chat',
  });
  const shouldUseSearch =
    Boolean(payload.useWebSearch)
    && Boolean(settings.webSearch.apiKey)
    && (settings.webSearch.provider !== 'google' || Boolean(settings.webSearch.searchEngineId))
    && searchPlan.shouldSearch
    && Boolean(searchPlan.primaryQuery);
  const sources = shouldUseSearch
    ? await searchWeb(settings.webSearch, searchPlan.primaryQuery, {
        alternativeQueries: searchPlan.alternativeQueries,
        enrichTopK: 3,
      })
    : [];
  const messages = buildPromptMessages(
    payload,
    settings,
    sessionStore,
    sources.length > 0 ? searchPlan.primaryQuery : '',
    sources
  );

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: payload.model || provider.model,
      messages,
      temperature: resolveTemperature(payload.model || provider.model, payload.temperature),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || 'AI request failed.');
  }

  const content = extractContentText(data?.choices?.[0]?.message?.content);
  return {
    providerId: provider.id,
    providerName: provider.name,
    model: payload.model || provider.model,
    content,
    searchUsed: sources.length > 0,
    searchQuery: sources.length > 0 ? searchPlan.primaryQuery : '',
    sources,
  };
}

async function validateProviderConnection(provider) {
  const ui = getMainUi();
  const response = await fetch(`${String(provider.baseUrl || '').replace(/\/$/, '')}/models`, {
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      message: data?.error?.message || data?.message || ui.connectionFailed,
    };
  }

  return {
    ok: true,
    message: ui.connectionVerified,
  };
}

function sendCommand(command, payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('quietmark:command', { command, ...payload });
}

function buildMenu() {
  const settings = loadSettings();
  const ui = getMainUi(settings.uiLanguage);
  const recentItems = settings.recentFiles.length > 0
    ? settings.recentFiles.map((filePath) => ({
        label: `${path.basename(filePath)}  ${filePath}`,
        click: async () => {
          try {
            const entry = await openFileFromPath(filePath);
            mainWindow?.webContents.send('quietmark:files-opened', [entry]);
          } catch (error) {
            dialog.showErrorBox(ui.unableToOpenFile, error.message);
          }
        },
      }))
    : [{ label: ui.recentFilesEmpty, enabled: false }];

  const template = [
    {
      label: ui.menu.file,
      submenu: [
        { label: ui.menu.new, accelerator: 'CmdOrCtrl+N', click: () => sendCommand('file:new') },
        {
          label: ui.menu.open,
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const entries = await openFilesDialog();
            if (entries.length > 0) {
              mainWindow?.webContents.send('quietmark:files-opened', entries);
            }
          },
        },
        { label: ui.menu.openRecent, submenu: recentItems },
        { type: 'separator' },
        { label: ui.menu.closeTab, accelerator: 'CmdOrCtrl+W', click: () => sendCommand('file:close-tab') },
        { type: 'separator' },
        { label: ui.menu.save, accelerator: 'CmdOrCtrl+S', click: () => sendCommand('file:save') },
        {
          label: ui.menu.saveAs,
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendCommand('file:save-as'),
        },
        {
          label: ui.menu.saveAll,
          accelerator: 'CmdOrCtrl+Alt+S',
          click: () => sendCommand('file:save-all'),
        },
        { type: 'separator' },
        { label: ui.menu.exportHtml, click: () => sendCommand('file:export-html') },
        { label: ui.menu.exportPdf, click: () => sendCommand('file:export-pdf') },
        { type: 'separator' },
        { label: ui.menu.reveal, click: () => sendCommand('file:reveal') },
        { type: 'separator' },
        { role: process.platform === 'darwin' ? 'close' : 'quit' },
      ],
    },
    {
      label: ui.menu.edit,
      submenu: [
        { label: ui.menu.undo, accelerator: 'CmdOrCtrl+Z', click: () => sendCommand('edit:undo') },
        { label: ui.menu.redo, accelerator: 'CmdOrCtrl+Shift+Z', click: () => sendCommand('edit:redo') },
        { type: 'separator' },
        { role: 'cut', label: ui.menu.cut },
        { role: 'copy', label: ui.menu.copy },
        { role: 'paste', label: ui.menu.paste },
        { role: 'selectAll', label: ui.menu.selectAll },
        { type: 'separator' },
        { label: ui.menu.find, accelerator: 'CmdOrCtrl+F', click: () => sendCommand('edit:find') },
        { label: ui.menu.replace, accelerator: 'CmdOrCtrl+H', click: () => sendCommand('edit:replace') },
      ],
    },
    {
      label: ui.menu.view,
      submenu: [
        { label: ui.menu.toggleSidebar, accelerator: 'CmdOrCtrl+\\', click: () => sendCommand('view:toggle-sidebar') },
        { label: ui.menu.toggleAiPanel, accelerator: 'CmdOrCtrl+Shift+A', click: () => sendCommand('view:toggle-ai') },
        { label: ui.menu.toggleTerminal, accelerator: 'CmdOrCtrl+J', click: () => sendCommand('view:toggle-terminal') },
        { label: ui.menu.toggleSourceMode, accelerator: 'CmdOrCtrl+Shift+M', click: () => sendCommand('view:toggle-source') },
        { type: 'separator' },
        { role: 'zoomIn', label: ui.menu.zoomIn },
        { role: 'zoomOut', label: ui.menu.zoomOut },
        { role: 'resetZoom', label: ui.menu.resetZoom },
        { type: 'separator' },
        { role: 'togglefullscreen', label: ui.menu.fullScreen },
      ],
    },
    {
      label: ui.menu.insert,
      submenu: [
        { label: ui.menu.heading1, click: () => sendCommand('insert:heading-1') },
        { label: ui.menu.heading2, click: () => sendCommand('insert:heading-2') },
        { label: ui.menu.heading3, click: () => sendCommand('insert:heading-3') },
        { type: 'separator' },
        { label: ui.menu.bold, accelerator: 'CmdOrCtrl+B', click: () => sendCommand('insert:bold') },
        { label: ui.menu.italic, accelerator: 'CmdOrCtrl+I', click: () => sendCommand('insert:italic') },
        { label: ui.menu.code, click: () => sendCommand('insert:inline-code') },
        { label: ui.menu.link, accelerator: 'CmdOrCtrl+K', click: () => sendCommand('insert:link') },
        { label: ui.menu.image, click: () => sendCommand('insert:image') },
        { label: ui.menu.table, click: () => sendCommand('insert:table') },
        { label: ui.menu.blockquote, click: () => sendCommand('insert:blockquote') },
        { label: ui.menu.codeBlock, click: () => sendCommand('insert:code-block') },
        { label: ui.menu.horizontalRule, click: () => sendCommand('insert:rule') },
        { label: ui.menu.math, click: () => sendCommand('insert:math') },
        { label: ui.menu.emoji, click: () => sendCommand('insert:emoji') },
      ],
    },
    {
      label: ui.menu.settings,
      submenu: [
        { label: ui.menu.preferences, accelerator: 'CmdOrCtrl+,', click: () => sendCommand('settings:open') },
        { type: 'separator' },
        { label: ui.menu.resetPreferences, click: () => sendCommand('settings:reset') },
      ],
    },
    {
      label: ui.menu.window,
      submenu: [
        { role: 'minimize', label: ui.menu.minimize },
        { role: 'zoom', label: ui.menu.zoom },
        { role: 'front', label: ui.menu.bringAllToFront },
      ],
    },
    {
      label: ui.menu.help,
      submenu: [
        { label: ui.menu.quickStart, click: () => sendCommand('help:quick-start') },
        { label: ui.menu.keyboardShortcuts, click: () => sendCommand('help:shortcuts') },
        { type: 'separator' },
        {
          label: ui.menu.checkForUpdates,
          enabled: updateManager.hasReleaseFeed(),
          click: () => void updateManager.checkForUpdates(),
        },
        {
          label: ui.menu.releaseNotes,
          enabled: updateManager.hasReleaseFeed(),
          click: () => void updateManager.openReleaseNotes(),
        },
        { type: 'separator' },
        {
          label: ui.aboutTitle,
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: ui.aboutTitle,
              message: PRODUCT_NAME,
              detail: resolveUiLanguage(settings.uiLanguage) === 'zh-CN'
                ? '一款带有 AI 与联网写作辅助能力的桌面 Markdown 编辑器。'
                : PRODUCT_DESCRIPTION,
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1160,
    height: 760,
    title: PRODUCT_NAME,
    backgroundColor: '#ede8dd',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    void terminalManager.stopAll();
    mainWindow = null;
  });

  buildMenu();
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  queueOpenedFilePaths(extractMarkdownPathsFromArgv(process.argv));

  app.on('second-instance', (_event, commandLine) => {
    queueOpenedFilePaths(extractMarkdownPathsFromArgv(commandLine));
    focusMainWindow();
    void flushPendingOpenedFiles();
  });
}

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  queueOpenedFilePaths([filePath]);
  focusMainWindow();
  void flushPendingOpenedFiles();
});

app.whenReady().then(() => {
  migrateLegacyUserData();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('quietmark:files:open-dialog', async () => openFilesDialog());

ipcMain.handle('quietmark:files:open-path', async (_event, payload) => {
  if (!payload?.path) {
    throw new Error('No file path provided.');
  }
  return openFileFromPath(payload.path);
});

ipcMain.handle('quietmark:files:consume-pending-opened', async () => {
  return consumePendingOpenedEntries();
});

ipcMain.handle('quietmark:files:write', async (_event, payload) => {
  return saveMarkdownFile(payload.path, payload.content);
});

ipcMain.handle('quietmark:files:save-as', async (_event, payload) => {
  const ui = getMainUi();
  const result = await dialog.showSaveDialog(mainWindow, {
    title: ui.saveMarkdownFile,
    defaultPath: payload?.defaultPath || payload?.suggestedName || (resolveUiLanguage(loadSettings().uiLanguage) === 'zh-CN' ? '未命名.md' : 'Untitled.md'),
    filters: [{ name: ui.markdown, extensions: ['md', 'markdown', 'mdown', 'mkd'] }],
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const filePath = ensureMarkdownExtension(result.filePath);
  const saved = await saveMarkdownFile(filePath, payload.content);
  return { canceled: false, ...saved };
});

ipcMain.handle('quietmark:files:export-html', async (_event, payload) => {
  const ui = getMainUi();
  const result = await dialog.showSaveDialog(mainWindow, {
    title: ui.exportHtml,
    defaultPath: payload?.defaultPath || payload?.suggestedName || (resolveUiLanguage(loadSettings().uiLanguage) === 'zh-CN' ? '未命名.html' : 'Untitled.html'),
    filters: [{ name: ui.html, extensions: ['html'] }],
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const filePath = result.filePath.endsWith('.html') ? result.filePath : `${result.filePath}.html`;
  await fsp.writeFile(filePath, buildExportHtmlPage(payload.html), 'utf8');
  return { canceled: false, path: filePath };
});

ipcMain.handle('quietmark:files:export-pdf', async (_event, payload) => {
  const ui = getMainUi();
  const result = await dialog.showSaveDialog(mainWindow, {
    title: ui.exportPdf,
    defaultPath: payload?.defaultPath || payload?.suggestedName || (resolveUiLanguage(loadSettings().uiLanguage) === 'zh-CN' ? '未命名.pdf' : 'Untitled.pdf'),
    filters: [{ name: ui.pdf, extensions: ['pdf'] }],
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const filePath = result.filePath.endsWith('.pdf') ? result.filePath : `${result.filePath}.pdf`;
  await exportPdf(filePath, payload.html);
  return { canceled: false, path: filePath };
});

ipcMain.handle('quietmark:files:reveal', async (_event, payload) => {
  if (payload?.path) {
    shell.showItemInFolder(payload.path);
  }
  return true;
});

ipcMain.handle('quietmark:files:pick-image', async (_event, payload) => {
  const ui = getMainUi();
  const result = await dialog.showOpenDialog(mainWindow, {
    title: ui.insertImage,
    properties: ['openFile'],
    filters: [
      { name: ui.images, extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  const markdownPath = resolveAssetPath(payload?.documentPath, filePath);

  return { canceled: false, filePath, markdownPath };
});

ipcMain.handle('quietmark:files:resolve-asset-path', async (_event, payload) => {
  if (!payload?.assetPath) {
    throw new Error('No asset path provided.');
  }
  return resolveAssetPath(payload?.documentPath, payload.assetPath);
});

ipcMain.handle('quietmark:settings:get', async () => settingsForRenderer());

ipcMain.handle('quietmark:settings:update', async (_event, partial) => {
  const next = updateStoredSettings(partial);
  buildMenu();
  return settingsForRenderer(next);
});

ipcMain.handle('quietmark:settings:reset', async () => {
  const next = structuredClone(DEFAULT_SETTINGS);
  saveSettings(next);
  buildMenu();
  return settingsForRenderer(next);
});

ipcMain.handle('quietmark:ai:chat', async (_event, payload) => {
  return chatWithProvider(payload);
});

ipcMain.handle('quietmark:ai:validate', async (_event, payload) => {
  const ui = getMainUi();
  const stored = loadStoredSettings();
  const resolved = applyExternalSecrets(stored);
  const previous = resolved.aiProviders.find((provider) => provider.id === payload?.id);
  const provider = sanitizeProvider(
    previous ? { ...previous, ...payload } : payload,
    0,
    previous ? { [previous.id]: previous } : {}
  );
  const envApiKey = resolveProviderEnvApiKey(loadExternalSecrets(), provider.id);
  if (envApiKey) {
    provider.apiKey = envApiKey;
  }
  if (!provider.apiKey) {
    return { ok: false, message: ui.apiKeyRequired };
  }
  if (!provider.baseUrl) {
    return { ok: false, message: ui.baseUrlRequired };
  }
  return validateProviderConnection(provider);
});

ipcMain.handle('quietmark:ai:validate-web-search', async (_event, payload) => {
  const ui = getMainUi();
  const stored = loadStoredSettings();
  const resolved = applyExternalSecrets(stored);
  const secrets = loadExternalSecrets();
  const config = sanitizeWebSearchConfig(
    {
      ...resolved.webSearch,
      ...payload,
    },
    resolved.webSearch
  );
  const envApiKey = resolveWebSearchEnvApiKey(secrets, config.provider);
  const envSearchEngineId = resolveWebSearchEnvSearchEngineId(secrets);
  const result = await validateWebSearch({
    ...config,
    apiKey: envApiKey || config.apiKey,
    searchEngineId: envSearchEngineId || config.searchEngineId,
  });
  if (result.code === 'verified') {
    return {
      ok: true,
      message: ui.webSearchVerified(
        getSearchProviderLabel(result.provider || config.provider || 'brave'),
        Number(result.resultCount || 0)
      ),
    };
  }
  if (result.code === 'api_key_required') {
    return { ok: false, message: ui.webSearchApiKeyRequired };
  }
  if (result.code === 'base_url_required') {
    return { ok: false, message: ui.webSearchBaseUrlRequired };
  }
  if (result.code === 'search_engine_id_required') {
    return { ok: false, message: ui.searchEngineIdRequired };
  }
  if (result.code === 'validation_failed' && result.message === 'Search validation failed.') {
    return { ok: false, message: ui.webSearchValidationFailed };
  }
  return result;
});

ipcMain.handle('quietmark:ai:sessions:get', async () => {
  return loadAiSessionStore(app.getPath('userData'));
});

ipcMain.handle('quietmark:ai:sessions:save', async (_event, payload) => {
  return saveAiSessionStore(app.getPath('userData'), payload);
});

ipcMain.handle('quietmark:terminal:start', async (_event, payload) => {
  return terminalManager.start(payload);
});

ipcMain.handle('quietmark:terminal:write', async (_event, payload) => {
  await terminalManager.write(payload?.sessionId, payload?.data || '');
  return true;
});

ipcMain.handle('quietmark:terminal:resize', async (_event, payload) => {
  await terminalManager.resize(payload?.sessionId, payload?.cols, payload?.rows);
  return true;
});

ipcMain.handle('quietmark:terminal:stop', async (_event, payload) => {
  await terminalManager.stop(payload?.sessionId);
  return true;
});

ipcMain.on('quietmark:window:set-title', (_event, title) => {
  if (mainWindow && title) {
    mainWindow.setTitle(String(title));
  }
});

app.on('before-quit', () => {
  void terminalManager.stopAll();
});
