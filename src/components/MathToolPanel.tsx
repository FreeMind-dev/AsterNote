import { MathComposer } from './MathComposer';

interface MathToolPanelProps {
  markdown: string;
  onInsertMath: (latex: string, mode: 'inline' | 'block') => void;
}

export function MathToolPanel({ markdown, onInsertMath }: MathToolPanelProps) {
  return <MathComposer markdown={markdown} onInsertMath={onInsertMath} />;
}
