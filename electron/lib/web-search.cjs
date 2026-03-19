const { URL } = require('url');

const WEB_SEARCH_DEFAULTS = {
  brave: {
    baseUrl: 'https://api.search.brave.com/res/v1/web/search',
    maxResults: 20,
  },
  tavily: {
    baseUrl: 'https://api.tavily.com/search',
    maxResults: 20,
  },
  perplexity: {
    baseUrl: 'https://api.perplexity.ai/search',
    maxResults: 20,
  },
  google: {
    baseUrl: 'https://www.googleapis.com/customsearch/v1',
    maxResults: 10,
  },
};

function withProxyCompatibleEnv(task) {
  const keys = ['ALL_PROXY', 'all_proxy', 'HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'];
  const stripped = {};

  for (const key of keys) {
    const value = process.env[key];
    if (value && value.toLowerCase().startsWith('socks')) {
      stripped[key] = value;
      delete process.env[key];
    }
  }

  return Promise.resolve()
    .then(task)
    .finally(() => {
      Object.assign(process.env, stripped);
    });
}

function isSupportedProvider(provider) {
  return Object.prototype.hasOwnProperty.call(WEB_SEARCH_DEFAULTS, provider);
}

function getDefaultSearchBaseUrl(provider) {
  return WEB_SEARCH_DEFAULTS[provider]?.baseUrl || WEB_SEARCH_DEFAULTS.brave.baseUrl;
}

function getSearchProviderLabel(provider) {
  if (provider === 'tavily') return 'Tavily';
  if (provider === 'perplexity') return 'Perplexity';
  if (provider === 'google') return 'Google';
  return 'Brave';
}

function clampResultCount(provider, value) {
  const limit = WEB_SEARCH_DEFAULTS[provider]?.maxResults || 20;
  return Math.max(1, Math.min(limit, Number.isFinite(value) ? Number(value) : 5));
}

function sanitizeWebSearchConfig(config = {}, previous = {}) {
  const previousProvider = isSupportedProvider(previous.provider) ? previous.provider : 'brave';
  const provider = isSupportedProvider(config.provider) ? config.provider : previousProvider;
  const incomingKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : undefined;
  const incomingSearchEngineId =
    typeof config.searchEngineId === 'string' ? config.searchEngineId.trim() : undefined;
  const incomingBaseUrl = typeof config.baseUrl === 'string' ? config.baseUrl.trim() : undefined;
  const defaultBaseUrl = getDefaultSearchBaseUrl(provider);
  const shouldResetBaseUrl = provider !== previousProvider;

  return {
    enabled: config.enabled ?? previous.enabled ?? false,
    provider,
    baseUrl: String(
      incomingBaseUrl
      || (!shouldResetBaseUrl ? previous.baseUrl : '')
      || defaultBaseUrl
    )
      .trim()
      .replace(/\/$/, ''),
    resultCount: clampResultCount(
      provider,
      Number.isFinite(config.resultCount) ? Number(config.resultCount) : previous.resultCount || 5
    ),
    country: String(config.country || previous.country || 'US').trim() || 'US',
    searchLang: String(config.searchLang || previous.searchLang || 'en').trim() || 'en',
    searchEngineId:
      incomingSearchEngineId === undefined
        ? String(previous.searchEngineId || '')
        : incomingSearchEngineId,
    apiKey:
      incomingKey === undefined || incomingKey === ''
        ? String(previous.apiKey || '')
        : incomingKey,
  };
}

function maskApiKey(apiKey) {
  if (!apiKey) return '';
  if (apiKey.length <= 8) return '••••••••';
  return `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}`;
}

