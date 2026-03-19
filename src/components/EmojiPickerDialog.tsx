import { useEffect, useState } from 'react';

import type { UILanguage } from '../electron';
import { EMOJI_CATEGORIES, EMOJI_CATEGORY_LABELS, EMOJI_LABELS } from '../lib/defaults';
import { Smile, X } from './icons';

interface EmojiPickerDialogProps {
  open: boolean;
  uiLanguage: UILanguage;
  onClose: () => void;
  onInsertEmoji: (emoji: string) => void;
}

export function EmojiPickerDialog({
  open,
  uiLanguage,
  onClose,
  onInsertEmoji,
}: EmojiPickerDialogProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const labels = EMOJI_LABELS[uiLanguage];
  const categoryLabels = EMOJI_CATEGORY_LABELS[uiLanguage];
  const dialogTitle = uiLanguage === 'zh-CN' ? '插入表情符号' : 'Insert Emoji';
  const dialogHint =
    uiLanguage === 'zh-CN'
      ? '选择一个表情或符号并插入到当前文档。'
      : 'Pick a symbol and insert it into the current document.';
  const badgeLabel = uiLanguage === 'zh-CN' ? '表情' : 'Emoji';
  const closeLabel = uiLanguage === 'zh-CN' ? '关闭表情选择器' : 'Close emoji picker';

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
      <div className="qm-input-modal qm-input-modal--emoji" onMouseDown={(event) => event.stopPropagation()}>
        <div className="qm-settings-header">
          <div>
            <div className="qm-panel-title">{dialogTitle}</div>
            <div className="qm-empty-note">{dialogHint}</div>
          </div>
          <button type="button" className="qm-icon-button" onClick={onClose} aria-label={closeLabel}>
            <X size={16} />
          </button>
        </div>

        <div className="qm-input-modal-body qm-input-modal-body--emoji">
          <div className="qm-emoji-dialog">
            <div className="qm-emoji-dialog-toolbar">
              <div className="qm-inline-badge">
                <Smile size={14} />
                {badgeLabel}
              </div>
              <div className="qm-emoji-categories">
                {EMOJI_CATEGORIES.map((category, index) => (
                  <button
                    key={category.name}
                    type="button"
                    className={`qm-sidebar-tab ${activeCategory === index ? 'is-active' : ''}`}
                    onClick={() => setActiveCategory(index)}
                  >
                    {categoryLabels[category.name as keyof typeof categoryLabels] || category.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="qm-emoji-grid">
              {EMOJI_CATEGORIES[activeCategory].items.map((emoji) => (
                <button
                  type="button"
                  key={`${EMOJI_CATEGORIES[activeCategory].name}-${emoji}`}
                  className="qm-emoji-button"
                  title={labels[emoji as keyof typeof labels] || emoji}
                  aria-label={labels[emoji as keyof typeof labels] || emoji}
                  onClick={() => {
                    onInsertEmoji(emoji);
                    onClose();
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
