export interface FileOpenEntry {
  path: string;
  name: string;
  content: string;
  lastModified: string;
}

export interface SaveResult {
  path: string;
  name: string;
  lastModified: string;
}

export interface SaveAsResult extends Partial<SaveResult> {
  canceled: boolean;
}

export interface ExportResult {
  canceled: boolean;
  path?: string;
}

export interface AIProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  isDefault: boolean;
  hasApiKey?: boolean;
  apiKeyMasked?: string;
  apiKey?: string;
}

export type WebSearchProvider = 'brave' | 'tavily' | 'perplexity' | 'google';

export interface WebSearchConfig {
  enabled: boolean;
  provider: WebSearchProvider;
  baseUrl: string;
  resultCount: number;
  country: string;
  searchLang: string;
  searchEngineId?: string;
  hasApiKey?: boolean;
  apiKeyMasked?: string;
  apiKey?: string;
}

export interface AIMemorySettings {
  enabled: boolean;
}

export type UILanguage = 'en' | 'zh-CN';

export interface AppSettings {
  theme: 'paper' | 'midnight';
  fontSize: number;
  uiLanguage: UILanguage;
  defaultViewMode: 'rich' | 'source';
  recentFiles: string[];
  aiProviders: AIProviderConfig[];
  webSearch: WebSearchConfig;
  aiMemory: AIMemorySettings;
}

export interface SearchHit {
  title: string;
  url: string;
  description: string;
  source?: string | null;
  age?: string | null;
  contentExcerpt?: string;
  contentType?: string | null;
}

export interface DocumentContextPayload {
  fileName?: string;
  selectedText?: string;
  draftExcerpt?: string;
}

export interface AIChatPayload {
  providerId?: string;
  sessionId?: string;
  model?: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  action?: 'polish' | 'summarize' | 'translate' | 'continue' | 'chat';
  temperature?: number;
  useWebSearch?: boolean;
  searchQuery?: string;
  documentContext?: DocumentContextPayload;
}

export interface AIChatResult {
  providerId: string;
  providerName: string;
  model: string;
  content: string;
  searchUsed?: boolean;
  searchQuery?: string;
  sources?: SearchHit[];
}

export interface StoredAIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  action?: 'polish' | 'summarize' | 'translate' | 'continue' | 'chat';
  searchUsed?: boolean;
  searchQuery?: string;
  sources?: SearchHit[];
}

export interface AISessionRecord {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  summary?: string;
  messages: StoredAIMessage[];
}

export interface AIMemoryItem {
  id: string;
  type:
    | 'writing_style'
    | 'language_pref'
    | 'format_pref'
    | 'workflow_pref'
    | 'research_domain'
    | 'project_context';
  value: string;
  confidence: number;
  lastSeenAt: string;
}

export interface AIMemoryProfile {
  items: AIMemoryItem[];
  updatedAt: string | null;
  lastClearedAt?: string | null;
}

export interface AISessionStore {
  schemaVersion: number;
  activeSessionId: string | null;
  sessions: AISessionRecord[];
  memory: AIMemoryProfile;
}

export interface TerminalSessionInfo {
  sessionId: string;
  cwd: string;
  shell: string;
}

export interface QuietMarkAPI {
  files: {
    openDialog: () => Promise<FileOpenEntry[]>;
    openPath: (path: string) => Promise<FileOpenEntry>;
    save: (payload: { path: string; content: string }) => Promise<SaveResult>;
    saveAs: (payload: {
      content: string;
      suggestedName?: string;
      defaultPath?: string;
    }) => Promise<SaveAsResult>;
    exportHtml: (payload: {
      html: string;
      suggestedName?: string;
      defaultPath?: string;
    }) => Promise<ExportResult>;
    exportPdf: (payload: {
      html: string;
      suggestedName?: string;
      defaultPath?: string;
    }) => Promise<ExportResult>;
    reveal: (path: string) => Promise<boolean>;
    pickImage: (documentPath?: string | null) => Promise<{
      canceled: boolean;
      filePath?: string;
      markdownPath?: string;
    }>;
    resolveAssetPath: (documentPath: string, assetPath: string) => Promise<string>;
  };
  settings: {
    get: () => Promise<AppSettings>;
    update: (partial: Partial<AppSettings>) => Promise<AppSettings>;
    reset: () => Promise<AppSettings>;
  };
  ai: {
    chat: (payload: AIChatPayload) => Promise<AIChatResult>;
    validateProvider: (provider: AIProviderConfig) => Promise<{ ok: boolean; message: string }>;
    validateWebSearch: (config: WebSearchConfig) => Promise<{ ok: boolean; message: string }>;
    getSessionStore: () => Promise<AISessionStore>;
    saveSessionStore: (store: AISessionStore) => Promise<AISessionStore>;
  };
  terminal: {
    start: (payload?: {
      documentPath?: string | null;
      cwd?: string;
      cols?: number;
      rows?: number;
    }) => Promise<TerminalSessionInfo>;
    write: (sessionId: string, data: string) => Promise<void>;
    resize: (sessionId: string, cols: number, rows: number) => Promise<void>;
    stop: (sessionId: string) => Promise<void>;
    onData: (callback: (payload: { sessionId: string; data: string }) => void) => () => void;
    onExit: (
      callback: (payload: { sessionId: string; exitCode: number; signal?: string | null }) => void
    ) => () => void;
  };
  app: {
    setTitle: (title: string) => void;
    onCommand: (callback: (payload: { command: string }) => void) => () => void;
    onFilesOpened: (callback: (entries: FileOpenEntry[]) => void) => () => void;
  };
}

declare global {
  interface Window {
    quietmark: QuietMarkAPI;
  }
}

export {};
