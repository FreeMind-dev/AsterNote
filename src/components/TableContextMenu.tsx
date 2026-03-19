import type { Editor } from '@tiptap/react';
import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

import { getDocumentUiLanguage, getUiText } from '../lib/uiText';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Trash2 } from './icons';

interface TableContextMenuProps {
  editor: Editor;
  position: { x: number; y: number; inTable: boolean } | null;
  onClose: () => void;
}

function clampMenuPosition(position: { x: number; y: number }) {
  const menuWidth = 232;
  const menuHeight = 360;
  const padding = 10;

  if (typeof window === 'undefined') {
    return position;
  }

  return {
    x: Math.min(position.x, window.innerWidth - menuWidth - padding),
    y: Math.min(position.y, window.innerHeight - menuHeight - padding),
  };
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="qm-context-menu-section">{children}</div>;
}

function MenuDivider() {
  return <div className="qm-context-menu-divider" />;
}

function MenuItem({
  onClick,
  icon,
  shortcut,
  tone = 'default',
  children,
}: {
  onClick: () => void;
  icon?: React.ReactNode;
  shortcut?: string;
  tone?: 'default' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`qm-context-menu-item qm-context-menu-item--with-meta ${tone === 'danger' ? 'is-danger' : ''}`}
      onClick={onClick}
    >
      <span className="qm-context-menu-icon">{icon}</span>
      <span className="qm-context-menu-label">{children}</span>
      {shortcut ? <span className="qm-context-menu-shortcut">{shortcut}</span> : null}
    </button>
  );
}

export function TableContextMenu({ editor, position, onClose }: TableContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const ui = getUiText(getDocumentUiLanguage());

  useEffect(() => {
    if (!position) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
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
      className="qm-context-menu qm-context-menu--table"
      style={{ left: menuPosition.x, top: menuPosition.y }}
    >
      <SectionHeader>{ui.math.contextRowsColumns}</SectionHeader>
      <MenuItem icon={<ArrowUp size={13} />} onClick={() => runAndClose(() => editor.chain().focus().addRowBefore().run())}>
        {ui.math.contextInsertRowAbove}
      </MenuItem>
      <MenuItem icon={<ArrowDown size={13} />} onClick={() => runAndClose(() => editor.chain().focus().addRowAfter().run())}>
        {ui.math.contextInsertRowBelow}
      </MenuItem>
      <MenuItem icon={<ArrowLeft size={13} />} onClick={() => runAndClose(() => editor.chain().focus().addColumnBefore().run())}>
        {ui.math.contextInsertColumnLeft}
      </MenuItem>
      <MenuItem icon={<ArrowRight size={13} />} onClick={() => runAndClose(() => editor.chain().focus().addColumnAfter().run())}>
        {ui.math.contextInsertColumnRight}
      </MenuItem>

      <MenuDivider />

      <SectionHeader>{ui.math.contextCells}</SectionHeader>
      <MenuItem onClick={() => runAndClose(() => editor.chain().focus().mergeCells().run())}>
        {ui.math.contextMergeCells}
      </MenuItem>
      <MenuItem onClick={() => runAndClose(() => editor.chain().focus().splitCell().run())}>
        {ui.math.contextSplitCell}
      </MenuItem>
      <MenuItem
        shortcut="Shift+Enter"
        onClick={() => runAndClose(() => editor.chain().focus().setHardBreak().run())}
      >
        {ui.math.contextInsertLineBreak}
      </MenuItem>

      <MenuDivider />

      <SectionHeader>{ui.math.contextHeaders}</SectionHeader>
      <MenuItem onClick={() => runAndClose(() => editor.chain().focus().toggleHeaderRow().run())}>
        {ui.math.contextToggleHeaderRow}
      </MenuItem>
      <MenuItem onClick={() => runAndClose(() => editor.chain().focus().toggleHeaderColumn().run())}>
        {ui.math.contextToggleHeaderColumn}
      </MenuItem>

      <MenuDivider />

      <SectionHeader>{ui.math.contextDelete}</SectionHeader>
      <MenuItem tone="danger" onClick={() => runAndClose(() => editor.chain().focus().deleteRow().run())}>
        {ui.math.contextDeleteRow}
      </MenuItem>
      <MenuItem tone="danger" onClick={() => runAndClose(() => editor.chain().focus().deleteColumn().run())}>
        {ui.math.contextDeleteColumn}
      </MenuItem>
      <MenuItem
        tone="danger"
        icon={<Trash2 size={13} />}
        onClick={() => runAndClose(() => editor.chain().focus().deleteTable().run())}
      >
        {ui.math.contextDeleteTable}
      </MenuItem>
    </div>,
    document.body
  );
}
