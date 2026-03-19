import { type Editor, EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { UILanguage } from '../electron';
import { EditorContextMenu } from './EditorContextMenu';
import { EditorTableBubbleMenu } from './EditorTableBubbleMenu';
import { TableContextMenu } from './TableContextMenu';
import { createEditorExtensions, editorJsonToMarkdown, markdownToEditorContent } from '../lib/markdown';
import type { EditorSelection } from '../types';

interface RichMarkdownEditorProps {
  documentPath?: string | null;
  markdown: string;
  fontSize: number;
  uiLanguage: UILanguage;
  onDropFiles: (files: File[], position?: number) => void;
  onMarkdownChange: (markdown: string, cachedContent?: ReturnType<Editor['getJSON']>) => void;
  onSelectionChange: (selection: EditorSelection) => void;
  onReady: (editor: Editor | null) => void;
}

export function RichMarkdownEditor({
  documentPath,
  markdown,
  fontSize,
  uiLanguage,
  onDropFiles,
  onMarkdownChange,
  onSelectionChange,
  onReady,
}: RichMarkdownEditorProps) {
  const lastMarkdownRef = useRef(markdown);
  const syncingFromPropsRef = useRef(false);
  const onDropFilesRef = useRef(onDropFiles);
  const onMarkdownChangeRef = useRef(onMarkdownChange);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; inTable: boolean } | null>(null);

  useEffect(() => {
    onDropFilesRef.current = onDropFiles;
  }, [onDropFiles]);

  useEffect(() => {
    onMarkdownChangeRef.current = onMarkdownChange;
  }, [onMarkdownChange]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  const extensions = useMemo(
    () => createEditorExtensions(uiLanguage === 'zh-CN' ? '开始编写 Markdown…' : 'Begin writing in Markdown...'),
    [uiLanguage]
  );

  const editor = useEditor({
    extensions,
    content: markdownToEditorContent(markdown, { documentPath }),
    editorProps: {
      attributes: {
        class: 'qm-editor-surface',
        style: `font-size:${fontSize}px`,
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files || []);
        if (files.length === 0) {
          return false;
        }

        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        void onDropFilesRef.current(files, coords?.pos);
        return true;
      },
    },
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => {
      if (syncingFromPropsRef.current) return;
      const nextMarkdown = editorJsonToMarkdown(current.getJSON());
      lastMarkdownRef.current = nextMarkdown;
      onMarkdownChangeRef.current(nextMarkdown, current.getJSON());
    },
    onSelectionUpdate: ({ editor: current }) => {
      const { from, to } = current.state.selection;
      onSelectionChangeRef.current({
        mode: 'rich',
        from,
        to,
        text: current.state.doc.textBetween(from, to, ' '),
      });
    },
  });

  useEffect(() => {
    onReady(editor);
    return () => onReady(null);
  }, [editor, onReady]);

  useEffect(() => {
    if (!editor) return;
    if (markdown === lastMarkdownRef.current) return;

    syncingFromPropsRef.current = true;
    editor.commands.setContent(markdownToEditorContent(markdown, { documentPath }), false);
    lastMarkdownRef.current = markdown;
    syncingFromPropsRef.current = false;
  }, [documentPath, markdown, editor]);

  return (
    <div className="qm-editor-shell">
      <div
        className="qm-editor-host"
        onDragOver={(event) => {
          if (event.dataTransfer?.files?.length) {
            event.preventDefault();
          }
        }}
        onDrop={(event) => {
          if (!editor) return;
          if (event.defaultPrevented) return;
          const files = Array.from(event.dataTransfer?.files || []);
          if (files.length === 0) return;
          event.preventDefault();

          const coords = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
          onDropFiles(files, coords?.pos);
        }}
        onContextMenu={(event) => {
          if (!editor) return;
          event.preventDefault();

          const target = event.target as HTMLElement | null;
          const inTable = Boolean(target?.closest('table, td, th'));
          const coords = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (!inTable && coords?.pos) {
            editor.chain().focus().setTextSelection(coords.pos).run();
          } else {
            editor.commands.focus();
          }

          setContextMenu({
            x: event.clientX,
            y: event.clientY,
            inTable,
          });
        }}
      >
        <EditorContent editor={editor} />
        {editor && <EditorTableBubbleMenu editor={editor} />}
        {editor && !contextMenu?.inTable && (
          <EditorContextMenu editor={editor} position={contextMenu} onClose={() => setContextMenu(null)} />
        )}
        {editor && contextMenu?.inTable && (
          <TableContextMenu editor={editor} position={contextMenu} onClose={() => setContextMenu(null)} />
        )}
      </div>
    </div>
  );
}
