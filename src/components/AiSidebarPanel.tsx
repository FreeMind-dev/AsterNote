import { useEffect, useMemo, useRef, useState } from 'react';

import type { AIProviderConfig, SearchHit, UILanguage } from '../electron';
import { getUiText } from '../lib/uiText';
import type { AIMessage, AISession } from '../types';
import {
  ArrowUp,
  Bot,
  Globe,
  MessageSquareText,
  Plus,
  Search,
  Sparkles,
  TextQuote,
} from './icons';

interface AiSidebarPanelProps {
  uiLanguage: UILanguage;
  sessions: AISession[];
  activeSessionId: string | null;
  aiMessages: AIMessage[];
  aiDraft: string;
  aiBusy: boolean;
  providers: AIProviderConfig[];
  selectedProviderId: string;
  useWebSearch: boolean;
  webSearchConfigured: boolean;
  focusAiInputToken: number;
  onSelectAiSession: (sessionId: string) => void;
  onCreateAiSession: () => void;
  onSelectProvider: (providerId: string) => void;
  onToggleWebSearch: () => void;
  onAiDraftChange: (value: string) => void;
  onSendAiMessage: () => void;
  onQuickAction: (action: 'polish' | 'summarize' | 'translate' | 'continue') => void;
  onApplyAiReplace: (content: string) => void;
  onApplyAiAppend: (content: string) => void;
}

function SourceList({ sources, uiLanguage }: { sources: SearchHit[]; uiLanguage: UILanguage }) {
  const ui = getUiText(uiLanguage);

  return (
    <div className="qm-ai-sources">
      {sources.slice(0, 3).map((source) => (
        <div key={source.url} className="qm-ai-source-card">
          <strong>{source.title}</strong>
          <div className="qm-ai-source-meta">
            {[source.source, source.age].filter(Boolean).join(' · ') || ui.common.webResult}
          </div>
          {source.contentExcerpt && <p>{source.contentExcerpt}</p>}
          <span>{source.url}</span>
        </div>
      ))}
    </div>
  );
}

