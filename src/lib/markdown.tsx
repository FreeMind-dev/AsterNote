/* eslint-disable react-refresh/only-export-components */
import { Editor as CoreEditor, Extension, Node, generateJSON, mergeAttributes } from '@tiptap/core';
import CharacterCount from '@tiptap/extension-character-count';
import CodeBlock from '@tiptap/extension-code-block';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import Typography from '@tiptap/extension-typography';
import {
  type JSONContent,
  type ReactNodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import clsx from 'clsx';
import katex from 'katex';
import { marked } from 'marked';
import { CodeBlockNodeView } from '../components/CodeBlockNodeView';

marked.setOptions({
  gfm: true,
  breaks: true,
});

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function decodeAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeLocalPath(value: string) {
  return value.replace(/\\/g, '/');
}

function isRemoteAssetPath(value: string) {
  return /^(https?:|data:|blob:|file:|mailto:|tel:)/i.test(value);
}

function isWindowsAbsolutePath(value: string) {
  return /^[a-zA-Z]:[\\/]/.test(value);
}

function isAbsoluteLocalPath(value: string) {
  return value.startsWith('/') || isWindowsAbsolutePath(value);
}

export function encodeMarkdownAssetPath(value: string) {
  return encodeURI(value).replace(/#/g, '%23');
}

function toFileUrl(filePath: string) {
  const normalized = normalizeLocalPath(filePath);
  return isWindowsAbsolutePath(normalized)
    ? `file:///${encodeURI(normalized).replace(/#/g, '%23')}`
    : `file://${encodeURI(normalized).replace(/#/g, '%23')}`;
}

export function resolveMarkdownAssetPreviewSrc(assetPath: string, documentPath?: string | null) {
  if (!assetPath) return assetPath;
  if (isRemoteAssetPath(assetPath)) return assetPath;
  if (isAbsoluteLocalPath(assetPath)) return toFileUrl(assetPath);
  if (!documentPath) return assetPath;

  try {
    return new URL(normalizeLocalPath(assetPath), toFileUrl(documentPath)).href;
  } catch {
    return assetPath;
  }
}

function renderKatex(latex: string, displayMode: boolean): string {
  return katex.renderToString(latex || 'x', {
    displayMode,
    throwOnError: false,
  });
}

function normalizeCodeBlockTheme(value: string): 'paper' | 'slate' | 'midnight' {
  if (value === 'slate' || value === 'midnight') {
    return value;
  }
  return 'paper';
}

function getLatexAttr(props: ReactNodeViewProps): string {
  return typeof props.node.attrs.latex === 'string' ? props.node.attrs.latex : '';
}

function InlineMathNodeView(props: ReactNodeViewProps) {
  return (
    <NodeViewWrapper
      as="span"
      className={clsx('qm-inline-math-node', props.selected && 'is-selected')}
      contentEditable={false}
      dangerouslySetInnerHTML={{
        __html: renderKatex(getLatexAttr(props), false),
      }}
    />
  );
}

function BlockMathNodeView(props: ReactNodeViewProps) {
  return (
    <NodeViewWrapper
      className={clsx('qm-block-math-node', props.selected && 'is-selected')}
      contentEditable={false}
      dangerouslySetInnerHTML={{
        __html: renderKatex(getLatexAttr(props), true),
      }}
    />
  );
}

export const InlineMathNode = Node.create({
  name: 'inlineMath',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (element) =>
          element.getAttribute('data-latex') || element.textContent || '',
        renderHTML: (attributes) => ({ 'data-latex': attributes.latex }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'qm-inline-math' }, { tag: 'span[data-inline-math="true"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'qm-inline-math',
      mergeAttributes(HTMLAttributes, { 'data-inline-math': 'true' }),
      HTMLAttributes.latex || '',
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(InlineMathNodeView);
  },
});

export const BlockMathNode = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  selectable: true,
  defining: true,
  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (element) =>
          element.getAttribute('data-latex') || element.textContent || '',
        renderHTML: (attributes) => ({ 'data-latex': attributes.latex }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'qm-math-block' }, { tag: 'div[data-math-block="true"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'qm-math-block',
      mergeAttributes(HTMLAttributes, { 'data-math-block': 'true' }),
      HTMLAttributes.latex || '',
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(BlockMathNodeView);
  },
});

function isTableSelection(editor: CoreEditor) {
  return editor.isActive('tableCell') || editor.isActive('tableHeader');
}

