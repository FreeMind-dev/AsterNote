import type { Editor, JSONContent } from '@tiptap/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AIMemoryProfile, AISessionStore, AppSettings, DocumentContextPayload, FileOpenEntry } from './electron';
import { EmojiPickerDialog } from './components/EmojiPickerDialog';
import { HelpDialog, type HelpDialogKind } from './components/HelpDialog';
import { InputDialog } from './components/InputDialog';
import { MathComposerDialog } from './components/MathComposerDialog';
import { RichMarkdownEditor } from './components/RichMarkdownEditor';
import { RightSidebar } from './components/RightSidebar';
import { SettingsModal, type SettingsModalSectionId } from './components/SettingsModal';
import { TabsBar } from './components/TabsBar';
import { TerminalPanel } from './components/TerminalPanel';
import { Toolbar } from './components/Toolbar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { buildAiSessionSummary, createEmptyAiSession, deriveAiSessionTitle } from './lib/aiSessions';
import { DEFAULT_SETTINGS_FALLBACK } from './lib/defaults';
import {
  encodeMarkdownAssetPath,
  markdownToEditorContent,
  markdownToExportHtml,
  resolveMarkdownAssetPreviewSrc,
} from './lib/markdown';
import { getBrowserFallbackAiResult, getQuietmarkApi, hasNativeQuietmarkApi } from './lib/quietmarkApi';
import { getDocumentStats, getOutlineFromMarkdown } from './lib/textMetrics';
import { getUiText, resolveUiLanguage } from './lib/uiText';
import type {
  AIMessage,
  AISession,
  AppTab,
  EditorSelection,
  OutlineItem,
  SidebarSection,
  ToolPanelId,
} from './types';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createUntitledName(existingTabs: AppTab[], baseName = 'Untitled') {
  const pattern = new RegExp(`^${escapeRegExp(baseName)}(?: \\d+)?(?:\\.md)?$`);
  const untitledTabs = existingTabs.filter((tab) => tab.path === null && pattern.test(tab.name));
  return untitledTabs.length === 0 ? `${baseName}.md` : `${baseName} ${untitledTabs.length + 1}.md`;
}

function withMarkdownExtension(name: string) {
  return /\.(md|markdown)$/i.test(name) ? name : `${name}.md`;
}

function createTabFromEntry(entry: FileOpenEntry, defaultViewMode: AppSettings['defaultViewMode']): AppTab {
  return {
    id: crypto.randomUUID(),
    path: entry.path,
    name: entry.name,
    markdown: entry.content,
    savedMarkdown: entry.content,
    savedCachedContent: undefined,
    isDirty: false,
    viewMode: defaultViewMode,
    lastModified: entry.lastModified,
  };
}

function normalizeMarkdownForComparison(value: string) {
  return value.replace(/\r\n?/g, '\n').replace(/\n+$/g, '');
}

function areMatchingMarkdownDrafts(left: string, right: string) {
  return normalizeMarkdownForComparison(left) === normalizeMarkdownForComparison(right);
}

function serializeContentSnapshot(value?: JSONContent) {
  return value ? JSON.stringify(value) : '';
}

function areMatchingContentSnapshots(left?: JSONContent, right?: JSONContent) {
  return serializeContentSnapshot(left) === serializeContentSnapshot(right);
}

function isTabSnapshotDirty(tab: AppTab, nextMarkdown: string, nextCachedContent?: JSONContent) {
  if (nextCachedContent && tab.savedCachedContent) {
    return !areMatchingContentSnapshots(nextCachedContent, tab.savedCachedContent);
  }
  return !areMatchingMarkdownDrafts(nextMarkdown, tab.savedMarkdown);
}

const EMPTY_AI_MEMORY: AIMemoryProfile = {
  items: [],
  updatedAt: null,
  lastClearedAt: null,
};

const EMPTY_AI_STORE: AISessionStore = {
  schemaVersion: 2,
  activeSessionId: null,
  sessions: [],
  memory: EMPTY_AI_MEMORY,
};

function isWebSearchReady(settings: AppSettings | null) {
  if (!settings?.webSearch?.hasApiKey) return false;
  if (settings.webSearch.provider === 'google') {
    return Boolean(settings.webSearch.searchEngineId?.trim());
  }
  return true;
}

function getPreferredProviderId(settings: AppSettings | null) {
  const configuredProviders = (settings?.aiProviders || []).filter(
    (provider) => provider.enabled && provider.hasApiKey
  );

  return configuredProviders.find((provider) => provider.isDefault)?.id || configuredProviders[0]?.id || '';
}

function normalizeDroppedPath(file: File) {
  const nativeFile = file as File & { path?: string };
  return typeof nativeFile.path === 'string' ? nativeFile.path : '';
}

function isImageFile(fileName: string) {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName);
}

function isDelimitedTableFile(fileName: string) {
  return /\.(csv|tsv)$/i.test(fileName);
}

function isTextDocumentFile(fileName: string) {
  return /\.(md|markdown|txt)$/i.test(fileName);
}

function readDroppedTextFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error(`Unable to read ${file.name}`));
    reader.readAsText(file);
  });
}

