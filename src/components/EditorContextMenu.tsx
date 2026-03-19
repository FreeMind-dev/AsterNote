import type { Editor } from '@tiptap/react';
import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getDocumentUiLanguage, getUiText } from '../lib/uiText';

interface EditorContextMenuProps {
  editor: Editor;
  position: { x: number; y: number; inTable: boolean } | null;
  onClose: () => void;
}

function clampMenuPosition(position: { x: number; y: number }) {
  const menuWidth = 208;
  const menuHeight = 280;
  const padding = 10;

  if (typeof window === 'undefined') {
    return position;
  }

  return {
    x: Math.min(position.x, window.innerWidth - menuWidth - padding),
    y: Math.min(position.y, window.innerHeight - menuHeight - padding),
  };
}

function MenuItem({
  onClick,
  tone = 'default',
  children,
}: {
  onClick: () => void;
  tone?: 'default' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`qm-context-menu-item ${tone === 'danger' ? 'is-danger' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="qm-context-menu-divider" />;
}

export function EditorContextMenu({ editor, position, onClose }: EditorContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const ui = getUiText(getDocumentUiLanguage());

  useEffect(() => {
    if (!position) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      onClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, position]);

  const menuPosition = useMemo(() => {
    if (!position) return null;
    return clampMenuPosition(position);
  }, [position]);

  if (!position || !menuPosition) {
    return null;
  }

  const runAndClose = (action: () => void) => {
    action();
    onClose();
  };

  return createPortal(
    <div
      ref={menuRef}
      className="qm-context-menu"
      style={{ left: menuPosition.x, top: menuPosition.y }}
    >
      <MenuItem onClick={() => runAndClose(() => editor.chain().focus().toggleBold().run())}>{ui.contextMenu.bold}</MenuItem>
      <MenuItem onClick={() => runAndClose(() => editor.chain().focus().toggleItalic().run())}>{ui.contextMenu.italic}</MenuItem>
      <MenuItem onClick={() => runAndClose(() => editor.chain().focus().toggleCode().run())}>{ui.contextMenu.inlineCode}</MenuItem>
      <MenuItem onClick={() => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt(ui.contextMenu.enterUrl, previousUrl);
        if (url === null) return;
        if (url === '') {
          runAndClose(() => editor.chain().focus().extendMarkRange('link').unsetLink().run());
          return;
        }
        runAndClose(() => editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run());
      }}>{ui.contextMenu.link}</MenuItem>

      <Divider />

      <MenuItem onClick={() => runAndClose(() => editor.chain().focus().toggleBulletList().run())}>{ui.contextMenu.bulletList}</MenuItem>
      <MenuItem onClick={() => runAndClose(() => editor.chain().focus().toggleOrderedList().run())}>{ui.contextMenu.numberedList}</MenuItem>
      <MenuItem onClick={() => runAndClose(() => editor.chain().focus().toggleBlockquote().run())}>{ui.contextMenu.quote}</MenuItem>
      <MenuItem onClick={() => runAndClose(() => editor.chain().focus().toggleCodeBlock().run())}>{ui.contextMenu.codeBlock}</MenuItem>
      <MenuItem onClick={() => runAndClose(() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}>{ui.contextMenu.insertTable}</MenuItem>
    </div>,
    document.body
  );
}