export function AiSidebarPanel({
  uiLanguage,
  sessions,
  activeSessionId,
  aiMessages,
  aiDraft,
  aiBusy,
  providers,
  selectedProviderId,
  useWebSearch,
  webSearchConfigured,
  focusAiInputToken,
  onSelectAiSession,
  onCreateAiSession,
  onSelectProvider,
  onToggleWebSearch,
  onAiDraftChange,
  onSendAiMessage,
  onQuickAction,
  onApplyAiReplace,
  onApplyAiAppend,
}: AiSidebarPanelProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const ui = getUiText(uiLanguage);

  useEffect(() => {
    if (focusAiInputToken === 0) return;
    inputRef.current?.focus();
  }, [focusAiInputToken]);

  const enabledProviders = useMemo(
    () => providers.filter((provider) => provider.enabled && provider.hasApiKey),
    [providers]
  );

  useEffect(() => {
    if (!historyOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!historyRef.current?.contains(event.target as Node)) {
        setHistoryOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [historyOpen]);

  return (
    <div className="qm-ai-panel">
      <div className="qm-ai-session-bar">
        <div className="qm-ai-session-tabs">
          {sessions.map((session) => {
            const sessionLabel = session.messages.length === 0 ? ui.ai.emptyTitle : session.title;
            return (
              <button
                key={session.id}
                type="button"
                className={`qm-ai-session-tab ${activeSessionId === session.id ? 'is-active' : ''}`}
                onClick={() => onSelectAiSession(session.id)}
                title={sessionLabel}
              >
                {sessionLabel}
              </button>
            );
          })}
        </div>

        <div ref={historyRef} className="qm-ai-session-actions">
          <button
            type="button"
            className="qm-icon-button qm-icon-button--small"
            onClick={onCreateAiSession}
            title={ui.ai.newSession}
            aria-label={ui.ai.newSession}
          >
            <Plus size={13} />
          </button>
          <button
            type="button"
            className="qm-icon-button qm-icon-button--small"
            onClick={() => setHistoryOpen((current) => !current)}
            title={ui.ai.history}
            aria-label={ui.ai.history}
          >
            <MessageSquareText size={13} />
          </button>

          {historyOpen && (
            <div className="qm-ai-history-menu">
              {sessions.map((session) => {
                const sessionLabel = session.messages.length === 0 ? ui.ai.emptyTitle : session.title;
                return (
                  <button
                    key={session.id}
                    type="button"
                    className={`qm-ai-history-item ${activeSessionId === session.id ? 'is-active' : ''}`}
                    onClick={() => {
                      onSelectAiSession(session.id);
                      setHistoryOpen(false);
                    }}
                    title={sessionLabel}
                  >
                    {sessionLabel}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="qm-ai-thread-shell">
        <div className="qm-ai-thread qm-ai-thread--scroll">
          {aiMessages.length === 0 ? (
            <div className="qm-ai-empty-state">
              <Bot size={18} />
              <strong>{ui.ai.emptyTitle}</strong>
              <span>{ui.ai.emptyBody}</span>
            </div>
          ) : (
            aiMessages.map((message) => (
              <div
                key={message.id}
                className={`qm-ai-message ${message.role === 'assistant' ? 'is-assistant' : 'is-user'}`}
              >
                <div className="qm-ai-message-role">
                  {message.role === 'assistant' ? ui.ai.assistant : ui.ai.you}
                  {message.searchUsed ? ui.ai.webSearchSuffix : ''}
                </div>
                <div className="qm-ai-message-content">{message.content}</div>

                {message.sources && message.sources.length > 0 && (
                  <SourceList sources={message.sources} uiLanguage={uiLanguage} />
                )}

                {message.role === 'assistant' && (
                  <div className="qm-inline-actions qm-inline-actions--compact">
                    <button type="button" onClick={() => onApplyAiReplace(message.content)}>
                      {ui.ai.replaceSelection}
                    </button>
                    <button type="button" onClick={() => onApplyAiAppend(message.content)}>
                      {ui.ai.insertAtCursor}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="qm-ai-composer">
        <div className="qm-ai-composer-header">
          <div className="qm-ai-quick-icons" aria-label={ui.ai.quickActions}>
            <button
              type="button"
              className="qm-ai-utility-button"
              onClick={() => onQuickAction('polish')}
              title={ui.ai.polish}
              aria-label={ui.ai.polish}
            >
              <Sparkles size={13} />
            </button>
            <button
              type="button"
              className="qm-ai-utility-button"
              onClick={() => onQuickAction('summarize')}
              title={ui.ai.summarize}
              aria-label={ui.ai.summarize}
            >
              <Search size={13} />
            </button>
            <button
              type="button"
              className="qm-ai-utility-button"
              onClick={() => onQuickAction('translate')}
              title={ui.ai.translate}
              aria-label={ui.ai.translate}
            >
              <TextQuote size={13} />
            </button>
          </div>
        </div>

        <textarea
          ref={inputRef}
          value={aiDraft}
          onChange={(event) => onAiDraftChange(event.target.value)}
          placeholder={ui.ai.promptPlaceholder}
          rows={3}
        />

        <div className="qm-ai-composer-toolbar">
          <div className="qm-ai-composer-toolbar-main">
            <label className={`qm-ai-provider-select ${enabledProviders.length === 0 ? 'is-empty' : ''}`}>
              <select
                value={selectedProviderId}
                onChange={(event) => onSelectProvider(event.target.value)}
                disabled={enabledProviders.length === 0}
              >
                {enabledProviders.length === 0 ? (
                  <option value="">{ui.ai.noEnabledProviders}</option>
                ) : (
                  enabledProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} · {provider.model}
                    </option>
                  ))
                )}
              </select>
            </label>

            <button
              type="button"
              className={`qm-ai-utility-button ${useWebSearch ? 'is-active' : ''}`}
              onClick={onToggleWebSearch}
              title={webSearchConfigured ? ui.ai.toggleWebSearch : ui.ai.configureWebSearchFirst}
              aria-label={webSearchConfigured ? ui.ai.toggleWebSearch : ui.ai.configureWebSearchFirst}
            >
              <Globe size={13} />
            </button>
          </div>

          <div className="qm-ai-composer-toolbar-actions">
            <button
              type="button"
              className="qm-ai-send-button"
              disabled={aiBusy || enabledProviders.length === 0}
              onClick={onSendAiMessage}
              aria-label={aiBusy ? ui.ai.thinking : ui.ai.sendPrompt}
            >
              {aiBusy ? <span className="qm-ai-send-button-label">...</span> : <ArrowUp size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
