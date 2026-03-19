import type { MouseEvent as ReactMouseEvent } from 'react';

import type { AIProviderConfig, UILanguage } from '../electron';
import { MARKDOWN_SYNTAX_HELP } from '../lib/defaults';
import { getUiText } from '../lib/uiText';
import type { AIMessage, AISession, AppTab, DocumentStats, OutlineItem, SidebarSection, ToolPanelId } from '../types';
import { AiSidebarPanel } from './AiSidebarPanel';
import { Bot, Settings2, Wrench } from './icons';

interface RightSidebarProps {
  visible: boolean;
  section: SidebarSection;
  uiLanguage: UILanguage;
  sidebarWidth: number;
  onResizeStart: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  activeToolPanel: ToolPanelId;
  onToggleToolsPanel: () => void;
  onToolPanelSelect: (panel: ToolPanelId) => void;
  onToggleAiPanel: () => void;
  outline: OutlineItem[];
  stats: DocumentStats;
  activeTab: AppTab | null;
  findTerm: string;
  replaceTerm: string;
  onFindTermChange: (value: string) => void;
  onReplaceTermChange: (value: string) => void;
  onReplaceSelection: () => void;
  onReplaceAll: () => void;
  onOutlineSelect: (item: OutlineItem) => void;
  aiSessions: AISession[];
  activeAiSessionId: string | null;
  aiMessages: AIMessage[];
  aiDraft: string;
  aiBusy: boolean;
  providers: AIProviderConfig[];
  selectedProviderId: string;
  onSelectProvider: (providerId: string) => void;
  useWebSearch: boolean;
  webSearchConfigured: boolean;
  onToggleWebSearch: () => void;
  onSelectAiSession: (sessionId: string) => void;
  onCreateAiSession: () => void;
  onAiDraftChange: (value: string) => void;
  onSendAiMessage: () => void;
  onQuickAction: (action: 'polish' | 'summarize' | 'translate' | 'continue') => void;
  onApplyAiReplace: (content: string) => void;
  onApplyAiAppend: (content: string) => void;
  onOpenSettings: () => void;
  focusAiInputToken: number;
}

const TOOL_BUTTONS: Array<{
  id: ToolPanelId;
}> = [
  { id: 'outline' },
  { id: 'info' },
  { id: 'find' },
  { id: 'syntax' },
];

