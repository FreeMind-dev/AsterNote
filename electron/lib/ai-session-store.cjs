const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const STORE_SCHEMA_VERSION = 2;
const MAX_CONTEXT_TURNS = 5;
const ANSWER_SUMMARY_LENGTH = 400;
const SUMMARY_LIMIT = 1200;

function sessionStorePath(userDataPath) {
  return path.join(userDataPath, 'asternote-ai-sessions.json');
}

function nowIso() {
  return new Date().toISOString();
}

function trimLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeSource(source) {
  if (!source || typeof source !== 'object') return undefined;
  if (!source.url || !source.title) return undefined;
  return {
    title: String(source.title),
    url: String(source.url),
    description: typeof source.description === 'string' ? source.description : '',
    source: typeof source.source === 'string' ? source.source : null,
    age: typeof source.age === 'string' ? source.age : null,
    contentExcerpt: typeof source.contentExcerpt === 'string' ? source.contentExcerpt : '',
    contentType: typeof source.contentType === 'string' ? source.contentType : null,
  };
}

function normalizeMessage(message, index) {
  const createdAt = typeof message?.createdAt === 'string' ? message.createdAt : nowIso();
  return {
    id: String(message?.id || `message-${index + 1}`),
    role: message?.role === 'assistant' ? 'assistant' : 'user',
    content: String(message?.content || ''),
    createdAt,
    action: typeof message?.action === 'string' ? message.action : undefined,
    searchUsed: Boolean(message?.searchUsed),
    searchQuery: typeof message?.searchQuery === 'string' ? message.searchQuery : undefined,
    sources: Array.isArray(message?.sources)
      ? message.sources.map(normalizeSource).filter(Boolean)
      : undefined,
  };
}