function webSearchForRenderer(config) {
  return {
    enabled: config.enabled,
    provider: config.provider,
    baseUrl: config.baseUrl,
    resultCount: config.resultCount,
    country: config.country,
    searchLang: config.searchLang,
    searchEngineId: config.searchEngineId || '',
    hasApiKey: Boolean(config.apiKey),
    apiKeyMasked: maskApiKey(config.apiKey),
  };
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function inferFreshness(query) {
  const lowered = String(query || '').toLowerCase();
  if (/(today|latest|breaking|newest|today's|今天|最新|刚刚|近期)/.test(lowered)) return 'pd';
  if (/(this week|recent|本周|最近|近一周)/.test(lowered)) return 'pw';
  if (/(this month|本月|近一个月)/.test(lowered)) return 'pm';
  if (/(this year|今年)/.test(lowered)) return 'py';
  return undefined;
}

function needsAuthoritativeSupport(query) {
  return /(guideline|guidelines|official|policy|criteria|standard|standards|regulation|regulations|consensus|recommendation|recommendations|指南|标准|规范|共识|官方|政策|法规)/i.test(
    query
  );
}

function needsFreshness(query) {
  return Boolean(inferFreshness(query));
}

function dedupeQueries(queries) {
  const seen = new Set();
  const next = [];
  for (const item of queries) {
    const value = normalizeWhitespace(item);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(value);
  }
  return next;
}

function getLastUserMessage(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      return normalizeWhitespace(messages[index].content);
    }
  }
  return '';
}

function rewriteFollowUpQuery(query, messages = []) {
  const normalized = normalizeWhitespace(query);
  if (!normalized) return '';

  const looksLikeFollowUp =
    normalized.length < 80
    && /(it|they|that|this|those|these|them|its|their|前面|刚才|上述|这个|那个|它|他们|这些|那些)/i.test(normalized);

  if (!looksLikeFollowUp) {
    return normalized;
  }

  const previousUserMessages = messages
    .filter((message) => message.role === 'user')
    .map((message) => normalizeWhitespace(message.content))
    .filter(Boolean);
  const previousTopic = previousUserMessages[previousUserMessages.length - 2] || '';
  if (!previousTopic) {
    return normalized;
  }

  return `${previousTopic} ${normalized}`.trim();
}

function buildSearchPlan({ query, messages = [], action = 'chat' }) {
  const rewritten = rewriteFollowUpQuery(query, messages);
  const fresh = needsFreshness(rewritten);
  const authoritative = needsAuthoritativeSupport(rewritten);
  const factualQuestion = /\?$/.test(rewritten) || /^(what|who|when|where|why|how|是否|什么|为何|如何|哪里|谁|何时)/i.test(rewritten);
  const shouldSearch =
    action === 'chat'
      ? fresh || authoritative || factualQuestion
      : fresh || authoritative;

  const alternativeQueries = [];
  if (authoritative) {
    alternativeQueries.push(`${rewritten} official guideline`);
  }
  if (fresh) {
    alternativeQueries.push(`${rewritten} latest`);
  }

  return {
    shouldSearch,
    primaryQuery: rewritten,
    alternativeQueries: dedupeQueries(alternativeQueries).slice(0, 2),
  };
}

async function fetchJson(url, options = {}) {
  return withProxyCompatibleEnv(async () => {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error?.message || data?.message || 'Search request failed.');
    }
    return data;
  });
}

function inferSourceFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function normalizeHit(item = {}) {
  return {
    title: normalizeWhitespace(item.title || ''),
    url: normalizeWhitespace(item.url || ''),
    description: normalizeWhitespace(item.description || ''),
    source: normalizeWhitespace(item.source || '') || inferSourceFromUrl(item.url || ''),
    age: normalizeWhitespace(item.age || '') || null,
    contentExcerpt: normalizeWhitespace(item.contentExcerpt || ''),
    contentType: item.contentType || null,
  };
}

async function fetchBraveResults(config, query) {
  const url = new URL(config.baseUrl);
  url.searchParams.set('q', String(query || '').trim());
  url.searchParams.set('count', String(config.resultCount));
  url.searchParams.set('country', config.country);
  url.searchParams.set('search_lang', config.searchLang);

  const freshness = inferFreshness(query);
  if (freshness) {
    url.searchParams.set('freshness', freshness);
  }

  const payload = await fetchJson(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': config.apiKey,
    },
  });

  return (payload?.web?.results || [])
    .map((item) => {
      const profile = item?.profile || {};
      const extraSnippets = Array.isArray(item?.extra_snippets) ? item.extra_snippets : [];
      return normalizeHit({
        title: item?.title,
        url: item?.url,
        description: item?.description || extraSnippets[0] || '',
        source: profile?.long_name || profile?.name || '',
        age: item?.age || item?.page_age || '',
      });
    })
    .filter((item) => item.title && item.url);
}

