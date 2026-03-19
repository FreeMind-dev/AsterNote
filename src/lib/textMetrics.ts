import type { DocumentStats, OutlineItem } from '../types';

export function getOutlineFromMarkdown(markdown: string): OutlineItem[] {
  const outline: OutlineItem[] = [];

  markdown.split('\n').forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) return;

    outline.push({
      id: `heading-${index}`,
      level: match[1].length,
      text: match[2].trim(),
    });
  });

  return outline;
}

export function getDocumentStats(markdown: string): DocumentStats {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]+]\([^)]+\)/g, '$1')
    .replace(/[#>*_`~-]/g, ' ');

  const words = text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const paragraphs = markdown
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean).length;

  const headings = markdown.match(/^#{1,6}\s+/gm)?.length ?? 0;
  const images = markdown.match(/!\[[^\]]*]\([^)]+\)/g)?.length ?? 0;
  const codeBlocks = markdown.match(/```[\s\S]*?```/g)?.length ?? 0;

  return {
    characters: markdown.length,
    charactersWithoutSpaces: markdown.replace(/\s/g, '').length,
    words,
    paragraphs,
    headings,
    images,
    codeBlocks,
  };
}