function summarizeAssistantReply(answer) {
  let clean = String(answer || '').trim();
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

function buildTurns(messages) {
  const turns = [];
  let pendingQuestion = '';

  messages.forEach((message) => {
    if (message.role === 'user') {
      pendingQuestion = String(message.content || '').trim();
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

function buildAiSessionSummary(messages) {
  const turns = buildTurns(messages);
  if (turns.length <= MAX_CONTEXT_TURNS) {
    return '';
  }

  const evictedTurns = turns.slice(0, turns.length - MAX_CONTEXT_TURNS);
  const parts = [];
  evictedTurns.forEach((turn) => {
    parts.push(`Q: ${trimLine(turn.question)}`);
    const shortAnswer = trimLine(turn.answerSummary).slice(0, 150);
    parts.push(`A: ${shortAnswer}${turn.answerSummary.length > 150 ? '...' : ''}`);
  });

  const merged = parts.join('\n');
  if (merged.length <= SUMMARY_LIMIT) {
    return merged;
  }
  return merged.slice(-SUMMARY_LIMIT);
}

function deriveAiSessionTitle(messages, fallbackTitle) {
  const firstUserMessage = messages.find((message) => message.role === 'user')?.content || '';
  const compact = trimLine(firstUserMessage).replace(/^#+\s*/g, '');
  if (!compact) {
    return fallbackTitle || 'New Chat';
  }
  return compact.length > 32 ? `${compact.slice(0, 32).trim()}...` : compact;
}

function normalizeSession(session, index) {
  const createdAt = typeof session?.createdAt === 'string' ? session.createdAt : nowIso();
  const messages = Array.isArray(session?.messages)
    ? session.messages.map((message, messageIndex) => normalizeMessage(message, messageIndex))
    : [];
  const fallbackTitle =
    deriveAiSessionTitle(messages, String(session?.title || '').trim()) || `New Chat ${index + 1}`;

  return {
    id: String(session?.id || randomUUID()),
    title: String(session?.title || fallbackTitle).trim() || fallbackTitle,
    createdAt,
    updatedAt: typeof session?.updatedAt === 'string' ? session.updatedAt : createdAt,
    summary:
      typeof session?.summary === 'string' && session.summary.trim().length > 0
        ? session.summary
        : buildAiSessionSummary(messages),
    messages,
  };
}

function normalizeMemoryItem(item) {
  if (!item || typeof item !== 'object') return undefined;
  const value = trimLine(item.value);
  if (!value) return undefined;
  const allowedTypes = new Set([
    'writing_style',
    'language_pref',
    'format_pref',
    'workflow_pref',
    'research_domain',
    'project_context',
  ]);
  const type = allowedTypes.has(item.type) ? item.type : 'workflow_pref';
  const confidence = Number(item.confidence);
  return {
    id: String(item.id || randomUUID()),
    type,
    value,
    confidence: Number.isFinite(confidence) ? Math.max(0.1, Math.min(1, confidence)) : 0.5,
    lastSeenAt: typeof item.lastSeenAt === 'string' ? item.lastSeenAt : nowIso(),
  };
}

function normalizeMemory(memory) {
  return {
    items: Array.isArray(memory?.items)
      ? memory.items.map(normalizeMemoryItem).filter(Boolean)
      : [],
    updatedAt: typeof memory?.updatedAt === 'string' ? memory.updatedAt : null,
    lastClearedAt: typeof memory?.lastClearedAt === 'string' ? memory.lastClearedAt : null,
  };
}

function collectMemoryCandidates(sessions, lastClearedAt) {
  const candidates = [];
  const clearTime = lastClearedAt ? new Date(lastClearedAt).getTime() : 0;
  const userMessages = sessions.flatMap((session) =>
    session.messages
      .filter((message) => {
        if (message.role !== 'user') return false;
        const createdAt = new Date(message.createdAt || 0).getTime();
        return Number.isFinite(createdAt) ? createdAt >= clearTime : true;
      })
      .map((message) => trimLine(message.content))
  );

  const joined = userMessages.join('\n').toLowerCase();

  const add = (type, value, confidence = 0.65) => {
    candidates.push({
      id: randomUUID(),
      type,
      value,
      confidence,
      lastSeenAt: nowIso(),
    });
  };

  if (/(academic|paper|manuscript|citation|latex|markdown|journal|scholar)/i.test(joined)) {
    add('research_domain', 'Works on academic writing and structured research notes.', 0.76);
  }
  if (/(concise|brief|short|简洁|精炼|简明)/i.test(joined)) {
    add('writing_style', 'Prefers concise answers when possible.', 0.7);
  }
  if (/(detailed|thorough|深入|详细|展开)/i.test(joined)) {
    add('writing_style', 'Asks for detailed explanations on complex tasks.', 0.72);
  }
  if (/(professional|formal|academic tone|正式|学术)/i.test(joined)) {
    add('writing_style', 'Prefers a professional, academic tone.', 0.68);
  }
  if (/(markdown table|use table|表格|markdown表格)/i.test(joined)) {
    add('format_pref', 'Likes structured output with Markdown tables when useful.', 0.74);
  }
  if (/(bullet|list|outline|分点|大纲)/i.test(joined)) {
    add('format_pref', 'Often prefers list-based, scan-friendly structure.', 0.62);
  }
  if (/(chinese|中文|用中文|回复中文)/i.test(joined)) {
    add('language_pref', 'Usually prefers Chinese responses.', 0.8);
  }
  if (/(english|英文|bilingual|双语)/i.test(joined)) {
    add('language_pref', 'Frequently switches between Chinese and English.', 0.6);
  }
  if (/(review first|audit first|先审查|先review|先看一下|先检查)/i.test(joined)) {
    add('workflow_pref', 'Prefers review and audit before feature expansion.', 0.74);
  }
  if (/(step by step|incremental|逐步|一步一步|先.*再)/i.test(joined)) {
    add('workflow_pref', 'Prefers incremental, staged collaboration.', 0.7);
  }

  return candidates;
}

function mergeMemory(existingMemory, sessions) {
  const existingItems = Array.isArray(existingMemory?.items) ? existingMemory.items : [];
  const candidateItems = collectMemoryCandidates(sessions, existingMemory?.lastClearedAt || null);
  const merged = new Map();

  [...existingItems, ...candidateItems].forEach((item) => {
    const normalized = normalizeMemoryItem(item);
    if (!normalized) return;
    const key = `${normalized.type}:${normalized.value.toLowerCase()}`;
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, normalized);
      return;
    }
    merged.set(key, {
      ...previous,
      confidence: Math.max(previous.confidence, normalized.confidence),
      lastSeenAt:
        new Date(previous.lastSeenAt).getTime() >= new Date(normalized.lastSeenAt).getTime()
          ? previous.lastSeenAt
          : normalized.lastSeenAt,
    });
  });

  return {
    items: Array.from(merged.values())
      .sort((left, right) => {
        if (right.confidence !== left.confidence) {
          return right.confidence - left.confidence;
        }
        return right.lastSeenAt.localeCompare(left.lastSeenAt);
      })
      .slice(0, 24),
    updatedAt: nowIso(),
    lastClearedAt: existingMemory?.lastClearedAt || null,
  };
}

function normalizeStore(store) {
  const sessions = Array.isArray(store?.sessions)
    ? store.sessions.map((session, index) => normalizeSession(session, index))
    : [];
  const activeSessionId =
    typeof store?.activeSessionId === 'string' && sessions.some((session) => session.id === store.activeSessionId)
      ? store.activeSessionId
      : sessions[0]?.id || null;
  const previousMemory = normalizeMemory(store?.memory);

  return {
    schemaVersion: STORE_SCHEMA_VERSION,
    activeSessionId,
    sessions,
    memory: mergeMemory(previousMemory, sessions),
  };
}

function loadAiSessionStore(userDataPath) {
  const filePath = sessionStorePath(userDataPath);
  try {
    if (!fs.existsSync(filePath)) {
      return normalizeStore({});
    }

    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return normalizeStore(raw);
  } catch (error) {
    console.error('[AsterNote] Failed to load AI sessions:', error);
    return normalizeStore({});
  }
}

function saveAiSessionStore(userDataPath, store) {
  const filePath = sessionStorePath(userDataPath);
  const next = normalizeStore(store);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

module.exports = {
  STORE_SCHEMA_VERSION,
  loadAiSessionStore,
  saveAiSessionStore,
};
