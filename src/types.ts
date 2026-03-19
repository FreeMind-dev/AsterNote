import type { JSONContent } from '@tiptap/react';
import type { SearchHit } from './electron';

export type EditorViewMode = 'rich' | 'source';
export type SidebarSection = 'tools' | 'ai';
export type ToolPanelId = 'outline' | 'info' | 'find' | 'syntax';

export interface AppTab {
  id: string;
  path: string | null;
  name: string;
  markdown: string;
  savedMarkdown: string;
  viewMode: EditorViewMode;
  isDirty: boolean;
  lastModified: string | null;
  cachedContent?: JSONContent;
  savedCachedContent?: JSONContent;
}

export interface OutlineItem {
  id: string;
  level: number;
  text: string;
}

export interface DocumentStats {
  characters: number;
  charactersWithoutSpaces: number;
  words: number;
  paragraphs: number;
  headings: number;
  images: number;
  codeBlocks: number;
}

export interface EditorSelection {
  mode: EditorViewMode;
  text: string;
  from?: number;
  to?: number;
  start?: number;
  end?: number;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  action?: 'polish' | 'summarize' | 'translate' | 'continue' | 'chat';
  searchUsed?: boolean;
  searchQuery?: string;
  sources?: SearchHit[];
}

export interface AISession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  summary?: string;
  messages: AIMessage[];
}