function parseDelimitedRow(line: string, delimiter: string) {
  if (delimiter === '\t') {
    return line.split('\t').map((cell) => cell.trim());
  }

  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function escapeTableCell(value: string) {
  return value.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function delimitedTextToMarkdownTable(content: string, delimiter: string) {
  const rows = content
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .map((line) => parseDelimitedRow(line, delimiter));

  if (rows.length === 0) return '';

  const width = Math.max(...rows.map((row) => row.length), 1);
  const paddedRows = rows.map((row) => Array.from({ length: width }, (_, index) => row[index] || ''));
  const header = paddedRows[0].map((cell, index) => escapeTableCell(cell || `Column ${index + 1}`));
  const body = paddedRows.slice(1);

  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...body.map((row) => `| ${row.map((cell) => escapeTableCell(cell)).join(' | ')} |`),
  ].join('\n');
}

function buildDraftExcerpt(markdown: string, selectedText: string, action: AIMessage['action']) {
  if (action === 'continue') {
    return markdown.slice(-4000);
  }
  if (selectedText.trim()) {
    return markdown.slice(-3200);
  }
  return markdown.slice(0, 4000);
}

type InsertDialogState = {
  kind: 'link';
  title: string;
  label: string;
  initialValue: string;
  placeholder: string;
  submitLabel: string;
  multiline?: false;
};

type MathComposerState = {
  title: string;
  initialMode: 'inline' | 'block';
};

function App() {
  const quietmark = useMemo(() => getQuietmarkApi(), []);
  const hasNativeApi = useMemo(() => hasNativeQuietmarkApi(), []);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const uiLanguage = resolveUiLanguage(settings?.uiLanguage || DEFAULT_SETTINGS_FALLBACK.uiLanguage);
  const ui = getUiText(uiLanguage);
  const [tabs, setTabs] = useState<AppTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarSection, setSidebarSection] = useState<SidebarSection>('tools');
  const [showTerminal, setShowTerminal] = useState(false);
  const [activeToolPanel, setActiveToolPanel] = useState<ToolPanelId>('info');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsModalSectionId>('editor');
  const [findTerm, setFindTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [selection, setSelection] = useState<EditorSelection>({ mode: 'rich', text: '' });
  const [aiSessions, setAiSessions] = useState<AISession[]>([]);
  const [activeAiSessionId, setActiveAiSessionId] = useState<string | null>(null);
  const [aiDrafts, setAiDrafts] = useState<Record<string, string>>({});
  const [aiMemoryProfile, setAiMemoryProfile] = useState<AIMemoryProfile>(EMPTY_AI_MEMORY);
  const [aiStoreReady, setAiStoreReady] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [focusAiInputToken, setFocusAiInputToken] = useState(0);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(312);
  const [insertDialog, setInsertDialog] = useState<InsertDialogState | null>(null);
  const [mathComposerDialog, setMathComposerDialog] = useState<MathComposerState | null>(null);
  const [showEmojiDialog, setShowEmojiDialog] = useState(false);
  const [helpDialog, setHelpDialog] = useState<HelpDialogKind | null>(null);

  const editorRef = useRef<Editor | null>(null);
  const sourceTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const richSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const sidebarResizeRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? null,
    [tabs, activeTabId]
  );

  const outline = useMemo(
    () => (activeTab ? getOutlineFromMarkdown(activeTab.markdown) : []),
    [activeTab]
  );

  const stats = useMemo(
    () => getDocumentStats(activeTab?.markdown || ''),
    [activeTab]
  );

  const activeAiSession = useMemo(
    () => aiSessions.find((session) => session.id === activeAiSessionId) ?? null,
    [aiSessions, activeAiSessionId]
  );

  const aiMessages = activeAiSession?.messages || [];
  const aiDraft = activeAiSessionId ? aiDrafts[activeAiSessionId] || '' : '';

  const handleEditorSelectionChange = useCallback((nextSelection: EditorSelection) => {
    if (
      nextSelection.mode === 'rich'
      && typeof nextSelection.from === 'number'
      && typeof nextSelection.to === 'number'
    ) {
      richSelectionRef.current = {
        from: nextSelection.from,
        to: nextSelection.to,
      };
    } else if (nextSelection.mode === 'source') {
      richSelectionRef.current = null;
    }

    setSelection(nextSelection);
  }, []);

  const rememberRecentFiles = useCallback((paths: Array<string | null | undefined>) => {
    const normalized = paths.filter((item): item is string => Boolean(item));
    if (normalized.length === 0) return;

    setSettings((current) => {
      if (!current) return current;
      const recentFiles = [...normalized, ...current.recentFiles.filter((item) => !normalized.includes(item))]
        .slice(0, 10);
      return { ...current, recentFiles };
    });
  }, []);

  const ensureAiSession = useCallback(() => {
    if (activeAiSession) return activeAiSession;
    const nextSession = createEmptyAiSession(aiSessions.length + 1);
    setAiSessions((current) => [nextSession, ...current]);
    setActiveAiSessionId(nextSession.id);
    setAiDrafts((current) => ({ ...current, [nextSession.id]: '' }));
    return nextSession;
  }, [activeAiSession, aiSessions.length]);

  const touchAiSession = useCallback((sessionId: string, updater: (session: AISession) => AISession) => {
    setAiSessions((current) =>
      current.map((session) => {
        if (session.id !== sessionId) return session;
        const nextSession = updater(session);
        return {
          ...nextSession,
          title: deriveAiSessionTitle(nextSession.messages, nextSession.title),
          summary: buildAiSessionSummary(nextSession.messages),
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  const buildSessionSnapshot = useCallback(
    (session: AISession, messages: AIMessage[], sessionsSnapshot = aiSessions) => {
      const nextSession: AISession = {
        ...session,
        messages,
        title: deriveAiSessionTitle(messages, session.title),
        summary: buildAiSessionSummary(messages),
        updatedAt: new Date().toISOString(),
      };

      if (!sessionsSnapshot.some((item) => item.id === session.id)) {
        return [nextSession, ...sessionsSnapshot];
      }

      return sessionsSnapshot.map((item) => (item.id === session.id ? nextSession : item));
    },
    [aiSessions]
  );

  const persistAiStoreSnapshot = useCallback(
    async (sessionsSnapshot: AISession[], nextActiveSessionId = activeAiSessionId, memory = aiMemoryProfile) => {
      if (!hasNativeApi) return null;

      const store = await quietmark.ai.saveSessionStore({
        schemaVersion: 2,
        activeSessionId: nextActiveSessionId,
        sessions: sessionsSnapshot,
        memory,
      });
      setAiMemoryProfile(store.memory);
      return store;
    },
    [activeAiSessionId, aiMemoryProfile, hasNativeApi, quietmark]
  );

  const openSidebarSection = useCallback((section: SidebarSection) => {
    setShowSidebar(true);
    setSidebarSection(section);
  }, []);

  const createAiSession = useCallback(() => {
    const nextSession = createEmptyAiSession(aiSessions.length + 1);
    setAiSessions((current) => [nextSession, ...current]);
    setActiveAiSessionId(nextSession.id);
    setAiDrafts((current) => ({ ...current, [nextSession.id]: '' }));
    openSidebarSection('ai');
    setFocusAiInputToken((value) => value + 1);
  }, [aiSessions.length, openSidebarSection]);

  const clearAiMemory = useCallback(async () => {
    const confirmed = window.confirm(ui.app.clearMemoryConfirm);
    if (!confirmed) return;

    const nextMemory: AIMemoryProfile = {
      items: [],
      updatedAt: new Date().toISOString(),
      lastClearedAt: new Date().toISOString(),
    };

    setAiMemoryProfile(nextMemory);
    if (!hasNativeApi) return;

    await quietmark.ai.saveSessionStore({
      schemaVersion: 2,
      activeSessionId: activeAiSessionId,
      sessions: aiSessions,
      memory: nextMemory,
    });
  }, [activeAiSessionId, aiSessions, hasNativeApi, quietmark, ui.app.clearMemoryConfirm]);

  const updateActiveTab = useCallback(
    (updater: (tab: AppTab) => AppTab | null) => {
      setTabs((current) =>
        current.flatMap((tab) => {
          if (tab.id !== activeTabId) return [tab];
          const next = updater(tab);
          return next ? [next] : [];
        })
      );
    },
    [activeTabId]
  );

  const createNewTab = useCallback(() => {
    setTabs((current) => {
      const nextTab: AppTab = {
        id: crypto.randomUUID(),
        path: null,
        name: createUntitledName(current, ui.app.untitledBase),
        markdown: '',
        savedMarkdown: '',
        savedCachedContent: undefined,
        isDirty: false,
        viewMode: settings?.defaultViewMode || 'rich',
        lastModified: null,
      };
      setActiveTabId(nextTab.id);
      return [...current, nextTab];
    });
  }, [settings?.defaultViewMode, ui.app.untitledBase]);

  const loadSettings = useCallback(async () => {
    const next = await quietmark.settings.get().catch(() => DEFAULT_SETTINGS_FALLBACK);
    setSettings(next);
    setSelectedProviderId(getPreferredProviderId(next));
    setUseWebSearch(false);
    return next;
  }, [quietmark]);

  const loadAiSessionStore = useCallback(async () => {
    const store = await quietmark.ai.getSessionStore().catch(() => EMPTY_AI_STORE);

    const sessions = store.sessions.length > 0
      ? (store.sessions as AISession[])
      : [createEmptyAiSession(1)];
    const activeId = sessions.some((session) => session.id === store.activeSessionId)
      ? store.activeSessionId
      : sessions[0].id;

    setAiSessions(sessions);
    setActiveAiSessionId(activeId);
    setAiMemoryProfile(store.memory || EMPTY_AI_MEMORY);
    setAiDrafts({});
    setAiStoreReady(true);
  }, [quietmark]);

  const toggleAiPanel = useCallback(() => {
    if (showSidebar && sidebarSection === 'ai') {
      setShowSidebar(false);
      return;
    }
    setShowSidebar(true);
    setSidebarSection('ai');
    setFocusAiInputToken((value) => value + 1);
  }, [showSidebar, sidebarSection]);

  const toggleToolsPanel = useCallback(() => {
    if (showSidebar && sidebarSection === 'tools') {
      setShowSidebar(false);
      return;
    }
    setShowSidebar(true);
    setSidebarSection('tools');
  }, [showSidebar, sidebarSection]);

  const showToolPanel = useCallback(
    (panel: ToolPanelId) => {
      setActiveToolPanel(panel);
      setShowSidebar(true);
      setSidebarSection('tools');
    },
    []
  );

  const openSettingsSection = useCallback((section: SettingsModalSectionId) => {
    setSettingsSection(section);
    setShowSettings(true);
  }, []);

  const handleToggleWebSearch = useCallback(() => {
    if (!isWebSearchReady(settings)) {
      openSettingsSection('webSearch');
      return;
    }

    setUseWebSearch((current) => !current);
  }, [openSettingsSection, settings]);

  const openEntries = useCallback(
    (entries: FileOpenEntry[]) => {
      if (entries.length === 0) return;
      rememberRecentFiles(entries.map((entry) => entry.path));

      setTabs((current) => {
        const nextTabs = [...current];
        let nextActiveId = activeTabId;

        entries.forEach((entry) => {
          const existing = nextTabs.find((tab) => tab.path === entry.path);
          if (existing) {
            nextActiveId = existing.id;
            return;
          }

          const created = createTabFromEntry(entry, settings?.defaultViewMode || 'rich');
          nextTabs.push(created);
          nextActiveId = created.id;
        });

        if (nextActiveId) {
          setActiveTabId(nextActiveId);
        }

        return nextTabs;
      });
    },
    [activeTabId, rememberRecentFiles, settings?.defaultViewMode]
  );

  const openFileDialog = useCallback(async () => {
    const entries = await quietmark.files.openDialog();
    openEntries(entries);
  }, [openEntries, quietmark]);

  const openRecentFile = useCallback(
    async (filePath: string) => {
      try {
        const entry = await quietmark.files.openPath(filePath);
        openEntries([entry]);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : ui.app.unableToOpenRecentFile);
      }
    },
    [openEntries, quietmark, ui.app.unableToOpenRecentFile]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((current) => {
        const target = current.find((tab) => tab.id === tabId);
        if (!target) return current;

        if (target.isDirty) {
          const confirmed = window.confirm(ui.app.closeWithoutSaving(target.name));
          if (!confirmed) return current;
        }

        const nextTabs = current.filter((tab) => tab.id !== tabId);
        const nextActive =
          nextTabs.find((tab) => tab.id === activeTabId) ||
          nextTabs[nextTabs.length - 1] ||
          null;
        setActiveTabId(nextActive?.id || null);
        return nextTabs;
      });
    },
    [activeTabId, ui.app]
  );

  const saveTab = useCallback(
    async (target: AppTab, forceSaveAs = false) => {
      if (forceSaveAs || !target.path) {
        const result = await quietmark.files.saveAs({
          content: target.markdown,
          suggestedName: withMarkdownExtension(target.name),
          defaultPath: target.path || withMarkdownExtension(target.name),
        });

        if (result.canceled || !result.path) {
          return null;
        }

        setTabs((current) =>
          current.map((tab) =>
            tab.id === target.id
              ? {
                  ...tab,
                  path: result.path!,
                  name: result.name || withMarkdownExtension(tab.name),
                  savedMarkdown: tab.markdown,
                  savedCachedContent: tab.viewMode === 'rich' ? tab.cachedContent : undefined,
                  isDirty: false,
                  lastModified: result.lastModified || new Date().toISOString(),
                }
              : tab
          )
        );
        rememberRecentFiles([result.path]);

        return result.path;
      }

      const result = await quietmark.files.save({
        path: target.path,
        content: target.markdown,
      });

      setTabs((current) =>
        current.map((tab) =>
          tab.id === target.id
            ? {
                ...tab,
                savedMarkdown: tab.markdown,
                savedCachedContent: tab.viewMode === 'rich' ? tab.cachedContent : undefined,
                isDirty: false,
                lastModified: result.lastModified,
              }
            : tab
        )
      );
      rememberRecentFiles([result.path]);

      return result.path;
    },
    [quietmark, rememberRecentFiles]
  );

  const saveActiveTab = useCallback(
    async (forceSaveAs = false) => {
      if (!activeTab) return;
      await saveTab(activeTab, forceSaveAs);
    },
    [activeTab, saveTab]
  );

  const replaceSelectionInSource = useCallback(
    (replacement: string) => {
      if (!activeTab) return;

      const textarea = sourceTextareaRef.current;
      const start = selection.start ?? textarea?.selectionStart ?? activeTab.markdown.length;
      const end = selection.end ?? textarea?.selectionEnd ?? activeTab.markdown.length;

      const nextMarkdown =
        activeTab.markdown.slice(0, start) + replacement + activeTab.markdown.slice(end);

      updateActiveTab((tab) => ({
        ...tab,
        markdown: nextMarkdown,
        cachedContent: undefined,
        isDirty: isTabSnapshotDirty(tab, nextMarkdown),
      }));

      requestAnimationFrame(() => {
        const target = sourceTextareaRef.current;
        if (!target) return;
        const cursor = start + replacement.length;
        target.focus();
        target.setSelectionRange(cursor, cursor);
      });
    },
    [activeTab, selection.end, selection.start, updateActiveTab]
  );

  const ensureDocumentPathForAssetInsert = useCallback(async () => {
    if (!activeTab) return null;
    if (activeTab.path) return activeTab.path;

    const confirmed = window.confirm(
      ui.app.saveBeforeAssetInsert
    );
    if (!confirmed) return null;
    return saveTab(activeTab, true);
  }, [activeTab, saveTab, ui.app.saveBeforeAssetInsert]);

  const insertIntoRichEditor = useCallback(
    (content: string, replaceCurrentSelection = false) => {
      const editor = editorRef.current;
      if (!editor) return;

      if (
        replaceCurrentSelection &&
        selection.from !== undefined &&
        selection.to !== undefined &&
        selection.from !== selection.to
      ) {
        editor
          .chain()
          .focus()
          .insertContentAt({ from: selection.from, to: selection.to }, content)
          .run();
        return;
      }

      editor.chain().focus().insertContent(content).run();
    },
    [selection.from, selection.to]
  );

  const insertMarkdownIntoRichEditor = useCallback(
    (content: string, replaceCurrentSelection = false, position?: number) => {
      const editor = editorRef.current;
      if (!editor) return;

      const parsed = markdownToEditorContent(content, { documentPath: activeTab?.path });
      const nodes = parsed.type === 'doc' ? parsed.content || [] : [parsed];
      if (nodes.length === 0) return;

      if (
        replaceCurrentSelection &&
        selection.from !== undefined &&
        selection.to !== undefined &&
        selection.from !== selection.to
      ) {
        editor.chain().focus().insertContentAt({ from: selection.from, to: selection.to }, nodes).run();
        return;
      }

      if (typeof position === 'number') {
        editor.chain().focus().insertContentAt(position, nodes).run();
        return;
      }

      editor.chain().focus().insertContent(nodes).run();
    },
    [activeTab?.path, selection.from, selection.to]
  );

  const createRichSelectionChain = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return null;

    const chain = editor.chain().focus();
    const nextSelection = richSelectionRef.current
      ?? (
        typeof selection.from === 'number' && typeof selection.to === 'number'
          ? { from: selection.from, to: selection.to }
          : null
      );

    if (!nextSelection) {
      return chain;
    }

    const docSize = editor.state.doc.content.size;
    const from = Math.max(0, Math.min(nextSelection.from, docSize));
    const to = Math.max(0, Math.min(nextSelection.to, docSize));
    return chain.setTextSelection({ from, to });
  }, [selection.from, selection.to]);

  const runRichToolbarCommand = useCallback(
    (command: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => {
      const chain = createRichSelectionChain();
      if (!chain) return false;
      return command(chain).run();
    },
    [createRichSelectionChain]
  );

  const insertStructuredContent = useCallback((content: Record<string, unknown> | Array<Record<string, unknown>>, position?: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    if (typeof position === 'number') {
      editor.chain().focus().insertContentAt(position, content).run();
      return;
    }
    const chain = createRichSelectionChain();
    if (!chain) return;
    chain.insertContent(content).run();
  }, [createRichSelectionChain]);

  const createImageInsert = useCallback((
    markdownPath: string,
    fileName: string,
    assetPath?: string,
    previewSrc?: string,
  ) => {
    const alt = fileName.replace(/\.[^.]+$/, '') || ui.app.imageAlt;
    const encodedMarkdownPath = encodeMarkdownAssetPath(markdownPath);
    return {
      rich: {
        type: 'image',
        attrs: {
          src: previewSrc || resolveMarkdownAssetPreviewSrc(assetPath || encodedMarkdownPath, activeTab?.path),
          markdownSrc: encodedMarkdownPath,
          alt,
          title: fileName,
        },
      },
      source: `![${alt}](${encodedMarkdownPath})`,
    };
  }, [activeTab?.path, ui.app.imageAlt]);

  const handleDroppedFiles = useCallback(
    async (files: File[], mode: 'rich' | 'source', position?: number) => {
      if (!activeTab || files.length === 0) return;

      let documentPath = activeTab.path;
      let richInsertPosition = position;
      const sourceBlocks: string[] = [];
      const unsupported: string[] = [];

      for (const file of files) {
        const fileName = file.name || 'untitled';
        const lowerName = fileName.toLowerCase();

        if (isImageFile(lowerName)) {
          documentPath = documentPath || await ensureDocumentPathForAssetInsert();
          if (!documentPath) {
            return;
          }

          const nativePath = normalizeDroppedPath(file);
          const resolvedPath = nativePath
            ? await quietmark.files.resolveAssetPath(documentPath, nativePath)
            : fileName;
          const imageInsert = createImageInsert(
            resolvedPath,
            fileName,
            nativePath || undefined,
            nativePath ? undefined : URL.createObjectURL(file),
          );

          if (mode === 'source') {
            sourceBlocks.push(imageInsert.source);
          } else {
            insertStructuredContent(imageInsert.rich, richInsertPosition);
            richInsertPosition = undefined;
          }
          continue;
        }

        if (isDelimitedTableFile(lowerName)) {
          const delimiter = lowerName.endsWith('.tsv') ? '\t' : ',';
          const text = await readDroppedTextFile(file);
          const tableMarkdown = delimitedTextToMarkdownTable(text, delimiter);
          if (!tableMarkdown) continue;

          if (mode === 'source') {
            sourceBlocks.push(tableMarkdown);
          } else {
            insertMarkdownIntoRichEditor(tableMarkdown, false, richInsertPosition);
            richInsertPosition = undefined;
          }
          continue;
        }

        if (isTextDocumentFile(lowerName)) {
          const text = await readDroppedTextFile(file);
          if (!text.trim()) continue;

          if (mode === 'source') {
            sourceBlocks.push(text);
          } else {
            insertMarkdownIntoRichEditor(text, false, richInsertPosition);
            richInsertPosition = undefined;
          }
          continue;
        }

        unsupported.push(fileName);
      }

      if (sourceBlocks.length > 0) {
        replaceSelectionInSource(sourceBlocks.join('\n\n'));
      }

      if (unsupported.length > 0) {
        window.alert(ui.app.unsupportedDropTypes(unsupported.join(', ')));
      }
    },
    [
      activeTab,
      createImageInsert,
      ensureDocumentPathForAssetInsert,
      insertMarkdownIntoRichEditor,
      insertStructuredContent,
      quietmark,
      replaceSelectionInSource,
      ui.app,
    ]
  );

  const applyPromptWrap = useCallback(
    (prefix: string, suffix = prefix) => {
      if (!activeTab) return;
      if (activeTab.viewMode === 'source') {
        const selected = selection.text || ui.app.text;
        replaceSelectionInSource(`${prefix}${selected}${suffix}`);
        return;
      }

      const editor = editorRef.current;
      if (!editor) return;
      const selectedText = editor.state.doc.textBetween(
        editor.state.selection.from,
        editor.state.selection.to,
        ' '
      );
      editor
        .chain()
        .focus()
        .insertContent(`${prefix}${selectedText || ui.app.text}${suffix}`)
        .run();
    },
    [activeTab, replaceSelectionInSource, selection.text, ui.app.text]
  );

  const applyLinkValue = useCallback((href: string) => {
    const normalizedHref = href.trim();
    if (!normalizedHref) return;

    if (activeTab?.viewMode === 'source') {
      replaceSelectionInSource(`[${selection.text || ui.app.link}](${normalizedHref})`);
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;
    const nextSelection = richSelectionRef.current
      ?? (
        typeof selection.from === 'number' && typeof selection.to === 'number'
          ? { from: selection.from, to: selection.to }
          : null
      );
    const from = nextSelection?.from ?? editor.state.selection.from;
    const to = nextSelection?.to ?? editor.state.selection.to;

    if (from === to) {
      editor.chain().focus().insertContent({
        type: 'text',
        text: normalizedHref,
        marks: [{ type: 'link', attrs: { href: normalizedHref } }],
      }).run();
      return;
    }

    editor
      .chain()
      .focus()
      .setTextSelection({ from, to })
      .extendMarkRange('link')
      .setLink({ href: normalizedHref })
      .run();
  }, [activeTab?.viewMode, replaceSelectionInSource, selection.from, selection.text, selection.to, ui.app.link]);

  const openLinkDialog = useCallback(() => {
    const initialValue = activeTab?.viewMode === 'rich'
      ? String(editorRef.current?.getAttributes('link').href || '')
      : '';

    setInsertDialog({
      kind: 'link',
      title: ui.app.insertLinkTitle,
      label: ui.app.destinationUrl,
      initialValue,
      placeholder: 'https://example.com',
      submitLabel: ui.app.insertLink,
    });
  }, [activeTab?.viewMode, ui.app.destinationUrl, ui.app.insertLink, ui.app.insertLinkTitle]);

  const insertImage = useCallback(async () => {
    if (!activeTab) return;

    const documentPath = await ensureDocumentPathForAssetInsert();
    if (!documentPath) return;

    const result = await quietmark.files.pickImage(documentPath);
    if (result.canceled || !result.markdownPath) return;

    const fileName = result.filePath?.split(/[\\/]/).pop() || ui.app.imageAlt;
    const imageInsert = createImageInsert(result.markdownPath, fileName, result.filePath);

    if (activeTab.viewMode === 'source') {
      replaceSelectionInSource(imageInsert.source);
      return;
    }

    insertStructuredContent(imageInsert.rich);
  }, [
    activeTab,
    createImageInsert,
    ensureDocumentPathForAssetInsert,
    insertStructuredContent,
    quietmark,
    replaceSelectionInSource,
    ui.app.imageAlt,
  ]);

  const insertMathContent = useCallback(
    (latex: string, mode: 'inline' | 'block') => {
      if (activeTab?.viewMode === 'source') {
        replaceSelectionInSource(mode === 'inline' ? `$${latex}$` : `$$\n${latex}\n$$`);
        return;
      }

      insertStructuredContent({
        type: mode === 'inline' ? 'inlineMath' : 'mathBlock',
        attrs: { latex },
      });
    },
    [activeTab?.viewMode, insertStructuredContent, replaceSelectionInSource]
  );

  const insertEmojiValue = useCallback((emoji: string) => {
    if (!emoji) return;
    if (activeTab?.viewMode === 'source') {
      replaceSelectionInSource(emoji);
      return;
    }
    insertIntoRichEditor(emoji, false);
  }, [activeTab?.viewMode, insertIntoRichEditor, replaceSelectionInSource]);

  const openMathDialog = useCallback((mode: 'inline' | 'block') => {
    setMathComposerDialog({
      initialMode: mode,
      title: mode === 'inline' ? ui.app.insertInlineFormula : ui.app.insertFormulaBlock,
    });
  }, [ui.app.insertFormulaBlock, ui.app.insertInlineFormula]);

  const submitInsertDialog = useCallback((value: string) => {
    const normalizedValue = value.trim();
    if (!insertDialog || !normalizedValue) {
      setInsertDialog(null);
      return;
    }

    if (insertDialog.kind === 'link') {
      applyLinkValue(normalizedValue);
    }

    setInsertDialog(null);
  }, [applyLinkValue, insertDialog]);

  const exportActiveTab = useCallback(
    async (format: 'html' | 'pdf') => {
      if (!activeTab) return;
      const baseName = activeTab.name.replace(/\.(md|markdown)$/i, '');
      const html = markdownToExportHtml(activeTab.markdown);

      if (format === 'html') {
        await quietmark.files.exportHtml({
          html,
          suggestedName: `${baseName}.html`,
          defaultPath: activeTab.path
            ? activeTab.path.replace(/\.(md|markdown)$/i, '.html')
            : `${baseName}.html`,
        });
        return;
      }

      await quietmark.files.exportPdf({
        html,
        suggestedName: `${baseName}.pdf`,
        defaultPath: activeTab.path
          ? activeTab.path.replace(/\.(md|markdown)$/i, '.pdf')
          : `${baseName}.pdf`,
      });
    },
    [activeTab, quietmark]
  );

  const buildAiDocumentContext = useCallback(
    (action: AIMessage['action'], selectedText: string): DocumentContextPayload => ({
      fileName: activeTab?.name || ui.app.untitledBase,
      selectedText: selectedText.trim() || undefined,
      draftExcerpt: activeTab
        ? buildDraftExcerpt(activeTab.markdown, selectedText, action).trim() || undefined
        : undefined,
    }),
    [activeTab, ui.app.untitledBase]
  );

  const runQuickAction = useCallback(
    async (action: 'polish' | 'summarize' | 'translate' | 'continue') => {
      if (!settings) return;
      const session = ensureAiSession();
      const contextText =
        action === 'continue'
          ? (activeTab?.markdown || '').slice(-3000)
          : selection.text.trim() || activeTab?.markdown || '';

      if (!contextText.trim()) {
        window.alert(ui.app.noTextForAction);
        return;
      }

      openSidebarSection('ai');
      setAiBusy(true);

      const userMessage: AIMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: action === 'continue' ? 'Continue the draft' : `${action} selection`,
        createdAt: new Date().toISOString(),
        action,
      };

      const nextThread = [...session.messages, userMessage];
      setActiveAiSessionId(session.id);
      touchAiSession(session.id, (current) => ({
        ...current,
        messages: nextThread,
      }));

      try {
        const nextSessions = buildSessionSnapshot(session, nextThread);
        if (hasNativeApi) {
          await persistAiStoreSnapshot(nextSessions, session.id);
        }

        const result = hasNativeApi
          ? await quietmark.ai.chat({
              providerId: selectedProviderId,
              sessionId: session.id,
              action,
              useWebSearch,
              messages: nextThread,
              documentContext: buildAiDocumentContext(
                action,
                action === 'continue' ? selection.text : selection.text || contextText
              ),
            })
          : getBrowserFallbackAiResult(contextText);

        const assistantMessage: AIMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.content.trim(),
          createdAt: new Date().toISOString(),
          action,
          searchUsed: result.searchUsed,
          searchQuery: result.searchQuery,
          sources: result.sources,
        };
        const finalThread = [...nextThread, assistantMessage];

        touchAiSession(session.id, (current) => ({
          ...current,
          messages: finalThread,
        }));

        if (hasNativeApi) {
          const finalSessions = buildSessionSnapshot(session, finalThread, nextSessions);
          await persistAiStoreSnapshot(finalSessions, session.id);
        }
      } catch (error) {
        window.alert(error instanceof Error ? error.message : ui.app.aiRequestFailed);
      } finally {
        setAiBusy(false);
      }
    },
    [
      activeTab?.markdown,
      buildAiDocumentContext,
      buildSessionSnapshot,
      ensureAiSession,
      hasNativeApi,
      openSidebarSection,
      persistAiStoreSnapshot,
      quietmark,
      selectedProviderId,
      selection.text,
      settings,
      touchAiSession,
      ui.app.aiRequestFailed,
      ui.app.noTextForAction,
      useWebSearch,
    ]
  );

  const sendAiMessage = useCallback(async () => {
    const session = ensureAiSession();
    const prompt = aiDraft.trim();
    if (!prompt || !settings) return;

    openSidebarSection('ai');
    setAiBusy(true);

    const userMessage: AIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      createdAt: new Date().toISOString(),
      action: 'chat',
    };

    const thread = [...session.messages, userMessage];
    setActiveAiSessionId(session.id);
    touchAiSession(session.id, (current) => ({
      ...current,
      messages: thread,
    }));
    setAiDrafts((current) => ({ ...current, [session.id]: '' }));

    try {
      const nextSessions = buildSessionSnapshot(session, thread);
      if (hasNativeApi) {
        await persistAiStoreSnapshot(nextSessions, session.id);
      }

      const result = hasNativeApi
        ? await quietmark.ai.chat({
            providerId: selectedProviderId,
            sessionId: session.id,
            action: 'chat',
            useWebSearch,
            searchQuery: prompt,
            messages: thread,
            documentContext: buildAiDocumentContext('chat', selection.text),
          })
        : getBrowserFallbackAiResult(prompt);

      const assistantMessage: AIMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.content.trim(),
        createdAt: new Date().toISOString(),
        action: 'chat',
        searchUsed: result.searchUsed,
        searchQuery: result.searchQuery,
        sources: result.sources,
      };
      const finalThread = [...thread, assistantMessage];

      touchAiSession(session.id, (current) => ({
        ...current,
        messages: finalThread,
      }));

      if (hasNativeApi) {
        const finalSessions = buildSessionSnapshot(session, finalThread, nextSessions);
        await persistAiStoreSnapshot(finalSessions, session.id);
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : ui.app.aiRequestFailed);
    } finally {
      setAiBusy(false);
    }
  }, [
    aiDraft,
    buildAiDocumentContext,
    buildSessionSnapshot,
    ensureAiSession,
    hasNativeApi,
    openSidebarSection,
    persistAiStoreSnapshot,
    quietmark,
    selectedProviderId,
    selection.text,
    settings,
    touchAiSession,
    ui.app.aiRequestFailed,
    useWebSearch,
  ]);

  const applyAiResult = useCallback(
    (content: string, replaceCurrentSelection: boolean) => {
      if (!activeTab) return;
      if (activeTab.viewMode === 'source') {
        replaceSelectionInSource(content);
        return;
      }
      insertIntoRichEditor(content, replaceCurrentSelection);
    },
    [activeTab, insertIntoRichEditor, replaceSelectionInSource]
  );

  const jumpToOutlineItem = useCallback(
    (item: OutlineItem) => {
      if (!activeTab) return;

      if (activeTab.viewMode === 'source') {
        const textarea = sourceTextareaRef.current;
        if (!textarea) return;
        const lines = activeTab.markdown.split('\n');
        let position = 0;
        for (const line of lines) {
          const match = line.match(/^(#{1,6})\s+(.+)$/);
          if (match && match[1].length === item.level && match[2].trim() === item.text) {
            textarea.focus();
            textarea.setSelectionRange(position, position + line.length);
            return;
          }
          position += line.length + 1;
        }
        return;
      }

      const editor = editorRef.current;
      if (!editor) return;

      let targetPos: number | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (
          node.type.name === 'heading' &&
          node.attrs.level === item.level &&
          node.textContent === item.text
        ) {
          targetPos = pos + 1;
          return false;
        }
        return true;
      });

      if (targetPos !== null) {
        editor.chain().focus().setTextSelection(targetPos).run();
      }
    },
    [activeTab]
  );

  const handleReplaceAll = useCallback(() => {
    if (!activeTab || !findTerm) return;
    const nextMarkdown = activeTab.markdown.split(findTerm).join(replaceTerm);
    updateActiveTab((tab) => ({
      ...tab,
      markdown: nextMarkdown,
      cachedContent: undefined,
      isDirty: isTabSnapshotDirty(tab, nextMarkdown),
    }));
  }, [activeTab, findTerm, replaceTerm, updateActiveTab]);

  const handleReplaceSelection = useCallback(() => {
    if (!findTerm) return;
    if (selection.text) {
      const nextText = selection.text.split(findTerm).join(replaceTerm);
      applyAiResult(nextText, true);
      return;
    }
    handleReplaceAll();
  }, [applyAiResult, findTerm, handleReplaceAll, replaceTerm, selection.text]);

  const handleCommand = useCallback(
    async (command: string) => {
      switch (command) {
        case 'file:new':
          createNewTab();
          return;
        case 'file:open-dialog':
          await openFileDialog();
          return;
        case 'file:close-tab':
          if (activeTabId) closeTab(activeTabId);
          return;
        case 'file:save':
          await saveActiveTab(false);
          return;
        case 'file:save-as':
          await saveActiveTab(true);
          return;
        case 'file:save-all':
          for (const tab of tabs) {
            if (tab.isDirty) {
              await saveTab(tab);
            }
          }
          return;
        case 'file:export-html':
          await exportActiveTab('html');
          return;
        case 'file:export-pdf':
          await exportActiveTab('pdf');
          return;
        case 'file:reveal':
          if (activeTab?.path) {
            await quietmark.files.reveal(activeTab.path);
          }
          return;
        case 'view:toggle-sidebar':
          setShowSidebar((current) => !current);
          return;
        case 'view:toggle-ai':
          toggleAiPanel();
          return;
        case 'view:show-ai':
        case 'ai:focus':
          openSidebarSection('ai');
          setFocusAiInputToken((value) => value + 1);
          return;
        case 'view:show-tools':
          openSidebarSection('tools');
          return;
        case 'view:toggle-terminal':
          setShowTerminal((current) => !current);
          return;
        case 'view:toggle-source':
          updateActiveTab((tab) => ({
            ...tab,
            viewMode: tab.viewMode === 'rich' ? 'source' : 'rich',
          }));
          return;
        case 'edit:find':
        case 'edit:replace':
          showToolPanel('find');
          return;
        case 'edit:undo':
          if (activeTab?.viewMode === 'source') {
            sourceTextareaRef.current?.focus();
            document.execCommand('undo');
            return;
          }
          editorRef.current?.chain().focus().undo().run();
          return;
        case 'edit:redo':
          if (activeTab?.viewMode === 'source') {
            sourceTextareaRef.current?.focus();
            document.execCommand('redo');
            return;
          }
          editorRef.current?.chain().focus().redo().run();
          return;
        case 'settings:open':
          openSettingsSection('editor');
          return;
        case 'settings:theme':
        case 'settings:font-size':
          openSettingsSection('editor');
          return;
        case 'settings:ai':
          openSettingsSection('aiProviders');
          return;
        case 'settings:web-search':
          openSettingsSection('webSearch');
          return;
        case 'settings:reset':
          if (window.confirm(ui.app.resetPreferencesConfirm)) {
            const next = await quietmark.settings.reset();
            setSettings(next);
          }
          return;
        case 'help:quick-start':
          setHelpDialog('quickStart');
          return;
        case 'help:shortcuts':
          setHelpDialog('shortcuts');
          return;
        case 'ai:polish-selection':
          await runQuickAction('polish');
          return;
        case 'ai:summarize-selection':
          await runQuickAction('summarize');
          return;
        case 'ai:translate-selection':
          await runQuickAction('translate');
          return;
        case 'ai:continue-writing':
          await runQuickAction('continue');
          return;
        default:
          break;
      }

      if (!activeTab) return;

      if (command === 'insert:emoji') {
        setShowEmojiDialog(true);
        return;
      }

      if (command === 'insert:math' || command === 'insert:inline-math') {
        openMathDialog('inline');
        return;
      }

      if (command === 'insert:math-block') {
        openMathDialog('block');
        return;
      }

      if (command === 'insert:image') {
        await insertImage();
        return;
      }

      if (command === 'insert:link') {
        openLinkDialog();
        return;
      }

      if (activeTab.viewMode === 'source') {
        switch (command) {
          case 'insert:bold':
            applyPromptWrap('**');
            return;
          case 'insert:italic':
            applyPromptWrap('*');
            return;
          case 'insert:inline-code':
            applyPromptWrap('`');
            return;
          case 'insert:heading-1':
            replaceSelectionInSource(`# ${selection.text || ui.app.heading}`);
            return;
          case 'insert:heading-2':
            replaceSelectionInSource(`## ${selection.text || ui.app.heading}`);
            return;
          case 'insert:heading-3':
            replaceSelectionInSource(`### ${selection.text || ui.app.heading}`);
            return;
          case 'insert:blockquote':
            replaceSelectionInSource(`> ${selection.text || ui.app.quote}`);
            return;
          case 'insert:bullet-list':
            replaceSelectionInSource(`- ${selection.text || ui.app.item}`);
            return;
          case 'insert:ordered-list':
            replaceSelectionInSource(`1. ${selection.text || ui.app.item}`);
            return;
          case 'insert:table':
            replaceSelectionInSource(
              `| ${ui.app.columnA} | ${ui.app.columnB} |\n| --- | --- |\n| ${ui.app.value} | ${ui.app.value} |`
            );
            return;
          case 'insert:rule':
            replaceSelectionInSource('\n---\n');
            return;
          case 'insert:code-block':
            replaceSelectionInSource(`\`\`\`\n${selection.text || ''}\n\`\`\``);
            return;
          default:
            return;
        }
      }

      const editor = editorRef.current;
      if (!editor) return;

      switch (command) {
        case 'insert:heading-1':
          runRichToolbarCommand((chain) => chain.toggleHeading({ level: 1 }));
          return;
        case 'insert:heading-2':
          runRichToolbarCommand((chain) => chain.toggleHeading({ level: 2 }));
          return;
        case 'insert:heading-3':
          runRichToolbarCommand((chain) => chain.toggleHeading({ level: 3 }));
          return;
        case 'insert:bold':
          runRichToolbarCommand((chain) => chain.toggleBold());
          return;
        case 'insert:italic':
          runRichToolbarCommand((chain) => chain.toggleItalic());
          return;
        case 'insert:inline-code':
          runRichToolbarCommand((chain) => chain.toggleCode());
          return;
        case 'insert:blockquote':
          runRichToolbarCommand((chain) => chain.toggleBlockquote());
          return;
        case 'insert:bullet-list':
          runRichToolbarCommand((chain) => chain.toggleBulletList());
          return;
        case 'insert:ordered-list':
          runRichToolbarCommand((chain) => chain.toggleOrderedList());
          return;
        case 'insert:table':
          runRichToolbarCommand((chain) => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }));
          return;
        case 'insert:rule':
          runRichToolbarCommand((chain) => chain.setHorizontalRule());
          return;
        case 'insert:code-block':
          runRichToolbarCommand((chain) => chain.toggleCodeBlock());
          return;
        default:
          return;
      }
    },
    [
      activeTab,
      activeTabId,
      applyPromptWrap,
      closeTab,
      createNewTab,
      exportActiveTab,
      insertImage,
      openLinkDialog,
      openMathDialog,
      openSettingsSection,
      openFileDialog,
      quietmark,
      replaceSelectionInSource,
      runQuickAction,
      saveActiveTab,
      saveTab,
      selection.text,
      runRichToolbarCommand,
      tabs,
      toggleAiPanel,
      ui.app,
      updateActiveTab,
      openSidebarSection,
      showToolPanel,
    ]
  );

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    void loadAiSessionStore();
  }, [loadAiSessionStore]);

  useEffect(() => {
    if (!aiStoreReady || !hasNativeApi) return;
    void quietmark.ai.saveSessionStore({
      schemaVersion: 2,
      activeSessionId: activeAiSessionId,
      sessions: aiSessions,
      memory: aiMemoryProfile,
    });
  }, [activeAiSessionId, aiMemoryProfile, aiSessions, aiStoreReady, hasNativeApi, quietmark]);

  useEffect(() => {
    const unsubscribeCommands = quietmark.app.onCommand(({ command }) => {
      void handleCommand(command);
    });

    const unsubscribeFilesOpened = quietmark.app.onFilesOpened((entries) => {
      openEntries(entries);
    });

    return () => {
      unsubscribeCommands();
      unsubscribeFilesOpened();
    };
  }, [handleCommand, openEntries, quietmark]);

  useEffect(() => {
    void quietmark.app.consumePendingFilesOpened()
      .then((entries) => {
        if (entries.length > 0) {
          openEntries(entries);
        }
      })
      .catch(() => {});
  }, [openEntries, quietmark]);

  useEffect(() => {
    if (!activeTab) {
      quietmark.app.setTitle('AsterNote');
      return;
    }
    quietmark.app.setTitle(`${activeTab.isDirty ? '• ' : ''}${activeTab.name} — AsterNote`);
  }, [activeTab, quietmark]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings?.theme || DEFAULT_SETTINGS_FALLBACK.theme;
    document.documentElement.dataset.uiLanguage = uiLanguage;
    document.documentElement.lang = uiLanguage === 'zh-CN' ? 'zh-CN' : 'en';
  }, [settings, uiLanguage]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!sidebarResizeRef.current) return;
      const delta = sidebarResizeRef.current.startX - event.clientX;
      const nextWidth = sidebarResizeRef.current.startWidth + delta;
      setSidebarWidth(Math.max(180, Math.min(560, nextWidth)));
    };

    const stopResize = () => {
      if (!sidebarResizeRef.current) return;
      sidebarResizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResize);
    };
  }, []);

  return (
    <div className="qm-app-shell">
      {!hasNativeApi && (
        <div className="qm-browser-note">
          {ui.app.browserFallbackNote}
        </div>
      )}
      <TabsBar
        tabs={tabs}
        activeTabId={activeTabId}
        uiLanguage={uiLanguage}
        onSelect={setActiveTabId}
        onClose={closeTab}
        onNew={createNewTab}
      />

      <Toolbar
        viewMode={activeTab?.viewMode || 'rich'}
        terminalVisible={showTerminal}
        hasUnsavedChanges={Boolean(activeTab?.isDirty)}
        uiLanguage={uiLanguage}
        onCommand={(command) => void handleCommand(command)}
      />

      <div className="qm-workspace">
        <main className="qm-editor-stage">
          {activeTab ? (
            <>
              <div className="qm-editor-stack">
                <div className="qm-editor-frame">
                  {activeTab.viewMode === 'rich' ? (
                    <RichMarkdownEditor
                      uiLanguage={uiLanguage}
                      documentPath={activeTab.path}
                      markdown={activeTab.markdown}
                      fontSize={settings?.fontSize || 16}
                      onDropFiles={(files, position) => {
                        void handleDroppedFiles(files, 'rich', position);
                      }}
                      onReady={(editor) => {
                        editorRef.current = editor;
                      }}
                      onSelectionChange={handleEditorSelectionChange}
                      onMarkdownChange={(markdown, cachedContent) => {
                        updateActiveTab((tab) => ({
                          ...tab,
                          markdown,
                          cachedContent,
                          isDirty: isTabSnapshotDirty(tab, markdown, cachedContent),
                        }));
                      }}
                    />
                  ) : (
                    <textarea
                      ref={sourceTextareaRef}
                      className="qm-source-editor"
                      value={activeTab.markdown}
                      style={{ fontSize: `${settings?.fontSize || 16}px` }}
                      onChange={(event) => {
                        const markdown = event.target.value;
                        updateActiveTab((tab) => ({
                          ...tab,
                          markdown,
                          cachedContent: undefined,
                          isDirty: isTabSnapshotDirty(tab, markdown),
                        }));
                      }}
                      onSelect={(event) => {
                        const target = event.target as HTMLTextAreaElement;
                        handleEditorSelectionChange({
                          mode: 'source',
                          start: target.selectionStart,
                          end: target.selectionEnd,
                          text: target.value.slice(target.selectionStart, target.selectionEnd),
                        });
                      }}
                      onDragOver={(event) => {
                        if (event.dataTransfer?.files?.length) {
                          event.preventDefault();
                        }
                      }}
                      onDrop={(event) => {
                        const files = Array.from(event.dataTransfer?.files || []);
                        if (files.length === 0) return;
                        event.preventDefault();
                        void handleDroppedFiles(files, 'source');
                      }}
                    />
                  )}
                </div>

                <TerminalPanel
                  visible={showTerminal}
                  api={quietmark}
                  documentPath={activeTab.path}
                  onClose={() => setShowTerminal(false)}
                />
              </div>
            </>
          ) : (
            <>
              <WelcomeScreen
                uiLanguage={uiLanguage}
                recentFiles={settings?.recentFiles || []}
                onOpenFile={() => void openFileDialog()}
                onNewDraft={createNewTab}
                onOpenRecent={(filePath) => void openRecentFile(filePath)}
              />

              <TerminalPanel
                visible={showTerminal}
                api={quietmark}
                documentPath={null}
                onClose={() => setShowTerminal(false)}
              />
            </>
          )}
        </main>

        <RightSidebar
          visible={showSidebar}
          section={sidebarSection}
          uiLanguage={uiLanguage}
          sidebarWidth={sidebarWidth}
          onResizeStart={(event) => {
            sidebarResizeRef.current = {
              startX: event.clientX,
              startWidth: sidebarWidth,
            };
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
          activeToolPanel={activeToolPanel}
          onToggleToolsPanel={toggleToolsPanel}
          onToolPanelSelect={showToolPanel}
          onToggleAiPanel={toggleAiPanel}
          outline={outline}
          stats={stats}
          activeTab={activeTab}
          findTerm={findTerm}
          replaceTerm={replaceTerm}
          onFindTermChange={setFindTerm}
          onReplaceTermChange={setReplaceTerm}
          onReplaceSelection={handleReplaceSelection}
          onReplaceAll={handleReplaceAll}
          onOutlineSelect={jumpToOutlineItem}
          aiSessions={aiSessions}
          activeAiSessionId={activeAiSessionId}
          aiMessages={aiMessages}
          aiDraft={aiDraft}
          aiBusy={aiBusy}
          providers={settings?.aiProviders || []}
          selectedProviderId={selectedProviderId}
          onSelectProvider={setSelectedProviderId}
          useWebSearch={useWebSearch}
          webSearchConfigured={isWebSearchReady(settings)}
          onToggleWebSearch={handleToggleWebSearch}
          onSelectAiSession={(sessionId) => {
            setActiveAiSessionId(sessionId);
            setFocusAiInputToken((value) => value + 1);
          }}
          onCreateAiSession={createAiSession}
          onAiDraftChange={(value) => {
            if (!activeAiSessionId) return;
            setAiDrafts((current) => ({ ...current, [activeAiSessionId]: value }));
          }}
          onSendAiMessage={() => void sendAiMessage()}
          onQuickAction={(action) => void runQuickAction(action)}
          onApplyAiReplace={(content) => applyAiResult(content, true)}
          onApplyAiAppend={(content) => applyAiResult(content, false)}
          onOpenSettings={() => openSettingsSection('editor')}
          focusAiInputToken={focusAiInputToken}
        />
      </div>

      <InputDialog
        key={insertDialog ? `${insertDialog.kind}:${insertDialog.title}:${insertDialog.initialValue}` : 'insert-dialog'}
        open={Boolean(insertDialog)}
        title={insertDialog?.title || ''}
        label={insertDialog?.label || ''}
        initialValue={insertDialog?.initialValue || ''}
        placeholder={insertDialog?.placeholder || ''}
        submitLabel={insertDialog?.submitLabel || ui.common.add}
        multiline={Boolean(insertDialog?.multiline)}
        onClose={() => setInsertDialog(null)}
        onSubmit={submitInsertDialog}
      />

      <MathComposerDialog
        open={Boolean(mathComposerDialog)}
        title={mathComposerDialog?.title || ''}
        uiLanguage={uiLanguage}
        markdown={activeTab?.markdown || ''}
        initialMode={mathComposerDialog?.initialMode || 'block'}
        onClose={() => setMathComposerDialog(null)}
        onInsertMath={insertMathContent}
      />

      <EmojiPickerDialog
        open={showEmojiDialog}
        uiLanguage={uiLanguage}
        onClose={() => setShowEmojiDialog(false)}
        onInsertEmoji={insertEmojiValue}
      />

      <HelpDialog
        open={Boolean(helpDialog)}
        kind={helpDialog}
        uiLanguage={uiLanguage}
        onClose={() => setHelpDialog(null)}
      />

      <SettingsModal
        open={showSettings}
        activeSection={settingsSection}
        settings={settings}
        onClose={() => setShowSettings(false)}
        onSave={async (nextSettings) => {
          const saved = await quietmark.settings.update(nextSettings);
          setSettings(saved);
          setUseWebSearch((current) => current && isWebSearchReady(saved));
          setSelectedProviderId(getPreferredProviderId(saved));
        }}
        onReset={async () => {
          const next = await quietmark.settings.reset();
          setSettings(next);
          setUseWebSearch(false);
          setSelectedProviderId(getPreferredProviderId(next));
        }}
        onValidateProvider={(provider) => quietmark.ai.validateProvider(provider)}
        onValidateWebSearch={(config) => quietmark.ai.validateWebSearch(config)}
        onClearAiMemory={() => void clearAiMemory()}
      />
    </div>
  );
}

export default App;
