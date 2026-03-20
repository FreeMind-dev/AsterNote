import type {
  AIChatResult,
  AISessionStore,
  AppSettings,
  ExportResult,
  FileOpenEntry,
  QuietMarkAPI,
  SaveAsResult,
  SaveResult,
} from '../electron';
import { DEFAULT_SETTINGS_FALLBACK } from './defaults';
import { getDocumentUiLanguage, getUiText } from './uiText';

let browserSettings: AppSettings = structuredClone(DEFAULT_SETTINGS_FALLBACK);

function unsupportedMessage(action: string) {
  const language = getDocumentUiLanguage();
  const ui = getUiText(getDocumentUiLanguage());
  return language === 'zh-CN'
    ? `${ui.app.browserFallbackNote} 该操作仅可在 Electron 桌面应用中使用：${action}。`
    : `${ui.app.browserFallbackNote} ${action} only works inside the Electron app.`;
}

function noopUnsubscribe() {
  return () => {};
}

const browserFallbackApi: QuietMarkAPI = {
  files: {
    openDialog: async () => {
      window.alert(unsupportedMessage('Open File'));
      return [] as FileOpenEntry[];
    },
    openPath: async () => {
      throw new Error(unsupportedMessage('Open Recent File'));
    },
    save: async () => {
      window.alert(unsupportedMessage('Save'));
      return {
        path: '',
        name: '',
        lastModified: new Date().toISOString(),
      } as SaveResult;
    },
    saveAs: async () => {
      window.alert(unsupportedMessage('Save As'));
      return { canceled: true } as SaveAsResult;
    },
    exportHtml: async () => {
      window.alert(unsupportedMessage('Export HTML'));
      return { canceled: true } as ExportResult;
    },
    exportPdf: async () => {
      window.alert(unsupportedMessage('Export PDF'));
      return { canceled: true } as ExportResult;
    },
    reveal: async () => {
      window.alert(unsupportedMessage('Reveal in Folder'));
      return false;
    },
    pickImage: async () => {
      window.alert(unsupportedMessage('Insert Image'));
      return { canceled: true };
    },
    resolveAssetPath: async () => {
      throw new Error(unsupportedMessage('Resolve Asset Path'));
    },
  },
  settings: {
    get: async () => structuredClone(browserSettings),
    update: async (partial) => {
      browserSettings = {
        ...browserSettings,
        ...partial,
      };
      return structuredClone(browserSettings);
    },
    reset: async () => {
      browserSettings = structuredClone(DEFAULT_SETTINGS_FALLBACK);
      return structuredClone(browserSettings);
    },
  },
  ai: {
    chat: async () => {
      throw new Error(unsupportedMessage('AI chat'));
    },
    validateProvider: async () => ({
      ok: false,
      message: unsupportedMessage('Provider validation'),
    }),
    validateWebSearch: async () => ({
      ok: false,
      message: unsupportedMessage('Web search validation'),
    }),
    getSessionStore: async () => ({
      schemaVersion: 2,
      activeSessionId: null,
      sessions: [],
      memory: {
        items: [],
        updatedAt: null,
        lastClearedAt: null,
      },
    } as AISessionStore),
    saveSessionStore: async (store) => structuredClone(store),
  },
  terminal: {
    start: async () => {
      throw new Error(unsupportedMessage('Terminal'));
    },
    write: async () => {
      throw new Error(unsupportedMessage('Terminal input'));
    },
    resize: async () => {
      throw new Error(unsupportedMessage('Terminal resize'));
    },
    stop: async () => {
      throw new Error(unsupportedMessage('Terminal'));
    },
    onData: () => noopUnsubscribe(),
    onExit: () => noopUnsubscribe(),
  },
  app: {
    setTitle: (title) => {
      document.title = title;
    },
    onCommand: () => noopUnsubscribe(),
    onFilesOpened: () => noopUnsubscribe(),
    consumePendingFilesOpened: async () => [],
  },
};

export function hasNativeQuietmarkApi() {
  return typeof window !== 'undefined' && typeof window.quietmark !== 'undefined';
}

export function getQuietmarkApi(): QuietMarkAPI {
  return hasNativeQuietmarkApi() ? window.quietmark : browserFallbackApi;
}

export function getBrowserFallbackAiResult(prompt: string): AIChatResult {
  const language = getDocumentUiLanguage();
  return {
    providerId: 'browser-fallback',
    providerName: language === 'zh-CN' ? '浏览器降级模式' : 'Browser Fallback',
    model: 'offline',
    content:
      language === 'zh-CN'
        ? `AsterNote 浏览器模式无法连接桌面 AI 提供商。\n\n原始提问：\n${prompt}`
        : `AsterNote browser mode cannot reach desktop AI providers.\n\nPrompt was:\n${prompt}`,
  };
}