function handleTableEnter(editor: CoreEditor) {
  const { $from } = editor.state.selection;

  let cellDepth = $from.depth;
  while (
    cellDepth > 0
    && $from.node(cellDepth).type.name !== 'tableCell'
    && $from.node(cellDepth).type.name !== 'tableHeader'
  ) {
    cellDepth -= 1;
  }

  if (cellDepth <= 0) {
    return false;
  }

  const rowDepth = cellDepth - 1;
  const tableDepth = rowDepth - 1;
  const rowNode = $from.node(rowDepth);
  const tableNode = $from.node(tableDepth);
  const cellPos = $from.before(cellDepth);
  const rowPos = $from.before(rowDepth);

  let columnIndex = 0;
  const rowStart = $from.start(rowDepth);
  rowNode.forEach((_child, offset) => {
    if (rowStart + offset < cellPos) {
      columnIndex += 1;
    }
  });

  let rowIndex = 0;
  const tableStart = $from.start(tableDepth);
  tableNode.forEach((_child, offset) => {
    if (tableStart + offset < rowPos) {
      rowIndex += 1;
    }
  });

  const isLastRow = rowIndex >= tableNode.childCount - 1;
  if (isLastRow) {
    editor.chain().focus().addRowAfter().run();
    window.setTimeout(() => {
      for (let index = 0; index <= columnIndex; index += 1) {
        if (index === 0) {
          editor.chain().focus().goToNextCell().run();
        } else {
          editor.chain().goToNextCell().run();
        }
      }
    }, 0);
    return true;
  }

  const remainingCellsInRow = rowNode.childCount - columnIndex - 1;
  const cellsToSkip = remainingCellsInRow + columnIndex + 1;
  for (let index = 0; index < cellsToSkip; index += 1) {
    editor.chain().focus().goToNextCell().run();
  }

  return true;
}

const TableKeyboardShortcuts = Extension.create({
  name: 'tableKeyboardShortcuts',
  addKeyboardShortcuts() {
    return {
      'Shift-Enter': () => {
        if (!isTableSelection(this.editor)) {
          return false;
        }
        return this.editor.chain().focus().setHardBreak().run();
      },
      Enter: () => {
        if (!isTableSelection(this.editor)) {
          return false;
        }
        return handleTableEnter(this.editor);
      },
    };
  },
});

const MarkdownImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      markdownSrc: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-markdown-src') || null,
        renderHTML: (attributes) => (
          attributes.markdownSrc
            ? { 'data-markdown-src': attributes.markdownSrc }
            : {}
        ),
      },
    };
  },
});

const CustomCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      language: {
        default: this.options.defaultLanguage,
        parseHTML: (element) => {
          const explicitLanguage = element.getAttribute('data-code-language');
          if (explicitLanguage) {
            return explicitLanguage;
          }

          const classNames = [...(element.firstElementChild?.classList || [])];
          const languages = classNames
            .filter((className) => className.startsWith(this.options.languageClassPrefix))
            .map((className) => className.replace(this.options.languageClassPrefix, ''));
          return languages[0] || null;
        },
        rendered: false,
      },
      showLineNumbers: {
        default: true,
        parseHTML: (element) => element.getAttribute('data-show-line-numbers') !== 'false',
        renderHTML: (attributes) => ({
          'data-show-line-numbers': attributes.showLineNumbers === false ? 'false' : 'true',
        }),
      },
      theme: {
        default: 'paper',
        parseHTML: (element) => normalizeCodeBlockTheme(element.getAttribute('data-code-theme') || ''),
        renderHTML: (attributes) => ({
          'data-code-theme': normalizeCodeBlockTheme(String(attributes.theme || 'paper')),
        }),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView);
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'pre',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-code-language': node.attrs.language || '',
        'data-show-line-numbers': node.attrs.showLineNumbers === false ? 'false' : 'true',
        'data-code-theme': normalizeCodeBlockTheme(String(node.attrs.theme || 'paper')),
      }),
      [
        'code',
        {
          class: node.attrs.language
            ? this.options.languageClassPrefix + node.attrs.language
            : null,
        },
        0,
      ],
    ];
  },
});

export function createEditorExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      codeBlock: false,
    }),
    Placeholder.configure({ placeholder }),
    Typography,
    CharacterCount.configure({ limit: null }),
    Link.configure({ openOnClick: false }),
    MarkdownImage,
    CustomCodeBlock,
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    TableKeyboardShortcuts,
    InlineMathNode,
    BlockMathNode,
  ];
}

function preprocessMath(markdown: string): string {
  const blockHandled = markdown.replace(/\$\$([\s\S]+?)\$\$/g, (_, formula) => {
    const latex = escapeAttribute(String(formula).trim());
    return `\n<qm-math-block data-latex="${latex}"></qm-math-block>\n`;
  });

  return blockHandled.replace(/(?<!\$)\$([^$\n]+)\$(?!\$)/g, (_, formula) => {
    const latex = escapeAttribute(String(formula).trim());
    return `<qm-inline-math data-latex="${latex}"></qm-inline-math>`;
  });
}

