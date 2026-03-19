import type { ReactNode } from 'react';
import type { UILanguage } from '../electron';
import { getUiText } from '../lib/uiText';

import {
  Code,
  FolderOpen,
  ImagePlus,
  InlineFormula,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote,
  RotateCcw,
  RotateCw,
  Save,
  Smile,
  SplitSquareVertical,
  Table2,
  TerminalSquare,
} from './icons';

import type { EditorViewMode } from '../types';

interface ToolbarProps {
  viewMode: EditorViewMode;
  terminalVisible: boolean;
  hasUnsavedChanges: boolean;
  uiLanguage: UILanguage;
  onCommand: (command: string) => void;
}

function ToolbarButton({
  label,
  command,
  onCommand,
  active = false,
  variant = 'icon',
  children,
}: {
  label: string;
  command: string;
  onCommand: (command: string) => void;
  active?: boolean;
  variant?: 'icon' | 'text';
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`qm-toolbar-button qm-toolbar-button--${variant} ${active ? 'is-active' : ''}`}
      title={label}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={() => {
        onCommand(command);
      }}
    >
      {children}
    </button>
  );
}

export function Toolbar({
  viewMode,
  terminalVisible,
  hasUnsavedChanges,
  uiLanguage,
  onCommand,
}: ToolbarProps) {
  const ui = getUiText(uiLanguage);
  return (
    <div className="qm-toolbar">
      <div className="qm-toolbar-group">
        <ToolbarButton label={ui.toolbar.openFile} command="file:open-dialog" onCommand={onCommand}>
          <FolderOpen size={18} />
        </ToolbarButton>

        <ToolbarButton label={ui.toolbar.save} command="file:save" onCommand={onCommand} active={hasUnsavedChanges}>
          <Save size={17} />
        </ToolbarButton>
      </div>

      <div className="qm-toolbar-group">
        <ToolbarButton label={ui.toolbar.undo} command="edit:undo" onCommand={onCommand}>
          <RotateCcw size={17} />
        </ToolbarButton>
        <ToolbarButton label={ui.toolbar.redo} command="edit:redo" onCommand={onCommand}>
          <RotateCw size={17} />
        </ToolbarButton>
      </div>

      <div className="qm-toolbar-group">
        <ToolbarButton label={ui.toolbar.heading1} command="insert:heading-1" onCommand={onCommand} variant="text">
          <span>H1</span>
        </ToolbarButton>
        <ToolbarButton label={ui.toolbar.heading2} command="insert:heading-2" onCommand={onCommand} variant="text">
          <span>H2</span>
        </ToolbarButton>
        <ToolbarButton label={ui.toolbar.heading3} command="insert:heading-3" onCommand={onCommand} variant="text">
          <span>H3</span>
        </ToolbarButton>
        <ToolbarButton label={ui.toolbar.bold} command="insert:bold" onCommand={onCommand} variant="text">
          <span className="qm-toolbar-text--strong">B</span>
        </ToolbarButton>
        <ToolbarButton label={ui.toolbar.italic} command="insert:italic" onCommand={onCommand} variant="text">
          <span className="qm-toolbar-text--italic">I</span>
        </ToolbarButton>
        <ToolbarButton label={ui.toolbar.quote} command="insert:blockquote" onCommand={onCommand}>
          <Quote size={18} />
        </ToolbarButton>
        <ToolbarButton label={ui.toolbar.code} command="insert:inline-code" onCommand={onCommand}>
          <Code size={18} />
        </ToolbarButton>
        <ToolbarButton label={ui.toolbar.bulletList} command="insert:bullet-list" onCommand={onCommand}>
          <List size={18} />
        </ToolbarButton>
        <ToolbarButton label={ui.toolbar.orderedList} command="insert:ordered-list" onCommand={onCommand}>
          <ListOrdered size={18} />
        </ToolbarButton>
      </div>

      <div className="qm-toolbar-group">
        <ToolbarButton label={ui.toolbar.emoji} command="insert:emoji" onCommand={onCommand}>
          <Smile size={18} />
        </ToolbarButton>
        <ToolbarButton label={ui.toolbar.link} command="insert:link" onCommand={onCommand}>
          <Link size={18} />
        </ToolbarButton>
        <ToolbarButton label={ui.toolbar.image} command="insert:image" onCommand={onCommand}>
          <ImagePlus size={18} />
        </ToolbarButton>
        <ToolbarButton label={ui.toolbar.table} command="insert:table" onCommand={onCommand}>
          <Table2 size={18} />
        </ToolbarButton>
        <ToolbarButton label={ui.toolbar.rule} command="insert:rule" onCommand={onCommand}>
          <Minus size={18} />
        </ToolbarButton>
        <ToolbarButton label={ui.toolbar.math} command="insert:math" onCommand={onCommand}>
          <InlineFormula size={20} />
        </ToolbarButton>
      </div>

      <div className="qm-toolbar-group qm-toolbar-group--spacer">
        <ToolbarButton
          label={ui.toolbar.toggleSource}
          command="view:toggle-source"
          onCommand={onCommand}
          active={viewMode === 'source'}
        >
          <SplitSquareVertical size={18} />
        </ToolbarButton>
        <ToolbarButton
          label={ui.toolbar.toggleTerminal}
          command="view:toggle-terminal"
          onCommand={onCommand}
          active={terminalVisible}
        >
          <TerminalSquare size={18} />
        </ToolbarButton>
      </div>
    </div>
  );
}
