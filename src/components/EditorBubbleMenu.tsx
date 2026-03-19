import { BubbleMenu, type Editor } from '@tiptap/react';
import type { SelectionBookmark } from '@tiptap/pm/state';
import { useEffect, useRef } from 'react';

import { Code, Link, Quote } from './icons';

interface EditorBubbleMenuProps {
  editor: Editor;
}

function BubbleActionButton({
  label,
  active = false,
  onPress,
  children,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onPress();
    };

    button.addEventListener('mousedown', handlePointerDown);
    return () => {
      button.removeEventListener('mousedown', handlePointerDown);
    };
  }, [onPress]);

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      title={label}
      tabIndex={-1}
      className={`qm-bubble-button ${active ? 'is-active' : ''}`}
    >
      {children}
    </button>
  );
}

export function EditorBubbleMenu({ editor }: EditorBubbleMenuProps) {
  const selectionBookmarkRef = useRef<SelectionBookmark | null>(null);

  useEffect(() => {
    const syncSelection = () => {
      selectionBookmarkRef.current = editor.state.selection.getBookmark();
    };

    syncSelection();
    editor.on('selectionUpdate', syncSelection);
    return () => {
      editor.off('selectionUpdate', syncSelection);
    };
  }, [editor]);

  const restoreSelection = () => {
    const bookmark = selectionBookmarkRef.current;
    if (!bookmark) return;

    try {
      const resolved = bookmark.resolve(editor.state.doc);
      editor.view.dispatch(editor.state.tr.setSelection(resolved));
    } catch {
      // Ignore stale selection snapshots.
    }
  };

  const runOnSelection = (command: () => void) => {
    restoreSelection();
    command();
  };

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 100,
        placement: 'top',
        appendTo: () => document.body,
        zIndex: 205,
      }}
      shouldShow={({ editor: current, from, to }) => {
        if (from === to) return false;
        if (current.isActive('tableCell') || current.isActive('tableHeader')) return false;
        if (current.isActive('codeBlock')) return false;
        return true;
      }}
      className="qm-bubble-menu"
    >
      <BubbleActionButton
        label="Bold"
        active={editor.isActive('bold')}
        onPress={() => runOnSelection(() => editor.chain().focus().toggleBold().run())}
      >
        <span className="qm-toolbar-text--strong">B</span>
      </BubbleActionButton>
      <BubbleActionButton
        label="Italic"
        active={editor.isActive('italic')}
        onPress={() => runOnSelection(() => editor.chain().focus().toggleItalic().run())}
      >
        <span className="qm-toolbar-text--italic">I</span>
      </BubbleActionButton>
      <BubbleActionButton
        label="Inline code"
        active={editor.isActive('code')}
        onPress={() => runOnSelection(() => editor.chain().focus().toggleCode().run())}
      >
        <Code size={15} />
      </BubbleActionButton>
      <BubbleActionButton
        label="Quote"
        active={editor.isActive('blockquote')}
        onPress={() => runOnSelection(() => editor.chain().focus().toggleBlockquote().run())}
      >
        <Quote size={15} />
      </BubbleActionButton>
      <BubbleActionButton
        label="Link"
        active={editor.isActive('link')}
        onPress={() => {
          const previousUrl = editor.getAttributes('link').href;
          const url = window.prompt('Enter URL', previousUrl);
          if (url === null) return;
          restoreSelection();
          if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
          }
          editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        }}
      >
        <Link size={15} />
      </BubbleActionButton>
    </BubbleMenu>
  );
}
