import { useEffect } from 'react';

import type { UILanguage } from '../electron';
import { getUiText } from '../lib/uiText';
import { BookOpenText, Search, TerminalSquare, Wrench, X } from './icons';

export type HelpDialogKind = 'quickStart' | 'shortcuts';

type HelpDialogProps = {
  open: boolean;
  kind: HelpDialogKind | null;
  uiLanguage: UILanguage;
  onClose: () => void;
};

type HelpCard = {
  title: string;
  body: string;
  icon: 'book' | 'tools' | 'terminal' | 'search';
};

type ShortcutGroup = {
  title: string;
  items: Array<{ keys: string[]; label: string }>;
};

const HELP_CONTENT = {
  en: {
    quickStartTitle: 'Quick Start',
    quickStartIntro:
      'AsterNote stays quiet until you need structure, tools, AI, or a shell. Start here:',
    shortcutsTitle: 'Keyboard Shortcuts',
    shortcutsIntro: 'Use the desktop menu or these common shortcuts to move faster.',
    done: 'Done',
    quickStartCards: [
      {
        title: 'Start a draft',
        body: 'Use New or Open to begin with a blank page or an existing Markdown file.',
        icon: 'book',
      },
      {
        title: 'Open tools only when needed',
        body: 'Use the right sidebar for outline, find and replace, syntax help, and document info.',
        icon: 'tools',
      },
      {
        title: 'Work with AI and web context',
        body: 'Open the AI panel when you want help revising, summarizing, translating, or searching the web.',
        icon: 'search',
      },
      {
        title: 'Drop into a shell',
        body: 'Open the terminal to run commands in the current document folder without leaving the editor.',
        icon: 'terminal',
      },
    ] satisfies HelpCard[],
    shortcutGroups: [
      {
        title: 'File',
        items: [
          { keys: ['Cmd/Ctrl', 'N'], label: 'New draft' },
          { keys: ['Cmd/Ctrl', 'O'], label: 'Open file' },
          { keys: ['Cmd/Ctrl', 'S'], label: 'Save' },
          { keys: ['Cmd/Ctrl', 'Shift', 'S'], label: 'Save as' },
        ],
      },
      {
        title: 'Edit',
        items: [
          { keys: ['Cmd/Ctrl', 'Z'], label: 'Undo' },
          { keys: ['Cmd/Ctrl', 'Shift', 'Z'], label: 'Redo' },
          { keys: ['Cmd/Ctrl', 'F'], label: 'Find' },
          { keys: ['Cmd/Ctrl', 'H'], label: 'Replace' },
        ],
      },
      {
        title: 'Panels',
        items: [
          { keys: ['Cmd/Ctrl', '\\'], label: 'Toggle tools sidebar' },
          { keys: ['Cmd/Ctrl', 'J'], label: 'Toggle terminal' },
          { keys: ['Cmd/Ctrl', 'Shift', 'A'], label: 'Toggle AI panel' },
          { keys: ['Cmd/Ctrl', 'Shift', 'M'], label: 'Toggle source mode' },
        ],
      },
    ] satisfies ShortcutGroup[],
  },
  'zh-CN': {
    quickStartTitle: '快速开始',
    quickStartIntro: 'AsterNote 默认保持安静，只有在需要结构、工具、AI 或终端时才展开。可以从这里开始：',
    shortcutsTitle: '快捷键',
    shortcutsIntro: '除了桌面菜单，也可以直接使用这些常用快捷键。',
    done: '完成',
    quickStartCards: [
      {
        title: '开始写作',
        body: '使用“新建”或“打开”，从空白草稿或现有 Markdown 文件开始。',
        icon: 'book',
      },
      {
        title: '按需打开工具',
        body: '右侧边栏提供大纲、查找替换、语法提示和文档信息。',
        icon: 'tools',
      },
      {
        title: '结合 AI 与联网上下文',
        body: '需要润色、总结、翻译或联网搜索时，再打开 AI 面板。',
        icon: 'search',
      },
      {
        title: '随时打开终端',
        body: '终端会在当前文档所在目录启动 Shell，不需要离开编辑器。',
        icon: 'terminal',
      },
    ] satisfies HelpCard[],
    shortcutGroups: [
      {
        title: '文件',
        items: [
          { keys: ['Cmd/Ctrl', 'N'], label: '新建草稿' },
          { keys: ['Cmd/Ctrl', 'O'], label: '打开文件' },
          { keys: ['Cmd/Ctrl', 'S'], label: '保存' },
          { keys: ['Cmd/Ctrl', 'Shift', 'S'], label: '另存为' },
        ],
      },
      {
        title: '编辑',
        items: [
          { keys: ['Cmd/Ctrl', 'Z'], label: '撤销' },
          { keys: ['Cmd/Ctrl', 'Shift', 'Z'], label: '重做' },
          { keys: ['Cmd/Ctrl', 'F'], label: '查找' },
          { keys: ['Cmd/Ctrl', 'H'], label: '替换' },
        ],
      },
      {
        title: '面板',
        items: [
          { keys: ['Cmd/Ctrl', '\\'], label: '切换工具侧栏' },
          { keys: ['Cmd/Ctrl', 'J'], label: '切换终端' },
          { keys: ['Cmd/Ctrl', 'Shift', 'A'], label: '切换 AI 面板' },
          { keys: ['Cmd/Ctrl', 'Shift', 'M'], label: '切换源码模式' },
        ],
      },
    ] satisfies ShortcutGroup[],
  },
} as const;