async function fetchTavilyResults(config, query) {
  const payload = await fetchJson(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      query,
      topic: inferFreshness(query) ? 'news' : 'general',
      max_results: config.resultCount,
      search_depth: 'advanced',
    }),
  });

  return (payload?.results || [])
    .map((item) =>
      normalizeHit({
        title: item?.title,
        url: item?.url,
        description: item?.content || item?.snippet || '',
        source: item?.source || '',
        age: item?.published_date || item?.published_at || '',
      })
    )
    .filter((item) => item.title && item.url);
}

async function fetchPerplexityResults(config, query) {
  const body = {
    query,
    max_results: config.resultCount,
  };

  const payload = await fetchJson(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  return (payload?.results || payload?.items || [])
    .map((item) =>
      normalizeHit({
        title: item?.title,
        url: item?.url,
        description: item?.snippet || item?.content || item?.description || '',
        source: item?.source || item?.domain || '',
        age: item?.date || item?.last_updated || '',
      })
    )
    .filter((item) => item.title && item.url);
}

async function fetchGoogleResults(config, query) {
  const url = new URL(config.baseUrl);
  url.searchParams.set('q', String(query || '').trim());
  url.searchParams.set('num', String(clampResultCount('google', config.resultCount)));
  url.searchParams.set('key', config.apiKey);
  url.searchParams.set('cx', config.searchEngineId);
  if (config.country) {
    url.searchParams.set('gl', config.country.toLowerCase());
  }
  if (config.searchLang) {
    url.searchParams.set('lr', `lang_${config.searchLang.toLowerCase()}`);
  }

  const payload = await fetchJson(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  return (payload?.items || [])
    .map((item) => {
      const metaTag = Array.isArray(item?.pagemap?.metatags) ? item.pagemap.metatags[0] : null;
      return normalizeHit({
        title: item?.title,
        url: item?.link,
        description: item?.snippet || '',
        source: metaTag?.['og:site_name'] || metaTag?.['twitter:site'] || '',
        age: item?.displayLink || '',
      });
    })
    .filter((item) => item.title && item.url);
}

function queryTokens(query) {
  return dedupeQueries(String(query || '').split(/[^\w\u4e00-\u9fff]+/).filter((item) => item.length >= 2))
    .map((item) => item.toLowerCase())
    .slice(0, 12);
}

function cleanHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h1|h2|h3|h4|h5|h6|td|th|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickExcerpt(blocks, query) {
  if (!blocks.length) return '';
  const tokens = queryTokens(query);
  const scored = blocks
    .map((block) => {
      const lowered = block.toLowerCase();
      const matches = tokens.reduce((count, token) => count + (lowered.includes(token) ? 1 : 0), 0);
      return {
        block,
        score: matches * 8 + Math.min(block.length, 400) / 100,
      };
    })
    .sort((left, right) => right.score - left.score);

  const excerpt = scored
    .slice(0, 2)
    .map((item) => item.block)
    .join('\n')
    .trim();
  return excerpt.length > 520 ? `${excerpt.slice(0, 520).trim()}...` : excerpt;
}

async function fetchPageExcerpt(url, query) {
  if (!url || /\.pdf($|\?)/i.test(url)) {
    return { contentExcerpt: '', contentType: null };
  }

  try {
    const response = await withProxyCompatibleEnv(() =>
      fetch(url, {
        redirect: 'follow',
        headers: {
          Accept: 'text/html, text/plain;q=0.9, */*;q=0.1',
        },
      })
    );

    if (!response.ok) {
      return { contentExcerpt: '', contentType: null };
    }

    const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim() || null;
    if (!contentType || (!contentType.includes('html') && !contentType.includes('text/plain'))) {
      return { contentExcerpt: '', contentType };
    }

    const raw = await response.text();
    const preferredMatch = raw.match(/<(main|article)[^>]*>([\s\S]*?)<\/\1>/i);
    const body = preferredMatch?.[2] || raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || raw;
    const blockMatches = body.match(/<(p|li|h1|h2|h3|h4|td|th|blockquote)[^>]*>[\s\S]*?<\/\1>/gi) || [];
    const blocks = blockMatches
      .map((item) => cleanHtml(item))
      .filter((item) => item.length >= 40)
      .slice(0, 30);
    const contentExcerpt = pickExcerpt(blocks.length > 0 ? blocks : [cleanHtml(body)], query);
    return { contentExcerpt, contentType };
  } catch {
    return { contentExcerpt: '', contentType: null };
  }
}

async function enrichHitsWithPageContent(hits, query, topK = 3) {
  const limit = Math.max(0, Math.min(topK, hits.length));
  const next = [...hits];

  for (let index = 0; index < limit; index += 1) {
    const hit = next[index];
    const { contentExcerpt, contentType } = await fetchPageExcerpt(hit.url, query);
    if (!contentExcerpt && !contentType) continue;
    next[index] = {
      ...hit,
      contentExcerpt,
      contentType,
    };
  }

  return next;
}

async function fetchSearchResults(config, query) {
  if (config.provider === 'tavily') {
    return fetchTavilyResults(config, query);
  }
  if (config.provider === 'perplexity') {
    return fetchPerplexityResults(config, query);
  }
  if (config.provider === 'google') {
    return fetchGoogleResults(config, query);
  }
  return fetchBraveResults(config, query);
}

async function searchWeb(config, query, options = {}) {
  const normalized = sanitizeWebSearchConfig(config, {});
  const primaryQuery = normalizeWhitespace(query);
  const candidateQueries = dedupeQueries([
    primaryQuery,
    ...(options.alternativeQueries || []),
  ]);

  const hits = [];
  const seenUrls = new Set();

  for (const candidate of candidateQueries) {
    const currentHits = await fetchSearchResults(normalized, candidate);
    for (const hit of currentHits) {
      if (seenUrls.has(hit.url)) continue;
      seenUrls.add(hit.url);
      hits.push(hit);
      if (hits.length >= normalized.resultCount) {
        break;
      }
    }
    if (hits.length >= normalized.resultCount) {
      break;
    }
  }

  return enrichHitsWithPageContent(hits, primaryQuery, options.enrichTopK ?? 3);
}

function formatSearchContext(query, hits) {
  if (!Array.isArray(hits) || hits.length === 0) {
    return '';
  }

  const lines = [`Web search results for "${query}":`];
  hits.forEach((hit, index) => {
    const detailParts = [hit.source, hit.age].filter(Boolean);
    const detail = detailParts.length > 0 ? ` | ${detailParts.join(' | ')}` : '';
    lines.push(`[${index + 1}] ${hit.title}${detail}`);
    lines.push(`URL: ${hit.url}`);
    if (hit.description) {
      lines.push(`Snippet: ${hit.description}`);
    }
    if (hit.contentExcerpt) {
      lines.push(`Page excerpt: ${hit.contentExcerpt}`);
    }
  });

  return lines.join('\n');
}

async function validateWebSearch(config) {
  const normalized = sanitizeWebSearchConfig(config, {});
  if (!normalized.apiKey) {
    return {
      ok: false,
      code: 'api_key_required',
      provider: normalized.provider,
      message: 'Search API key is required.',
    };
  }
  if (!normalized.baseUrl) {
    return {
      ok: false,
      code: 'base_url_required',
      provider: normalized.provider,
      message: 'Search base URL is required.',
    };
  }
  if (normalized.provider === 'google' && !normalized.searchEngineId) {
    return {
      ok: false,
      code: 'search_engine_id_required',
      provider: normalized.provider,
      message: 'Google Search engine ID is required.',
    };
  }

  try {
    const hits = await searchWeb(normalized, 'markdown editor latest');
    return {
      ok: true,
      code: 'verified',
      provider: normalized.provider,
      resultCount: hits.length,
      message: `${getSearchProviderLabel(normalized.provider)} search verified. Retrieved ${hits.length} result${hits.length === 1 ? '' : 's'}.`,
    };
  } catch (error) {
    return {
      ok: false,
      code: 'validation_failed',
      provider: normalized.provider,
      message: error instanceof Error ? error.message : 'Search validation failed.',
    };
  }
}

module.exports = {
  buildSearchPlan,
  formatSearchContext,
  getDefaultSearchBaseUrl,
  getLastUserMessage,
  getSearchProviderLabel,
  sanitizeWebSearchConfig,
  searchWeb,
  validateWebSearch,
  webSearchForRenderer,
};
