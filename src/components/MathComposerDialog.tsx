import { useEffect } from 'react';

import type { UILanguage } from '../electron';
import { getUiText } from '../lib/uiText';
import { X } from './icons';
import { MathComposer } from './MathComposer';

interface MathComposerDialogProps {
  open: boolean;
  title: string;
  uiLanguage: UILanguage;
  markdown: string;
  initialMode: 'inline' | 'block';
  onClose: () => void;
  onInsertMath: (latex: string, mode: 'inline' | 'block') => void;
}

export function MathComposerDialog({
  open,
  title,
  uiLanguage,
  markdown,
  initialMode,
  onClose,
  onInsertMath,
}: MathComposerDialogProps) {
  const ui = getUiText(uiLanguage);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="qm-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="qm-input-modal qm-input-modal--math" onMouseDown={(event) => event.stopPropagation()}>
        <div className="qm-settings-header">
          <div>
            <div className="qm-panel-title">{title}</div>
            <div className="qm-empty-note">{ui.dialogs.mathComposerHint}</div>
          </div>
          <button type="button" className="qm-icon-button" onClick={onClose} aria-label={ui.dialogs.closeMathComposer}>
            <X size={16} />
          </button>
        </div>

        <div className="qm-input-modal-body qm-input-modal-body--math">
          <MathComposer
            markdown={markdown}
            initialMode={initialMode}
            uiLanguage={uiLanguage}
            onInsertMath={(latex, mode) => {
              onInsertMath(latex, mode);
              onClose();
            }}
            insertLabel={initialMode === 'inline' ? ui.math.insertInlineFormula : ui.math.insertFormulaBlock}
            showTitle={false}
            showDocumentHistory={false}
            className="qm-math-tool qm-math-tool--dialog"
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