export function RightSidebar({
  visible,
  section,
  uiLanguage,
  sidebarWidth,
  onResizeStart,
  activeToolPanel,
  onToggleToolsPanel,
  onToolPanelSelect,
  onToggleAiPanel,
  outline,
  stats,
  activeTab,
  findTerm,
  replaceTerm,
  onFindTermChange,
  onReplaceTermChange,
  onReplaceSelection,
  onReplaceAll,
  onOutlineSelect,
  aiSessions,
  activeAiSessionId,
  aiMessages,
  aiDraft,
  aiBusy,
  providers,
  selectedProviderId,
  onSelectProvider,
  useWebSearch,
  webSearchConfigured,
  onToggleWebSearch,
  onSelectAiSession,
  onCreateAiSession,
  onAiDraftChange,
  onSendAiMessage,
  onQuickAction,
  onApplyAiReplace,
  onApplyAiAppend,
  onOpenSettings,
  focusAiInputToken,
}: RightSidebarProps) {
  const ui = getUiText(uiLanguage);

  return (
    <aside className="qm-sidebar-shell">
      {visible && (
        <button
          type="button"
          className="qm-sidebar-resize-handle"
          onMouseDown={onResizeStart}
          aria-label={ui.sidebar.resizeSidebar}
        />
      )}

      {visible && (
        <div className="qm-sidebar-panel" style={{ width: `${sidebarWidth}px` }}>
          {section === 'tools' && (
            <div className="qm-sidebar-panel-toolbar">
              {TOOL_BUTTONS.map((button) => (
                <button
                  key={button.id}
                  type="button"
                  className={`qm-sidebar-tab ${activeToolPanel === button.id ? 'is-active' : ''}`}
                  onClick={() => onToolPanelSelect(button.id)}
                >
                  {ui.sidebar[button.id]}
                </button>
              ))}
            </div>
          )}

          <div className="qm-sidebar-body">
            {section === 'tools' ? (
              <div className="qm-tool-panel">
                {activeToolPanel === 'outline' && (
                  <>
                    <div className="qm-panel-title">{ui.sidebar.structure}</div>
                    {outline.length === 0 ? (
                      <div className="qm-empty-note">{ui.sidebar.addHeadings}</div>
                    ) : (
                      <div className="qm-outline-list">
                        {outline.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="qm-outline-item"
                            style={{ paddingLeft: `${Math.max(0.72, item.level * 0.62)}rem` }}
                            onClick={() => onOutlineSelect(item)}
                          >
                            {item.text}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {activeToolPanel === 'info' && (
                  <>
                    <div className="qm-panel-title">{ui.sidebar.documentInfo}</div>
                    <div className="qm-stat-grid">
                      <StatCard label={ui.sidebar.words} value={stats.words} />
                      <StatCard label={ui.sidebar.chars} value={stats.characters} />
                      <StatCard label={ui.sidebar.noSpaces} value={stats.charactersWithoutSpaces} />
                      <StatCard label={ui.sidebar.paragraphs} value={stats.paragraphs} />
                      <StatCard label={ui.sidebar.headings} value={stats.headings} />
                      <StatCard label={ui.sidebar.images} value={stats.images} />
                    </div>

                    <div className="qm-tool-section">
                      <dl className="qm-meta-list">
                        <MetaRow label={ui.sidebar.name} value={activeTab?.name || ui.common.untitled} />
                        <MetaRow label={ui.sidebar.path} value={activeTab?.path || ui.common.notSavedYet} />
                        <MetaRow
                          label={ui.sidebar.mode}
                          value={activeTab?.viewMode === 'source' ? ui.common.source : ui.common.rich}
                        />
                        <MetaRow
                          label={ui.sidebar.status}
                          value={activeTab?.isDirty ? ui.common.unsavedChanges : ui.common.saved}
                        />
                        <MetaRow
                          label={ui.sidebar.modified}
                          value={
                            activeTab?.lastModified
                              ? new Date(activeTab.lastModified).toLocaleString()
                              : ui.common.notAvailable
                          }
                        />
                      </dl>
                    </div>
                  </>
                )}

                {activeToolPanel === 'find' && (
                  <>
                    <div className="qm-panel-title">{ui.sidebar.findReplace}</div>
                    <label className="qm-field qm-field--tight">
                      <span>{ui.sidebar.findLabel}</span>
                      <input
                        value={findTerm}
                        onChange={(event) => onFindTermChange(event.target.value)}
                        placeholder={ui.sidebar.findPlaceholder}
                      />
                    </label>
                    <label className="qm-field qm-field--tight">
                      <span>{ui.sidebar.replaceLabel}</span>
                      <input
                        value={replaceTerm}
                        onChange={(event) => onReplaceTermChange(event.target.value)}
                        placeholder={ui.sidebar.replacePlaceholder}
                      />
                    </label>
                    <div className="qm-inline-actions qm-inline-actions--compact">
                      <button type="button" onClick={onReplaceSelection}>
                        {ui.sidebar.replaceSelection}
                      </button>
                      <button type="button" onClick={onReplaceAll}>
                        {ui.sidebar.replaceAll}
                      </button>
                    </div>
                    <div className="qm-empty-note">{ui.sidebar.replaceHelp}</div>
                  </>
                )}

                {activeToolPanel === 'syntax' && (
                  <>
                    <div className="qm-panel-title">{ui.sidebar.markdownCheatsheet}</div>
                    <div className="qm-syntax-groups">
                      {MARKDOWN_SYNTAX_HELP.map((category) => (
                        <section key={category.category} className="qm-syntax-group">
                          <div className="qm-syntax-group-title">
                            {ui.syntax.categories[category.category as keyof typeof ui.syntax.categories] || category.category}
                          </div>
                          <div className="qm-syntax-list">
                            {category.items.map((item) => (
                              <div key={`${category.category}-${item.syntax}`} className="qm-syntax-item">
                                <code>{item.syntax}</code>
                                <span>
                                  {ui.syntax.descriptions[item.desc as keyof typeof ui.syntax.descriptions] || item.desc}
                                </span>
                              </div>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <AiSidebarPanel
                uiLanguage={uiLanguage}
                sessions={aiSessions}
                activeSessionId={activeAiSessionId}
                aiMessages={aiMessages}
                aiDraft={aiDraft}
                aiBusy={aiBusy}
                providers={providers}
                selectedProviderId={selectedProviderId}
                useWebSearch={useWebSearch}
                webSearchConfigured={webSearchConfigured}
                focusAiInputToken={focusAiInputToken}
                onSelectAiSession={onSelectAiSession}
                onCreateAiSession={onCreateAiSession}
                onSelectProvider={onSelectProvider}
                onToggleWebSearch={onToggleWebSearch}
                onAiDraftChange={onAiDraftChange}
                onSendAiMessage={onSendAiMessage}
                onQuickAction={onQuickAction}
                onApplyAiReplace={onApplyAiReplace}
                onApplyAiAppend={onApplyAiAppend}
                onOpenSettings={onOpenSettings}
              />
            )}
          </div>
        </div>
      )}

      <div className="qm-sidebar-rail">
        <button
          type="button"
          className={`qm-sidebar-rail-button ${visible && section === 'tools' ? 'is-active' : ''}`}
          onClick={onToggleToolsPanel}
          title={ui.sidebar.toolsRail}
          aria-label={ui.sidebar.toolsRail}
        >
          <Wrench size={16} />
        </button>

        <button
          type="button"
          className={`qm-sidebar-rail-button ${visible && section === 'ai' ? 'is-active' : ''}`}
          onClick={onToggleAiPanel}
          title={ui.sidebar.aiRail}
          aria-label={ui.sidebar.aiRail}
        >
          <Bot size={16} />
        </button>

        <div className="qm-sidebar-rail-divider" />

        <button
          type="button"
          className="qm-sidebar-rail-button"
          onClick={onOpenSettings}
          title={ui.sidebar.preferencesRail}
          aria-label={ui.sidebar.preferencesRail}
        >
          <Settings2 size={16} />
        </button>
      </div>
    </aside>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="qm-stat-card">
      <div className="qm-stat-label">{label}</div>
      <div className="qm-stat-value">{value}</div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="qm-meta-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
