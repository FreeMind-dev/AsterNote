import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import type { CSSProperties } from 'react';
import { getDocumentUiLanguage, getUiText } from '../lib/uiText';

const CODE_LANGUAGES = [
  { value: '', label: '' },
  { value: 'bash', label: 'Bash' },
  { value: 'css', label: 'CSS' },
  { value: 'html', label: 'HTML' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'python', label: 'Python' },
  { value: 'sql', label: 'SQL' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'yaml', label: 'YAML' },
];

const CODE_BLOCK_THEMES = {
  paper: {
    label: 'Paper',
    background: '#f7f1e6',
    border: 'rgba(97, 76, 47, 0.18)',
    header: '#efe4d2',
    text: '#453827',
    muted: '#8a7456',
  },
  slate: {
    label: 'Slate',
    background: '#edf2f7',
    border: 'rgba(48, 71, 94, 0.18)',
    header: '#dfe7f2',
    text: '#233446',
    muted: '#667688',
  },
  midnight: {
    label: 'Midnight',
    background: '#111827',
    border: 'rgba(148, 163, 184, 0.22)',
    header: '#1e293b',
    text: '#e5eef8',
    muted: '#94a3b8',
  },
} as const;

type CodeBlockTheme = keyof typeof CODE_BLOCK_THEMES;

function isCodeBlockTheme(value: string): value is CodeBlockTheme {
  return value in CODE_BLOCK_THEMES;
}

function resolveTheme(theme: string): CodeBlockTheme {
  return isCodeBlockTheme(theme) ? theme : 'paper';
}

function lineRange(length: number) {
  return Array.from({ length: Math.max(length, 1) }, (_, index) => index + 1);
}

export function CodeBlockNodeView({ node, updateAttributes }: NodeViewProps) {
  const ui = getUiText(getDocumentUiLanguage());
  const theme = resolveTheme(String(node.attrs.theme || 'paper'));
  const tokens = CODE_BLOCK_THEMES[theme];
  const language = String(node.attrs.language || '');
  const showLineNumbers = node.attrs.showLineNumbers !== false;
  const lineCount = lineRange(String(node.textContent || '').split('\n').length);

  const style = {
    '--qm-code-bg': tokens.background,
    '--qm-code-border': tokens.border,
    '--qm-code-header': tokens.header,
    '--qm-code-text': tokens.text,
    '--qm-code-muted': tokens.muted,
  } as CSSProperties;

  return (
    <NodeViewWrapper className="qm-code-block" data-theme={theme} style={style}>
      <div className="qm-code-block-toolbar" contentEditable={false}>
        <select
          className="qm-code-block-select"
          value={language}
          onChange={(event) => updateAttributes({ language: event.target.value || null })}
        >
          {CODE_LANGUAGES.map((option) => (
            <option key={option.value || 'plain'} value={option.value}>
              {option.value ? option.label : ui.codeBlock.plainText}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={`qm-code-block-toggle ${showLineNumbers ? 'is-active' : ''}`}
          aria-pressed={showLineNumbers}
          onMouseDown={(event) => {
            event.preventDefault();
            updateAttributes({ showLineNumbers: !showLineNumbers });
          }}
        >
          {ui.codeBlock.line}
        </button>
      </div>

      <div className="qm-code-block-frame">
        {showLineNumbers ? (
          <div className="qm-code-block-gutter" contentEditable={false} aria-hidden="true">
            {lineCount.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        ) : null}

        <pre className="qm-code-block-pre">
          <NodeViewContent as="code" className="qm-code-block-content" />
        </pre>
      </div>
    </NodeViewWrapper>
  );
}
