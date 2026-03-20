import { useEffect, useRef, useState } from 'react';

import type {
  AIProviderConfig,
  AppSettings,
  WebSearchConfig,
  WebSearchProvider,
} from '../electron';
import { getUiText } from '../lib/uiText';
import { Plus, RotateCcw, ShieldCheck, Trash2, X } from './icons';

interface SettingsModalProps {
  open: boolean;
  settings: AppSettings | null;
  activeSection?: SettingsModalSectionId;
  onClose: () => void;
  onSave: (settings: AppSettings) => Promise<void>;
  onReset: () => Promise<void>;
  onClearAiMemory: () => Promise<void> | void;
  onValidateProvider: (provider: AIProviderConfig) => Promise<{ ok: boolean; message: string }>;
  onValidateWebSearch: (config: WebSearchConfig) => Promise<{ ok: boolean; message: string }>;
}

export type SettingsModalSectionId = 'editor' | 'aiProviders' | 'webSearch' | 'aiMemory';

const SEARCH_PROVIDER_OPTIONS: Array<{ id: WebSearchProvider; label: string }> = [
  { id: 'brave', label: 'Brave' },
  { id: 'tavily', label: 'Tavily' },
  { id: 'perplexity', label: 'Perplexity' },
  { id: 'google', label: 'Google' },
];

const SEARCH_PROVIDER_DEFAULTS: Record<WebSearchProvider, string> = {
  brave: 'https://api.search.brave.com/res/v1/web/search',
  tavily: 'https://api.tavily.com/search',
  perplexity: 'https://api.perplexity.ai/search',
  google: 'https://www.googleapis.com/customsearch/v1',
};

function maxSearchResults(provider: WebSearchProvider) {
  return provider === 'google' ? 10 : 20;
}

function isConfiguredProvider(provider: AIProviderConfig) {
  return Boolean(provider.hasApiKey || provider.apiKey?.trim());
}

