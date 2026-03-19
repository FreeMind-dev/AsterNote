import { useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';

import type { UILanguage } from '../electron';
import { MATH_SYMBOL_CATEGORIES, MATH_TEMPLATES } from '../lib/defaults';
import { getDocumentUiLanguage, getUiText } from '../lib/uiText';
import { RotateCcw, Sigma } from './icons';

interface MathComposerProps {
  markdown: string;
  onInsertMath: (latex: string, mode: 'inline' | 'block') => void;
  initialMode?: 'inline' | 'block';
  showTitle?: boolean;
  showDocumentHistory?: boolean;
  insertLabel?: string;
  className?: string;
  autoFocus?: boolean;
  uiLanguage?: UILanguage;
}

function renderPreview(latex: string, displayMode: boolean) {
  if (!latex.trim()) return '';
  return katex.renderToString(latex, {
    displayMode,
    throwOnError: false,
    trust: false,
    strict: false,
  });
}

function extractEquations(markdown: string) {
  const results: Array<{ latex: string; mode: 'inline' | 'block' }> = [];
  const blockMatches = markdown.matchAll(/\$\$([\s\S]+?)\$\$/g);
  for (const match of blockMatches) {
    const latex = match[1]?.trim();
    if (latex) results.push({ latex, mode: 'block' });
  }

  const inlineMatches = markdown.matchAll(/(?<!\$)\$([^$\n]+)\$(?!\$)/g);
  for (const match of inlineMatches) {
    const latex = match[1]?.trim();
    if (latex) results.push({ latex, mode: 'inline' });
  }

  return results.slice(0, 12);
}

export function MathComposer({
  markdown,
  onInsertMath,
  initialMode = 'block',
  showTitle = true,
  showDocumentHistory = true,
  insertLabel = '',
  className = 'qm-math-tool',
  autoFocus = false,
  uiLanguage,
}: MathComposerProps) {
  const resolvedLanguage = uiLanguage || getDocumentUiLanguage();
  const ui = getUiText(resolvedLanguage);
  const [latex, setLatex] = useState('');
  const [mode, setMode] = useState<'inline' | 'block'>(initialMode);
  const [activeCategory, setActiveCategory] = useState(0);
  const [showTemplates, setShowTemplates] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewHtml = useMemo(() => renderPreview(latex, mode === 'block'), [latex, mode]);
  const documentEquations = useMemo(() => extractEquations(markdown), [markdown]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!autoFocus) return;
    const focusTimer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [autoFocus]);

  const insertAtCursor = (snippet: string) => {
    setLatex((current) => `${current}${snippet}`);
  };

  return (
    <div className={className}>
      {showTitle && <div className="qm-panel-title">{ui.math.composer}</div>}

      <div className="qm-math-toolbar">
        <div className="qm-segmented-control">
          <button
            type="button"
            className={mode === 'block' ? 'is-active' : ''}
            onClick={() => setMode('block')}
          >
            {ui.math.block}
          </button>
          <button
            type="button"
            className={mode === 'inline' ? 'is-active' : ''}
            onClick={() => setMode('inline')}
          >
            {ui.math.inline}
          </button>
        </div>

        <button type="button" className="qm-icon-button qm-icon-button--small" onClick={() => setLatex('')}>
          <RotateCcw size={13} />
        </button>
      </div>

      <label className="qm-field qm-field--tight">
        <span>{ui.math.latex}</span>
        <textarea
          ref={textareaRef}
          value={latex}
          onChange={(event) => setLatex(event.target.value)}
          placeholder="\\int_0^1 x^2\\,dx"
          rows={3}
        />
      </label>

      <div className="qm-math-preview">
        {latex.trim() ? (
          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
        ) : (
          <div className="qm-empty-note">{ui.math.previewEmpty}</div>
        )}
      </div>

      <div className="qm-inline-actions qm-inline-actions--compact">
        <button
          type="button"
          className="qm-primary-button"
          disabled={!latex.trim()}
          onClick={() => {
            if (!latex.trim()) return;
            onInsertMath(latex.trim(), mode);
            setLatex('');
          }}
        >
          <Sigma size={13} />
          {insertLabel || ui.math.insertEquation}
        </button>
      </div>

      <div className="qm-math-toolbar qm-math-toolbar--secondary">
        <div className="qm-segmented-control">
          <button
            type="button"
            className={!showTemplates ? 'is-active' : ''}
            onClick={() => setShowTemplates(false)}
          >
            {ui.math.symbols}
          </button>
          <button
            type="button"
            className={showTemplates ? 'is-active' : ''}
            onClick={() => setShowTemplates(true)}
          >
            {ui.math.templates}
          </button>
        </div>

        {!showTemplates && (
          <select
            value={activeCategory}
            className="qm-math-select"
            onChange={(event) => setActiveCategory(Number(event.target.value))}
          >
            {MATH_SYMBOL_CATEGORIES.map((category, index) => (
              <option key={category.name} value={index}>
                {ui.math.symbolCategories[category.name as keyof typeof ui.math.symbolCategories] || category.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {!showTemplates ? (
        <div className="qm-math-symbol-grid">
          {MATH_SYMBOL_CATEGORIES[activeCategory].symbols.map((symbol) => (
            <button
              key={`${MATH_SYMBOL_CATEGORIES[activeCategory].name}-${symbol.latex}`}
              type="button"
              className="qm-math-symbol-button"
              onClick={() => insertAtCursor(symbol.latex)}
              title={`${symbol.name} · ${symbol.latex}`}
            >
              {symbol.display}
            </button>
          ))}
        </div>
      ) : (
        <div className="qm-math-template-list">
          {MATH_TEMPLATES.map((template) => (
            <button
              key={template.name}
              type="button"
              className="qm-math-template-item"
              onClick={() => setLatex(template.latex)}
            >
              <strong>
                {ui.math.templateNames[template.name as keyof typeof ui.math.templateNames] || template.name}
              </strong>
              <span>
                {ui.math.templateDescriptions[
                  template.description as keyof typeof ui.math.templateDescriptions
                ] || template.description}
              </span>
            </button>
          ))}
        </div>
      )}

      {showDocumentHistory && documentEquations.length > 0 && (
        <div className="qm-math-history">
          <div className="qm-section-caption">{ui.math.inThisDocument}</div>
          <div className="qm-math-history-list">
            {documentEquations.map((item, index) => (
              <button
                key={`${item.mode}-${index}`}
                type="button"
                className="qm-math-history-item"
                onClick={() => {
                  setLatex(item.latex);
                  setMode(item.mode);
                }}
                title={item.latex}
              >
                <span>{item.mode === 'block' ? ui.math.block : ui.math.inline}</span>
                <code>{item.latex}</code>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
