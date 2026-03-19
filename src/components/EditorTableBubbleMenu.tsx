import { BubbleMenu, type Editor } from '@tiptap/react';
import type { SelectionBookmark } from '@tiptap/pm/state';
import { useEffect, useRef, useState } from 'react';

import { getDocumentUiLanguage, getUiText } from '../lib/uiText';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Columns2,
  Columns3,
  Merge,
  Rows2,
  Rows3,
  Settings2,
  SplitSquareHorizontal,
  Trash2,
  WrapText,
} from './icons';

interface EditorTableBubbleMenuProps {
  editor: Editor;
}

function TableActionButton({
  title,
  tone = 'default',
  onPress,
  children,
}: {
  title: string;
  tone?: 'default' | 'danger';
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
      className={`qm-table-action-button ${tone === 'danger' ? 'is-danger' : ''}`}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

function MenuDivider() {
  return <div className="qm-table-menu-divider" />;
}

function isTableSelection(editor: Editor, depth = editor.state.selection.$from.depth) {
  if (editor.isActive('tableCell') || editor.isActive('tableHeader')) {
    return true;
  }

  const { $from } = editor.state.selection;
  for (let currentDepth = depth; currentDepth > 0; currentDepth -= 1) {
    const nodeName = $from.node(currentDepth).type.name;
    if (nodeName === 'table' || nodeName === 'tableCell' || nodeName === 'tableHeader') {
      return true;
    }
  }

  return false;
}

export function EditorTableBubbleMenu({ editor }: EditorTableBubbleMenuProps) {
  const lastTableSelectionRef = useRef<SelectionBookmark | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const ui = getUiText(getDocumentUiLanguage());

  useEffect(() => {
    const handleSelectionUpdate = () => {
      if (isTableSelection(editor)) {
        lastTableSelectionRef.current = editor.state.selection.getBookmark();
        return;
      }
      setIsOpen(false);
    };

    handleSelectionUpdate();
    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor]);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen((current) => !current);
    };

    trigger.addEventListener('mousedown', handlePointerDown);
    return () => {
      trigger.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const runTableCommand = (command: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => {
    if (lastTableSelectionRef.current) {
      try {
        const restoredSelection = lastTableSelectionRef.current.resolve(editor.state.doc);
        editor.view.dispatch(editor.state.tr.setSelection(restoredSelection));
      } catch {
        // Ignore stale selection bookmarks and fall through to current selection.
      }
    }

    if (command(editor.chain().focus()).run()) {
      setIsOpen(false);
      return;
    }

    command(editor.chain().focus()).run();
    setIsOpen(false);
  };

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 100,
        placement: 'top',
        interactive: true,
        appendTo: () => document.body,
        zIndex: 210,
      }}
      shouldShow={({ editor: current, state }) => isTableSelection(current, state.selection.$from.depth)}
      className="qm-bubble-menu qm-bubble-menu--table-trigger"
    >
      <div ref={menuRef} className={`qm-table-bubble-menu ${isOpen ? 'is-open' : ''}`}>
        <button
          ref={triggerRef}
          type="button"
          className="qm-table-menu-trigger"
          title={ui.math.tableOptions}
          aria-label={ui.math.tableOptions}
          aria-expanded={isOpen}
        >
          <Settings2 size={18} />
        </button>

        <div className="qm-table-menu-panel">
          <div className="qm-table-menu-grid">
            <TableActionButton
              title={ui.math.tableInsertRowAbove}
              onPress={() => runTableCommand((chain) => chain.addRowBefore())}
            >
              <ArrowUp size={18} />
            </TableActionButton>
            <TableActionButton
              title={ui.math.tableInsertRowBelow}
              onPress={() => runTableCommand((chain) => chain.addRowAfter())}
            >
              <ArrowDown size={18} />
            </TableActionButton>
            <TableActionButton
              title={ui.math.tableInsertColumnLeft}
              onPress={() => runTableCommand((chain) => chain.addColumnBefore())}
            >
              <ArrowLeft size={18} />
            </TableActionButton>
            <TableActionButton
              title={ui.math.tableInsertColumnRight}
              onPress={() => runTableCommand((chain) => chain.addColumnAfter())}
            >
              <ArrowRight size={18} />
            </TableActionButton>
          </div>

          <MenuDivider />

          <div className="qm-table-menu-grid">
            <TableActionButton
              title={ui.math.tableMergeCells}
              onPress={() => runTableCommand((chain) => chain.mergeCells())}
            >
              <Merge size={18} />
            </TableActionButton>
            <TableActionButton
              title={ui.math.tableSplitCell}
              onPress={() => runTableCommand((chain) => chain.splitCell())}
            >
              <SplitSquareHorizontal size={18} />
            </TableActionButton>
            <TableActionButton
              title={ui.math.tableInsertLineBreak}
              onPress={() => runTableCommand((chain) => chain.setHardBreak())}
            >
              <WrapText size={18} />
            </TableActionButton>
          </div>

          <MenuDivider />

          <div className="qm-table-menu-grid">
            <TableActionButton
              title={ui.math.tableToggleHeaderRow}
              onPress={() => runTableCommand((chain) => chain.toggleHeaderRow())}
            >
              <Rows2 size={18} />
            </TableActionButton>
            <TableActionButton
              title={ui.math.tableToggleHeaderColumn}
              onPress={() => runTableCommand((chain) => chain.toggleHeaderColumn())}
            >
              <Columns2 size={18} />
            </TableActionButton>
          </div>

          <MenuDivider />

          <div className="qm-table-menu-grid">
            <TableActionButton
              tone="danger"
              title={ui.math.tableDeleteRow}
              onPress={() => runTableCommand((chain) => chain.deleteRow())}
            >
              <Rows3 size={18} />
            </TableActionButton>
            <TableActionButton
              tone="danger"
              title={ui.math.tableDeleteColumn}
              onPress={() => runTableCommand((chain) => chain.deleteColumn())}
            >
              <Columns3 size={18} />
            </TableActionButton>
            <TableActionButton
              tone="danger"
              title={ui.math.tableDeleteTable}
              onPress={() => runTableCommand((chain) => chain.deleteTable())}
            >
              <Trash2 size={18} />
            </TableActionButton>
          </div>
        </div>
      </div>
    </BubbleMenu>
  );
}