export function SettingsModal({
  open,
  settings,
  activeSection = 'editor',
  onClose,
  onSave,
  onReset,
  onClearAiMemory,
  onValidateProvider,
  onValidateWebSearch,
}: SettingsModalProps) {
  const [draft, setDraft] = useState<AppSettings | null>(settings);
  const [saving, setSaving] = useState(false);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [testingWebSearch, setTestingWebSearch] = useState(false);
  const [visibleProviderIds, setVisibleProviderIds] = useState<string[]>([]);
  const editorSectionRef = useRef<HTMLElement | null>(null);
  const aiProvidersSectionRef = useRef<HTMLDivElement | null>(null);
  const webSearchSectionRef = useRef<HTMLDivElement | null>(null);
  const aiMemorySectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraft(settings);
    setVisibleProviderIds(
      (settings?.aiProviders || [])
        .filter(isConfiguredProvider)
        .map((provider) => provider.id)
    );
  }, [settings]);

  useEffect(() => {
    if (!open) return;

    const sectionMap: Record<SettingsModalSectionId, HTMLElement | null> = {
      editor: editorSectionRef.current,
      aiProviders: aiProvidersSectionRef.current,
      webSearch: webSearchSectionRef.current,
      aiMemory: aiMemorySectionRef.current,
    };

    const frame = window.requestAnimationFrame(() => {
      sectionMap[activeSection]?.scrollIntoView({ block: 'start', behavior: 'auto' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeSection, open, draft]);

  if (!open || !draft) {
    return null;
  }

  const ui = getUiText(draft.uiLanguage);

  const updateProvider = (providerId: string, patch: Partial<AIProviderConfig>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            aiProviders: current.aiProviders.map((provider) =>
              provider.id === providerId ? { ...provider, ...patch } : provider
            ),
          }
        : current
    );
  };

  const updateWebSearch = (patch: Partial<WebSearchConfig>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            webSearch: {
              ...current.webSearch,
              ...patch,
            },
          }
        : current
    );
  };

  const updateSearchProvider = (provider: WebSearchProvider) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        webSearch: {
          ...current.webSearch,
          provider,
          baseUrl: SEARCH_PROVIDER_DEFAULTS[provider],
          resultCount: Math.min(current.webSearch.resultCount, maxSearchResults(provider)),
        },
      };
    });
  };

  const setDefaultProvider = (providerId: string) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            aiProviders: current.aiProviders.map((provider) => ({
              ...provider,
              isDefault: provider.id === providerId,
            })),
          }
        : current
    );
  };

  const addProvider = () => {
    const id = `provider-${crypto.randomUUID().slice(0, 8)}`;
    setVisibleProviderIds((current) => [...current, id]);
    setDraft((current) =>
      current
        ? {
            ...current,
            aiProviders: [
              ...current.aiProviders,
              {
                id,
                name: ui.settings.customProvider,
                baseUrl: '',
                model: '',
                enabled: true,
                isDefault: current.aiProviders.length === 0,
                apiKey: '',
                hasApiKey: false,
                apiKeyMasked: '',
              },
            ],
          }
        : current
    );
  };

  const removeProvider = (providerId: string) => {
    setVisibleProviderIds((current) => current.filter((id) => id !== providerId));
    setDraft((current) => {
      if (!current) return current;
      const remaining = current.aiProviders.filter((provider) => provider.id !== providerId);
      if (remaining.length > 0 && !remaining.some((provider) => provider.isDefault)) {
        remaining[0] = { ...remaining[0], isDefault: true };
      }
      return {
        ...current,
        aiProviders: remaining,
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const visibleProviders = draft.aiProviders.filter((provider) =>
    visibleProviderIds.includes(provider.id)
  );
  const searchProvider = draft.webSearch.provider;
  const showSearchEngineId = searchProvider === 'google';
  const searchProviderHint =
    searchProvider === 'google'
      ? ui.settings.searchProviderHintGoogle
      : searchProvider === 'tavily'
        ? ui.settings.searchProviderHintTavily
        : searchProvider === 'perplexity'
          ? ui.settings.searchProviderHintPerplexity
          : ui.settings.searchProviderHintBrave;

  return (
    <div className="qm-modal-backdrop">
      <div className="qm-settings-modal">
        <div className="qm-settings-header">
          <div>
            <div className="qm-panel-title">{ui.settings.title}</div>
            <div className="qm-empty-note">{ui.settings.subtitle}</div>
          </div>
          <button type="button" className="qm-icon-button" onClick={onClose} aria-label={ui.common.close}>
            <X size={16} />
          </button>
        </div>

        <div className="qm-settings-grid">
          <section
            ref={editorSectionRef}
            className={`qm-settings-section${activeSection === 'editor' ? ' is-targeted' : ''}`}
          >
            <h3>{ui.settings.editor}</h3>
            <label className="qm-field">
              <span>{ui.settings.theme}</span>
              <select
                value={draft.theme}
                onChange={(event) =>
                  setDraft({ ...draft, theme: event.target.value as AppSettings['theme'] })
                }
              >
                <option value="paper">{ui.codeBlock.paper}</option>
                <option value="midnight">{ui.codeBlock.midnight}</option>
              </select>
            </label>
            <label className="qm-field">
              <span>{ui.settings.fontSize}</span>
              <input
                type="number"
                min={13}
                max={24}
                value={draft.fontSize}
                onChange={(event) =>
                  setDraft({ ...draft, fontSize: Number(event.target.value) || 16 })
                }
              />
            </label>
            <label className="qm-field">
              <span>{ui.settings.uiLanguage}</span>
              <select
                value={draft.uiLanguage}
                onChange={(event) =>
                  setDraft({ ...draft, uiLanguage: event.target.value as AppSettings['uiLanguage'] })
                }
              >
                <option value="en">{ui.settings.english}</option>
                <option value="zh-CN">{ui.settings.chinese}</option>
              </select>
            </label>
            <label className="qm-field">
              <span>{ui.settings.defaultView}</span>
              <select
                value={draft.defaultViewMode}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    defaultViewMode: event.target.value as AppSettings['defaultViewMode'],
                  })
                }
              >
                <option value="rich">{ui.settings.richText}</option>
                <option value="source">{ui.settings.sourceMode}</option>
              </select>
            </label>

            <div className="qm-settings-callout qm-settings-callout--muted">
              <div className="qm-settings-callout-title">{ui.settings.searchInChatTitle}</div>
              <div className="qm-empty-note">{ui.settings.searchInChatBody}</div>
            </div>
          </section>

          <section className="qm-settings-section">
            <div
              ref={aiProvidersSectionRef}
              className={`qm-settings-block${activeSection === 'aiProviders' ? ' is-targeted' : ''}`}
            >
              <div className="qm-settings-section-header">
                <div>
                  <h3>{ui.settings.aiProviders}</h3>
                  <div className="qm-empty-note">{ui.settings.aiProvidersBody}</div>
                </div>
                <button type="button" className="qm-secondary-button" onClick={addProvider}>
                  <Plus size={14} />
                  {ui.settings.addProvider}
                </button>
              </div>

              <div className="qm-provider-list">
                {visibleProviders.length === 0 && (
                  <div className="qm-empty-note">{ui.settings.noConfiguredProviders}</div>
                )}

                {visibleProviders.map((provider) => (
                  <div key={provider.id} className="qm-provider-card">
                    <div className="qm-provider-row">
                      <label className="qm-field qm-field--grow">
                        <span>{ui.settings.providerName}</span>
                        <input
                          value={provider.name}
                          placeholder={ui.settings.providerNamePlaceholder}
                          onChange={(event) =>
                            updateProvider(provider.id, { name: event.target.value })
                          }
                        />
                      </label>
                      <label className="qm-checkbox">
                        <input
                          type="checkbox"
                          checked={provider.enabled}
                          onChange={(event) =>
                            updateProvider(provider.id, { enabled: event.target.checked })
                          }
                        />
                        {ui.common.enabled}
                      </label>
                      <label className="qm-checkbox">
                        <input
                          type="radio"
                          name="default-provider"
                          checked={provider.isDefault}
                          onChange={() => setDefaultProvider(provider.id)}
                        />
                        {ui.common.default}
                      </label>
                    </div>

                    <label className="qm-field">
                      <span>{ui.settings.baseUrl}</span>
                      <input
                        value={provider.baseUrl}
                        placeholder={ui.settings.baseUrlPlaceholder}
                        onChange={(event) =>
                          updateProvider(provider.id, { baseUrl: event.target.value })
                        }
                      />
                    </label>

                    <div className="qm-provider-row">
                      <label className="qm-field qm-field--grow">
                        <span>{ui.settings.model}</span>
                        <input
                          value={provider.model}
                          placeholder={ui.settings.modelPlaceholder}
                          onChange={(event) =>
                            updateProvider(provider.id, { model: event.target.value })
                          }
                        />
                      </label>
                      <label className="qm-field qm-field--grow">
                        <span>{ui.settings.apiKey}</span>
                        <input
                          type="password"
                          placeholder={
                            provider.hasApiKey ? provider.apiKeyMasked || ui.settings.storedKey : ui.settings.pasteApiKey
                          }
                          onChange={(event) =>
                            updateProvider(provider.id, { apiKey: event.target.value })
                          }
                        />
                      </label>
                    </div>

                    <div className="qm-inline-actions qm-inline-actions--compact">
                      <button
                        type="button"
                        disabled={testingProviderId === provider.id}
                        onClick={async () => {
                          setTestingProviderId(provider.id);
                          try {
                            const result = await onValidateProvider(provider);
                            window.alert(result.message);
                          } finally {
                            setTestingProviderId(null);
                          }
                        }}
                      >
                        <ShieldCheck size={14} />
                        {testingProviderId === provider.id ? ui.settings.testingConnection : ui.settings.testConnection}
                      </button>
                      <button type="button" onClick={() => removeProvider(provider.id)}>
                        <Trash2 size={14} />
                        {ui.settings.removeProvider}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              ref={webSearchSectionRef}
              className={`qm-settings-block${activeSection === 'webSearch' ? ' is-targeted' : ''}`}
            >
              <div className="qm-settings-section-header qm-settings-section-header--spaced">
              <div>
                <h3>{ui.settings.webSearch}</h3>
                <div className="qm-empty-note">{ui.settings.webSearchBody}</div>
              </div>
              <button
                type="button"
                className="qm-secondary-button"
                disabled={testingWebSearch}
                onClick={async () => {
                  setTestingWebSearch(true);
                  try {
                    const result = await onValidateWebSearch(draft.webSearch);
                    window.alert(result.message);
                  } finally {
                    setTestingWebSearch(false);
                  }
                }}
              >
                <ShieldCheck size={14} />
                {testingWebSearch ? ui.settings.testingSearch : ui.settings.testSearch}
              </button>
              </div>
              <div className="qm-provider-card">
                <div className="qm-search-settings-top qm-search-settings-top--single">
                  <label className="qm-field qm-field--grow">
                    <span>{ui.settings.searchProvider}</span>
                    <select
                      value={searchProvider}
                      onChange={(event) => updateSearchProvider(event.target.value as WebSearchProvider)}
                    >
                      {SEARCH_PROVIDER_OPTIONS.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="qm-empty-note qm-search-settings-note">{searchProviderHint}</div>

                <label className="qm-field">
                  <span>{ui.settings.baseUrl}</span>
                  <input
                    value={draft.webSearch.baseUrl}
                    onChange={(event) => updateWebSearch({ baseUrl: event.target.value })}
                  />
                </label>

                <div className="qm-search-settings-row qm-search-settings-row--count">
                  <label className="qm-field qm-field--grow">
                    <span>{ui.settings.apiKey}</span>
                    <input
                      type="password"
                      placeholder={
                        draft.webSearch.hasApiKey
                          ? draft.webSearch.apiKeyMasked || ui.settings.storedKey
                          : ui.settings.pasteSearchKey
                      }
                      onChange={(event) => updateWebSearch({ apiKey: event.target.value })}
                    />
                  </label>
                  <label className="qm-field">
                    <span>{ui.settings.resultCount}</span>
                    <input
                      type="number"
                      min={1}
                      max={maxSearchResults(draft.webSearch.provider)}
                      value={draft.webSearch.resultCount}
                      onChange={(event) =>
                        updateWebSearch({
                          resultCount:
                            Math.max(
                              1,
                              Math.min(
                                maxSearchResults(draft.webSearch.provider),
                                Number(event.target.value) || 5
                              )
                            ),
                        })
                      }
                    />
                  </label>
                </div>

                {showSearchEngineId && (
                  <div className="qm-search-settings-row qm-search-settings-row--count">
                    <label className="qm-field qm-field--grow">
                      <span>{ui.settings.searchEngineId}</span>
                      <input
                        value={draft.webSearch.searchEngineId || ''}
                        onChange={(event) => updateWebSearch({ searchEngineId: event.target.value })}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div
              ref={aiMemorySectionRef}
              className={`qm-settings-block${activeSection === 'aiMemory' ? ' is-targeted' : ''}`}
            >
              <div className="qm-settings-section-header qm-settings-section-header--spaced">
                <h3>{ui.settings.aiMemory}</h3>
              </div>

              <div className="qm-provider-card">
                <label className="qm-checkbox">
                  <input
                    type="checkbox"
                    checked={draft.aiMemory.enabled}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        aiMemory: {
                          ...draft.aiMemory,
                          enabled: event.target.checked,
                        },
                      })
                    }
                  />
                  {ui.settings.enableMemory}
                </label>

                <div className="qm-empty-note">{ui.settings.memoryBody}</div>

                <div className="qm-inline-actions qm-inline-actions--compact">
                  <button type="button" onClick={async () => onClearAiMemory()}>
                    <Trash2 size={14} />
                    {ui.settings.clearLongTermMemory}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="qm-settings-footer">
          <button
            type="button"
            className="qm-secondary-button"
            onClick={async () => {
              await onReset();
            }}
          >
            <RotateCcw size={14} />
            {ui.settings.reset}
          </button>
          <div className="qm-inline-actions">
            <button type="button" className="qm-secondary-button" onClick={onClose}>
              {ui.common.cancel}
            </button>
            <button type="button" className="qm-primary-button" onClick={handleSave} disabled={saving}>
              {saving ? ui.settings.savingPreferences : ui.settings.savePreferences}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
