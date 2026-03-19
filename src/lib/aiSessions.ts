import type { AIMessage, AISession } from '../types';

const MAX_CONTEXT_TURNS = 5;
const ANSWER_SUMMARY_LENGTH = 400;
const SUMMARY_LIMIT = 1200;

function nowIso() {
  return new Date().toISOString();
}

export function createEmptyAiSession(index = 1): AISession {
  const timestamp = nowIso();
  return {
    id: crypto.randomUUID(),
    title: `New Chat ${index}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    summary: '',
    messages: [],
  };
}

function trimLine(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function deriveAiSessionTitle(messages: AIMessage[], fallbackTitle?: string) {
  const firstUserMessage = messages.find((message) => message.role === 'user')?.content || '';
  const compact = trimLine(firstUserMessage).replace(/^#+\s*/g, '');
  if (!compact) {
    return fallbackTitle || 'New Chat';
  }
  return compact.length > 32 ? `${compact.slice(0, 32).trim()}...` : compact;
}

export function summarizeAssistantReply(answer: string) {
  let clean = answer.trim();
  const evalStart = clean.indexOf('<!--SELF_EVAL-->');
  if (evalStart >= 0) {
    clean = clean.slice(0, evalStart).trim();
  }

  for (const marker of ['## References', '## references', '## Ref']) {
    const markerIndex = clean.indexOf(marker);
    if (markerIndex >= 0) {
      clean = clean.slice(0, markerIndex).trim();
      break;
    }
  }

  if (clean.length <= ANSWER_SUMMARY_LENGTH) {
    return clean;
  }

  const truncated = clean.slice(0, ANSWER_SUMMARY_LENGTH);
  for (const separator of ['。', '.', '\n']) {
    const lastBoundary = truncated.lastIndexOf(separator);
    if (lastBoundary > ANSWER_SUMMARY_LENGTH / 2) {
      return `${truncated.slice(0, lastBoundary + 1)}...`;
    }
  }

  return `${truncated}...`;
}

function buildTurns(messages: AIMessage[]) {
  const turns: Array<{ question: string; answerSummary: string }> = [];
  let pendingQuestion = '';

  messages.forEach((message) => {
    if (message.role === 'user') {
      pendingQuestion = message.content.trim();
      return;
    }

    if (!pendingQuestion) return;
    turns.push({
      question: pendingQuestion,
      answerSummary: summarizeAssistantReply(message.content),
    });
    pendingQuestion = '';
  });

  return turns;
}

export function buildAiSessionSummary(messages: AIMessage[]) {
  const turns = buildTurns(messages);
  if (turns.length <= MAX_CONTEXT_TURNS) {
    return '';
  }

  const evictedTurns = turns.slice(0, turns.length - MAX_CONTEXT_TURNS);
  const parts: string[] = [];
  evictedTurns.forEach((turn) => {
    parts.push(`Q: ${trimLine(turn.question)}`);
    parts.push(`A: ${trimLine(turn.answerSummary).slice(0, 150)}${turn.answerSummary.length > 150 ? '...' : ''}`);
  });

  const merged = parts.join('\n');
  if (merged.length <= SUMMARY_LIMIT) {
    return merged;
  }
  return merged.slice(-SUMMARY_LIMIT);
}

export function getAiContextMessages(messages: AIMessage[]) {
  return messages.slice(-MAX_CONTEXT_TURNS * 2).map((message) => ({
    role: message.role,
    content: message.content,
  }));
}