function renderPreprocessedCodeBlock(infoString: string, code: string) {
  const tokens = infoString.trim().split(/\s+/).filter(Boolean);
  let language = '';
  let showLineNumbers = true;
  let theme: 'paper' | 'slate' | 'midnight' = 'paper';

  tokens.forEach((token) => {
    if (token === 'linenos') {
      showLineNumbers = true;
      return;
    }
    if (token === 'nolines') {
      showLineNumbers = false;
      return;
    }
    if (token.startsWith('theme:')) {
      theme = normalizeCodeBlockTheme(token.slice('theme:'.length));
      return;
    }
    if (!language) {
      language = token;
    }
  });

  const escapedLanguage = escapeAttribute(language);
  const codeClass = language ? ` class="language-${escapedLanguage}"` : '';
  const escapedCode = escapeHtml(code.replace(/\n$/, ''));

  return `\n<pre data-code-language="${escapedLanguage}" data-show-line-numbers="${showLineNumbers ? 'true' : 'false'}" data-code-theme="${theme}"><code${codeClass}>${escapedCode}</code></pre>\n`;
}

function preprocessMarkdown(markdown: string): string {
  const preservedCodeBlocks: string[] = [];
  const placeholderMarkdown = markdown.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_match, infoString, code) => {
    const placeholder = `@@QM_CODE_BLOCK_${preservedCodeBlocks.length}@@`;
    preservedCodeBlocks.push(renderPreprocessedCodeBlock(String(infoString || ''), String(code || '')));
    return placeholder;
  });

  const withMath = preprocessMath(placeholderMarkdown);
  return withMath.replace(/@@QM_CODE_BLOCK_(\d+)@@/g, (_match, index) => preservedCodeBlocks[Number(index)] || '');
}

function rewriteImageNodes(node: JSONContent, documentPath?: string | null): JSONContent {
  const nextNode: JSONContent = {
    ...node,
    attrs: node.attrs ? { ...node.attrs } : node.attrs,
  };

  if (nextNode.type === 'image') {
    const originalSrc = String(nextNode.attrs?.markdownSrc || nextNode.attrs?.src || '');
    return {
      ...nextNode,
      attrs: {
        ...nextNode.attrs,
        markdownSrc: originalSrc,
        src: resolveMarkdownAssetPreviewSrc(originalSrc, documentPath),
      },
    };
  }

  if (node.content) {
    nextNode.content = node.content.map((child) => rewriteImageNodes(child, documentPath));
  }

  return nextNode;
}

function getSerializationExtensions() {
  return createEditorExtensions('');
}

export function markdownToEditorContent(markdown: string, options?: { documentPath?: string | null }): JSONContent {
  if (!markdown.trim()) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  try {
    const html = marked.parse(preprocessMarkdown(markdown)) as string;
    return rewriteImageNodes(generateJSON(html, getSerializationExtensions()), options?.documentPath);
  } catch (error) {
    console.error('[QuietMark] markdownToEditorContent failed:', error);
    return {
      type: 'doc',
      content: markdown.split(/\n{2,}/).map((chunk) => ({
        type: 'paragraph',
        content: [{ type: 'text', text: chunk }],
      })),
    };
  }
}

function escapeText(text: string) {
  return text.replace(/\\/g, '\\\\');
}

function wrapMarks(text: string, marks?: Array<{ type: string; attrs?: Record<string, string> }>) {
  if (!marks || marks.length === 0) {
    return escapeText(text);
  }

  let result = escapeText(text);
  const nonLinkMarks = marks.filter((mark) => mark.type !== 'link');
  const linkMark = marks.find((mark) => mark.type === 'link');

  nonLinkMarks.forEach((mark) => {
    switch (mark.type) {
      case 'code':
        result = `\`${result}\``;
        break;
      case 'bold':
        result = `**${result}**`;
        break;
      case 'italic':
        result = `*${result}*`;
        break;
      case 'strike':
        result = `~~${result}~~`;
        break;
      default:
        break;
    }
  });

  if (linkMark?.attrs?.href) {
    result = `[${result}](${linkMark.attrs.href})`;
  }

  return result;
}

function serializeInline(nodes?: JSONContent[]): string {
  if (!nodes || nodes.length === 0) return '';

  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return wrapMarks(node.text || '', node.marks as Array<{ type: string; attrs?: Record<string, string> }> | undefined);
        case 'hardBreak':
          return '  \n';
        case 'image':
          return `![${node.attrs?.alt || ''}](${node.attrs?.markdownSrc || node.attrs?.src || ''})`;
        case 'inlineMath':
          return `$${node.attrs?.latex || ''}$`;
        default:
          return node.content ? serializeInline(node.content) : '';
      }
    })
    .join('');
}

