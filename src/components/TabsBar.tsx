import { Plus, X } from './icons';
import type { UILanguage } from '../electron';
import { getUiText } from '../lib/uiText';
import type { AppTab } from '../types';

interface TabsBarProps {
  tabs: AppTab[];
  activeTabId: string | null;
  uiLanguage: UILanguage;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onNew: () => void;
}

export function TabsBar({ tabs, activeTabId, uiLanguage, onSelect, onClose, onNew }: TabsBarProps) {
  const ui = getUiText(uiLanguage);

  return (
    <div className="qm-tabs-bar">
      <div className="qm-tabs-track">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div key={tab.id} className={`qm-tab ${isActive ? 'is-active' : ''}`}>
              <button
                type="button"
                className="qm-tab-main"
                onClick={() => onSelect(tab.id)}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="qm-tab-label">{tab.name}</span>
                <span
                  className={`qm-dirty-dot ${tab.isDirty ? 'is-dirty' : 'is-clean'}`}
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                className="qm-tab-close"
                onClick={() => onClose(tab.id)}
                aria-label={ui.tabs.closeTab(tab.name)}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>

      <button type="button" className="qm-tab-add" onClick={onNew} aria-label={ui.tabs.newTab}>
        <Plus size={16} />
      </button>
    </div>
  );
}
