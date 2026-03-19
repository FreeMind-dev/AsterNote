import { useEffect, useRef, useState } from 'react';

import { getDocumentUiLanguage, getUiText } from '../lib/uiText';
import { X } from './icons';

interface InputDialogProps {
  open: boolean;
  title: string;
  label: string;
  initialValue: string;
  placeholder?: string;
  submitLabel: string;
  multiline?: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
}

export function InputDialog({
  open,
  title,
  label,
  initialValue,
  placeholder,
  submitLabel,
  multiline = false,
  onClose,
  onSubmit,
}: InputDialogProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const ui = getUiText(getDocumentUiLanguage());
  const bindInputRef = (element: HTMLInputElement | HTMLTextAreaElement | null) => {
    inputRef.current = element;
  };

  useEffect(() => {
    if (!open) return undefined;

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
      if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select();
      }
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const handleSubmit = () => {
    if (!value.trim()) return;
    onSubmit(value);
  };

  return (
    <div
      className="qm-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="qm-input-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="qm-settings-header">
          <div>
            <div className="qm-panel-title">{title}</div>
            <div className="qm-empty-note">
              {multiline ? ui.dialogs.inputMultiLineHint : ui.dialogs.inputSingleLineHint}
            </div>
          </div>
          <button type="button" className="qm-icon-button" onClick={onClose} aria-label={ui.dialogs.closeInput}>
            <X size={16} />
          </button>
        </div>

        <div className="qm-input-modal-body">
          <label className="qm-field">
            <span>{label}</span>
            {multiline ? (
              <textarea
                ref={bindInputRef}
                value={value}
                placeholder={placeholder}
                onChange={(event) => setValue(event.target.value)}
              />
            ) : (
              <input
                ref={bindInputRef}
                type="text"
                value={value}
                placeholder={placeholder}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSubmit();
                  }
                }}
              />
            )}
          </label>
        </div>

        <div className="qm-settings-footer">
          <button type="button" className="qm-secondary-button" onClick={onClose}>
            {ui.common.cancel}
          </button>
          <button type="button" className="qm-primary-button" onClick={handleSubmit} disabled={!value.trim()}>
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