function extractPlainText(node?: JSONContent): string {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (node.type === 'inlineMath') return node.attrs?.latex || '';
  if (!node.content) return '';
  return node.content.map((child) => extractPlainText(child)).join('');
}

function prefixBlock(text: string, prefix: string): string {
  return text
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
}

function serializeList(listNode: JSONContent, ordered: boolean): string {
  const items = listNode.content || [];
  return items
    .map((item, index) => serializeListItem(item, ordered ? `${index + 1}.` : '-'))
    .join('\n');
}

function serializeListItem(node: JSONContent, marker: string): string {
  const children = node.content || [];
  const rendered = children
    .map((child) => {
      if (child.type === 'paragraph') {
        return serializeInline(child.content);
      }

      if (child.type === 'bulletList') {
        return `\n${prefixBlock(serializeList(child, false), '  ')}`;
      }

      if (child.type === 'orderedList') {
        return `\n${prefixBlock(serializeList(child, true), '  ')}`;
      }

      return serializeBlock(child);
    })
    .join('\n');

  return `${marker} ${rendered}`.trimEnd();
}

function serializeTable(node: JSONContent): string {
  const rows = node.content || [];
  if (rows.length === 0) return '';

  const rawRows = rows.map((row) => (row.content || []).map((cell) => serializeTableCell(cell)));
  const width = Math.max(...rawRows.map((row) => row.length), 1);
  const cells = rawRows.map((row) => Array.from({ length: width }, (_, index) => row[index] || ''));

  const header = cells[0];
  const divider = header.map(() => '---');
  const body = cells.slice(1);

  return [
    `| ${header.join(' | ')} |`,
    `| ${divider.join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function escapeTableCell(text: string) {
  return text.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function serializeTableCell(cell: JSONContent): string {
  const blocks = (cell.content || [])
    .map((block) => {
      if (block.type === 'paragraph') {
        return serializeInline(block.content).trim();
      }
      return serializeBlock(block).trim();
    })
    .filter(Boolean);

  return escapeTableCell(blocks.join('<br>'));
}

export function serializeBlock(node: JSONContent): string {
  switch (node.type) {
    case 'paragraph':
      return serializeInline(node.content);
    case 'heading':
      return `${'#'.repeat(Number(node.attrs?.level || 1))} ${serializeInline(node.content)}`;
    case 'bulletList':
      return serializeList(node, false);
    case 'orderedList':
      return serializeList(node, true);
    case 'blockquote':
      return prefixBlock(
        (node.content || []).map((child) => serializeBlock(child)).join('\n\n'),
        '> '
      );
    case 'codeBlock':
      return [
        '```',
        [
          String(node.attrs?.language || '').trim(),
          node.attrs?.showLineNumbers === false ? 'nolines' : '',
          normalizeCodeBlockTheme(String(node.attrs?.theme || 'paper')) !== 'paper'
            ? `theme:${normalizeCodeBlockTheme(String(node.attrs?.theme || 'paper'))}`
            : '',
        ].filter(Boolean).join(' '),
        `\n${extractPlainText(node)}\n\`\`\``,
      ].join('');
    case 'horizontalRule':
      return '---';
    case 'table':
      return serializeTable(node);
    case 'mathBlock':
      return `$$\n${node.attrs?.latex || ''}\n$$`;
    case 'image':
      return `![${node.attrs?.alt || ''}](${node.attrs?.markdownSrc || node.attrs?.src || ''})`;
    default:
      if (node.content) {
        return node.content.map((child) => serializeBlock(child)).join('\n');
      }
      return '';
  }
}

export function editorJsonToMarkdown(json: JSONContent): string {
  if (!json.content || json.content.length === 0) return '';

  return json.content
    .map((node) => serializeBlock(node))
    .filter((block) => block.trim().length > 0)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderMathInExportHtml(html: string): string {
  const blockReplaced = html.replace(
    /<qm-math-block[^>]*data-latex="([^"]+)"[^>]*><\/qm-math-block>/g,
    (_match, latex) =>
      `<div class="qm-math-block">${katex.renderToString(decodeAttribute(latex), {
        displayMode: true,
        throwOnError: false,
      })}</div>`
  );

  return blockReplaced.replace(
    /<qm-inline-math[^>]*data-latex="([^"]+)"[^>]*><\/qm-inline-math>/g,
    (_match, latex) =>
      `<span class="qm-math">${katex.renderToString(decodeAttribute(latex), {
        displayMode: false,
        throwOnError: false,
      })}</span>`
  );
}

export function markdownToExportHtml(markdown: string): string {
  return renderMathInExportHtml(marked.parse(preprocessMarkdown(markdown)) as string);
}