function HelpCardIcon({ icon }: { icon: HelpCard['icon'] }) {
  switch (icon) {
    case 'tools':
      return <Wrench size={16} />;
    case 'terminal':
      return <TerminalSquare size={16} />;
    case 'search':
      return <Search size={16} />;
    default:
      return <BookOpenText size={16} />;
  }
}

export function HelpDialog({ open, kind, uiLanguage, onClose }: HelpDialogProps) {
  const ui = getUiText(uiLanguage);
  const content = HELP_CONTENT[uiLanguage];

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open || !kind) return null;

  const isShortcuts = kind === 'shortcuts';

  return (
    <div
      className="qm-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="qm-help-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="qm-settings-header">
          <div>
            <div className="qm-panel-title">
              {isShortcuts ? content.shortcutsTitle : content.quickStartTitle}
            </div>
            <div className="qm-empty-note">
              {isShortcuts ? content.shortcutsIntro : content.quickStartIntro}
            </div>
          </div>
          <button type="button" className="qm-icon-button" onClick={onClose} aria-label={ui.common.close}>
            <X size={16} />
          </button>
        </div>

        <div className="qm-help-body">
          {isShortcuts ? (
            <div className="qm-shortcut-groups">
              {content.shortcutGroups.map((group) => (
                <section key={group.title} className="qm-shortcut-group">
                  <div className="qm-help-group-title">{group.title}</div>
                  <div className="qm-shortcut-list">
                    {group.items.map((item) => (
                      <div key={`${group.title}-${item.label}`} className="qm-shortcut-row">
                        <div className="qm-shortcut-combo">
                          {item.keys.map((key) => (
                            <span key={key} className="qm-keycap">
                              {key}
                            </span>
                          ))}
                        </div>
                        <span className="qm-shortcut-label">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="qm-help-cards">
              {content.quickStartCards.map((card) => (
                <section key={card.title} className="qm-help-card">
                  <div className="qm-help-card-icon">
                    <HelpCardIcon icon={card.icon} />
                  </div>
                  <div>
                    <div className="qm-help-group-title">{card.title}</div>
                    <div className="qm-empty-note">{card.body}</div>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="qm-settings-footer">
          <div />
          <button type="button" className="qm-primary-button" onClick={onClose}>
            {content.done}
          </button>
        </div>
      </div>
    </div>
  );
}
