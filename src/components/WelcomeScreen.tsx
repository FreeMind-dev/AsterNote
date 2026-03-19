import type { UILanguage } from '../electron';
import { getUiText } from '../lib/uiText';
import { FileText, FileUp, Plus, Sparkles } from './icons';

interface WelcomeScreenProps {
  recentFiles: string[];
  uiLanguage: UILanguage;
  onOpenFile: () => void;
  onNewDraft: () => void;
  onOpenRecent: (filePath: string) => void;
}

function compactPath(filePath: string) {
  const parts = filePath.split('/');
  if (parts.length <= 4) return filePath;
  return `.../${parts.slice(-3).join('/')}`;
}

export function WelcomeScreen({
  recentFiles,
  uiLanguage,
  onOpenFile,
  onNewDraft,
  onOpenRecent,
}: WelcomeScreenProps) {
  const visibleRecent = recentFiles.slice(0, 6);
  const ui = getUiText(uiLanguage);

  return (
    <div className="qm-empty-stage">
      <div className="qm-welcome-shell">
        <div className="qm-welcome-hero">
          <div className="qm-welcome-badge">
            <Sparkles size={14} />
            {ui.welcome.badge}
          </div>
          <h1>{ui.welcome.title}</h1>
          <p>{ui.welcome.description}</p>

          <div className="qm-inline-actions">
            <button type="button" className="qm-primary-button" onClick={onOpenFile}>
              <FileUp size={14} />
              {ui.welcome.openMarkdown}
            </button>
            <button type="button" className="qm-secondary-button" onClick={onNewDraft}>
              <Plus size={14} />
              {ui.welcome.newDraft}
            </button>
          </div>
        </div>

        <div className="qm-welcome-grid">
          <section className="qm-welcome-card">
            <div className="qm-welcome-card-title">{ui.welcome.recentFiles}</div>
            {visibleRecent.length === 0 ? (
              <div className="qm-empty-note">{ui.welcome.recentEmpty}</div>
            ) : (
              <div className="qm-recent-list">
                {visibleRecent.map((filePath) => (
                  <button
                    key={filePath}
                    type="button"
                    className="qm-recent-item"
                    onClick={() => onOpenRecent(filePath)}
                    title={filePath}
                  >
                    <FileText size={14} />
                    <span className="qm-recent-item-body">
                      <strong>{filePath.split('/').pop() || filePath}</strong>
                      <span>{compactPath(filePath)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="qm-welcome-card">
            <div className="qm-welcome-card-title">{ui.welcome.quickStart}</div>
            <div className="qm-welcome-steps">
              <div>
                <strong>{ui.welcome.step1Title}</strong>
                <span>{ui.welcome.step1Body}</span>
              </div>
              <div>
                <strong>{ui.welcome.step2Title}</strong>
                <span>{ui.welcome.step2Body}</span>
              </div>
              <div>
                <strong>{ui.welcome.step3Title}</strong>
                <span>{ui.welcome.step3Body}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
