const OPENAI_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const OPENAI_ISSUER = "https://auth.openai.com";
const CODEX_API_ENDPOINT = "https://chatgpt.com/backend-api/codex/responses";
const CODEX_BROWSER_REDIRECT = "http://localhost:1455/auth/callback";
const OAUTH_PENDING_KEY = "chatgptBrowserAuthPending";
const DEVICE_PENDING_KEY = "chatgptDeviceAuthPending";
const SETTINGS_KEY = "settings";
const CHATGPT_AUTH_KEY = "chatgptAuth";
const PLAN_CACHE_KEY = "planCacheV1";
const USAGE_STATS_KEY = "usageStatsV1";
const PROMPT_VERSION = 6;
const RATE_STEPS = [1, 1.15, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5, 4];
const SPEED_MODES = ["calm", "reasonable", "aggressive"];
const VIEWER_GOAL_MODES = ["auto", "learn", "find_answer", "follow_steps", "skim", "evaluate_claims", "enjoy"];
const INTENT_VERSION = 1;
const VIDEO_TYPES = [
  "podcast_interview",
  "tutorial_lecture",
  "coding_demo",
  "news_analysis",
  "music_reaction",
  "product_review",
  "vlog_story",
  "sports_gameplay",
  "sponsor_ad",
  "mixed",
  "unknown"
];
const VIEWER_TASKS = [
  "learn",
  "follow_steps",
  "evaluate_claims",
  "enjoy_performance",
  "track_news",
  "understand_story",
  "skim",
  "mixed",
  "unknown"
];
const PLAN_ROLES = [
  "core",
  "setup",
  "example",
  "demo",
  "instruction",
  "definition",
  "data",
  "story",
  "humor",
  "transition",
  "recap",
  "intro",
  "outro",
  "sponsor",
  "filler",
  "qna",
  "music",
  "uncertain"
];
const SPEED_TIERS = ["base", "slight", "medium", "fast", "max"];
const EVIDENCE_TYPES = [
  "concept",
  "procedure",
  "example",
  "warning",
  "conclusion",
  "normal",
  "recap",
  "repetition",
  "filler",
  "sponsor_cta",
  "off_topic",
  "music",
  "uncertain"
];
const PROTECTED_ROLES = new Set(["core", "demo", "instruction", "definition", "data", "story", "humor", "qna", "music"]);
const ACCELERATABLE_ROLES = new Set(["intro", "outro", "sponsor", "filler", "recap", "transition"]);
const activeAiRequests = new Set();

chrome.storage.local.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" }).catch(() => {});

const DEFAULT_SETTINGS = {
  enabled: true,
  aiSpeedActive: true,
  autoAnalyze: true,
  provider: "heuristic",
  aggressiveness: "normal",
  speedMode: "reasonable",
  viewerGoalMode: "auto",
  viewerGoalText: "",
  customPrompt: "",
  targetRate: 1,
  maxRate: 1.75,
  defaultRate: 1,
  minSegmentSeconds: 4,
  openaiApiKey: "",
  openaiModel: "gpt-4.1-mini",
  openrouterApiKey: "",
  openrouterModel: "openai/gpt-4.1-mini",
  googleApiKey: "",
  googleModel: "gemini-2.0-flash",
  chatgptModel: "gpt-5.4-mini"
};

const SPEED_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    videoType: { type: "string", enum: VIDEO_TYPES },
    viewerTask: { type: "string", enum: VIEWER_TASKS },
    planStrategy: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "integer" },
          speedTier: { type: "string", enum: SPEED_TIERS },
          importance: { type: "string", enum: ["low", "medium", "high"] },
          role: { type: "string", enum: PLAN_ROLES },
          evidence: { type: "string", enum: EVIDENCE_TYPES },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          reason: { type: "string" }
        },
        required: ["id", "speedTier", "importance", "role", "evidence", "confidence", "reason"]
      }
    }
  },
  required: ["videoType", "viewerTask", "planStrategy", "items"]
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (!details.url.startsWith(CODEX_BROWSER_REDIRECT)) return;
  void handleChatgptBrowserRedirect(details.url, details.tabId);
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "getSettings":
      return sanitizeSettings(await getSettings());
    case "saveSettings":
      return sanitizeSettings(await saveSettings(message.settings || {}));
    case "getProviderStatus":
      return getProviderStatus();
    case "getUsageStats":
      return getUsageStats();
    case "addSavedTime":
      return addSavedTime(message.payload || {});
    case "testProviderConnection":
      return testProviderConnection();
    case "analyzeTranscript":
      return analyzeTranscript(message.payload || {});
    case "clearCache":
      await chrome.storage.local.set({ [PLAN_CACHE_KEY]: {} });
      return { cleared: true };
    case "startChatgptBrowserAuth":
      return startChatgptBrowserAuth();
    case "startChatgptDeviceAuth":
      return startChatgptDeviceAuth();
    case "pollChatgptDeviceAuth":
      return pollChatgptDeviceAuth();
    case "disconnectChatgpt":
      await chrome.storage.local.remove(CHATGPT_AUTH_KEY);
      await chrome.storage.session?.remove?.([OAUTH_PENDING_KEY, DEVICE_PENDING_KEY]);
      return getProviderStatus();
    case "forgetProviderKeys":
      await saveSettings({
        openaiApiKey: "",
        openrouterApiKey: "",
        googleApiKey: ""
      });
      return getProviderStatus();
    case "openOptions":
      chrome.runtime.openOptionsPage();
      return { opened: true };
    case "getTabState":
      if (!sender.tab?.id) return { active: false };
      return { active: true, tabId: sender.tab.id };
    default:
      throw new Error(`Unknown message type: ${message?.type}`);
  }
}

async function getSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings({ ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) });
}

async function saveSettings(patch) {
  const current = await getSettings();
  const next = normalizeSettings({ ...current, ...patch });
  if (current.aiSpeedActive && !next.aiSpeedActive) abortActiveAiRequests();
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

function normalizeSettings(input) {
  const settings = { ...DEFAULT_SETTINGS, ...(input || {}) };
  settings.enabled = true;
  settings.aiSpeedActive = input?.aiSpeedActive === undefined ? true : Boolean(input.aiSpeedActive);
  const provider = String(settings.provider || DEFAULT_SETTINGS.provider);
  settings.provider = ["heuristic", "openai", "openrouter", "google", "chatgpt"].includes(provider) ? provider : "heuristic";

  settings.speedMode = normalizeSpeedMode(settings.speedMode || legacySpeedMode(settings.aggressiveness));
  settings.aggressiveness =
    settings.speedMode === "calm" ? "conservative" : settings.speedMode === "aggressive" ? "aggressive" : "normal";
  settings.viewerGoalMode = VIEWER_GOAL_MODES.includes(settings.viewerGoalMode) ? settings.viewerGoalMode : "auto";
  settings.viewerGoalText = String(settings.viewerGoalText || "").replace(/\s+/g, " ").trim().slice(0, 180);
  settings.customPrompt = String(settings.customPrompt || "").replace(/\s+/g, " ").trim().slice(0, 700);

  settings.targetRate = snapRate(settings.targetRate ?? settings.defaultRate, 1, 4);
  settings.defaultRate = settings.targetRate;
  settings.maxRate = snapRate(settings.maxRate, 1, 4);
  if (settings.maxRate < settings.targetRate) settings.maxRate = settings.targetRate;
  settings.minSegmentSeconds = Math.max(2, Math.min(Number(settings.minSegmentSeconds) || 4, 30));

  for (const key of ["openaiModel", "openrouterModel", "googleModel", "chatgptModel"]) {
    settings[key] = String(settings[key] || DEFAULT_SETTINGS[key] || "").trim();
  }
  return settings;
}

function normalizeSpeedMode(value) {
  const mode = String(value || "").toLowerCase();
  return SPEED_MODES.includes(mode) ? mode : "reasonable";
}

function legacySpeedMode(value) {
  if (value === "conservative") return "calm";
  if (value === "aggressive") return "aggressive";
  return "reasonable";
}

function sanitizeSettings(settings) {
  return {
    ...settings,
    openaiApiKey: maskSecret(settings.openaiApiKey),
    openrouterApiKey: maskSecret(settings.openrouterApiKey),
    googleApiKey: maskSecret(settings.googleApiKey)
  };
}

function maskSecret(value) {
  if (!value) return "";
  if (value.length <= 8) return "saved";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function assertAiSpeedEnabled(settings) {
  if (settings.enabled === false) throw new Error("AI Speed is off.");
}

function createAiRequestController() {
  const controller = new AbortController();
  activeAiRequests.add(controller);
  return controller;
}

function releaseAiRequestController(controller) {
  activeAiRequests.delete(controller);
}

function abortActiveAiRequests() {
  for (const controller of activeAiRequests) controller.abort();
  activeAiRequests.clear();
}

function isAiDisabledError(error) {
  return error?.name === "AbortError" || /AI Speed is off/i.test(error?.message || String(error));
}

async function getProviderStatus() {
  const settings = await getSettings();
  const chatgptAuth = await getChatgptAuth();
  return {
    provider: settings.provider,
    byok: {
      openai: Boolean(settings.openaiApiKey),
      openrouter: Boolean(settings.openrouterApiKey),
      google: Boolean(settings.googleApiKey)
    },
    chatgpt: chatgptAuth
      ? {
          connected: true,
          expires: chatgptAuth.expires || 0,
          accountId: chatgptAuth.accountId || ""
        }
      : { connected: false }
  };
}

async function getUsageStats() {
  const data = await chrome.storage.local.get(USAGE_STATS_KEY);
  const stored = data[USAGE_STATS_KEY] || {};
  return {
    totalSavedSeconds: Math.max(0, Number(stored.totalSavedSeconds) || 0),
    videos: typeof stored.videos === "object" && stored.videos ? stored.videos : {},
    updatedAt: Number(stored.updatedAt) || 0
  };
}

async function addSavedTime(payload) {
  const seconds = Math.max(0, Math.min(Number(payload.seconds) || 0, 60));
  const videoId = String(payload.videoId || "").trim();
  if (!seconds) return getUsageStats();

  const stats = await getUsageStats();
  stats.totalSavedSeconds += seconds;
  stats.updatedAt = Date.now();
  if (videoId) {
    stats.videos[videoId] = Math.max(0, Number(stats.videos[videoId]) || 0) + seconds;
    trimVideoStats(stats.videos);
  }
  await chrome.storage.local.set({ [USAGE_STATS_KEY]: stats });
  return stats;
}

function trimVideoStats(videos) {
  const entries = Object.entries(videos);
  if (entries.length <= 200) return;
  const trimmed = Object.fromEntries(entries.slice(entries.length - 200));
  for (const key of Object.keys(videos)) delete videos[key];
  Object.assign(videos, trimmed);
}

async function testProviderConnection() {
  const settings = await getSettings();
  assertAiSpeedEnabled(settings);
  const provider = settings.provider || "heuristic";

  if (provider === "heuristic") {
    return {
      provider,
      model: "local",
      message: "Merhaba, yerel heuristic çalışıyorum."
    };
  }

  const controller = createAiRequestController();
  let message;
  try {
    if (provider === "openai") message = await testOpenAIConnection(settings, { signal: controller.signal });
    else if (provider === "openrouter") message = await testOpenRouterConnection(settings, { signal: controller.signal });
    else if (provider === "google") message = await testGoogleConnection(settings, { signal: controller.signal });
    else if (provider === "chatgpt") message = await testChatgptConnection(settings, { signal: controller.signal });
    else throw new Error(`Unknown provider: ${provider}`);
  } catch (error) {
    if (isAiDisabledError(error)) throw new Error("AI Speed is off.");
    throw error;
  } finally {
    releaseAiRequestController(controller);
  }

  return {
    provider,
    model: providerModel(settings),
    message: normalizeTestMessage(message)
  };
}

async function analyzeTranscript(payload) {
  const settings = await getSettings();
  assertAiSpeedEnabled(settings);
  const segments = normalizeTranscriptSegments(payload.segments || []);
  if (!segments.length) throw new Error("No transcript segments were provided.");

  const duration = Number(payload.duration) || segments[segments.length - 1].end;
  let analysisPayload = { ...payload, duration };
  const chunks = buildTranscriptChunks(segments, duration);
  const intent = deriveViewerIntent(analysisPayload, chunks, settings);
  const chunkIntent = scoreChunkIntentRelevance(chunks, intent, analysisPayload);
  analysisPayload = { ...analysisPayload, intent, chunkIntent };
  const cacheKey = await buildCacheKey(analysisPayload, chunks, settings);
  const cache = await getPlanCache();
  if (!payload.force && cache[cacheKey]) {
    return { ...cache[cacheKey], cached: true };
  }

  assertAiSpeedEnabled(await getSettings());
  const controller = createAiRequestController();
  let result;
  try {
    if (settings.provider === "openai") result = await callOpenAI(settings, chunks, analysisPayload, { signal: controller.signal });
    else if (settings.provider === "openrouter") result = await callOpenRouter(settings, chunks, analysisPayload, { signal: controller.signal });
    else if (settings.provider === "google") result = await callGoogle(settings, chunks, analysisPayload, { signal: controller.signal });
    else if (settings.provider === "chatgpt") result = await callChatgptCodex(settings, chunks, analysisPayload, { signal: controller.signal });
    else {
      result = {
        items: makeHeuristicItems(chunks, settings, chunkIntent),
        source: "heuristic",
        videoType: "unknown",
        viewerTask: "skim",
        planStrategy: "Local keyword heuristic; protect likely core content and accelerate obvious filler."
      };
    }
  } catch (error) {
    if (isAiDisabledError(error)) throw new Error("AI Speed is off.");
    result = {
      items: makeHeuristicItems(chunks, settings, chunkIntent),
      source: "heuristic-fallback",
      warning: error.message || String(error),
      videoType: "unknown",
      viewerTask: "skim",
      planStrategy: "Provider failed; local keyword heuristic created the fallback plan."
    };
  } finally {
    releaseAiRequestController(controller);
  }

  const plan = normalizeSpeedPlan(chunks, result.items || [], duration, settings, chunkIntent);
  const response = {
    plan,
    source: result.source || settings.provider,
    warning: result.warning || "",
    intent,
    videoType: result.videoType || "",
    viewerTask: result.viewerTask || "",
    planStrategy: result.planStrategy || "",
    cached: false,
    stats: {
      transcriptSegments: segments.length,
      analysisChunks: chunks.length,
      duration,
      promptVersion: PROMPT_VERSION,
      intent,
      videoType: result.videoType || "",
      viewerTask: result.viewerTask || ""
    }
  };

  cache[cacheKey] = response;
  await trimAndSavePlanCache(cache);
  return response;
}

function normalizeTranscriptSegments(input) {
  return input
    .map((item) => {
      const start = Number(item.start);
      const end = Number(item.end);
      const text = String(item.text || "").replace(/\s+/g, " ").trim();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text) return undefined;
      return { start, end, text };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
}

function buildTranscriptChunks(segments, duration) {
  const chunks = [];
  let current = null;
  const targetSeconds = analysisChunkTargetSeconds(duration);
  const maxChars = analysisChunkMaxChars(duration);

  for (const segment of segments) {
    if (!current) {
      current = { id: chunks.length, start: segment.start, end: segment.end, text: segment.text };
      continue;
    }
    const wouldBeLong = segment.end - current.start > targetSeconds;
    const wouldBeVerbose = current.text.length + segment.text.length > maxChars;
    if (wouldBeLong || wouldBeVerbose) {
      chunks.push(current);
      current = { id: chunks.length, start: segment.start, end: segment.end, text: segment.text };
    } else {
      current.end = Math.max(current.end, segment.end);
      current.text = `${current.text} ${segment.text}`;
    }
  }
  if (current) chunks.push(current);

  const maxChunks = maxAnalysisChunks(duration);
  if (chunks.length <= maxChunks) return chunks;
  return coarsenChunks(chunks, Math.ceil(chunks.length / maxChunks));
}

function analysisChunkTargetSeconds(duration) {
  if (duration > 3600) return 14;
  if (duration > 1800) return 10;
  if (duration > 600) return 8;
  return 6;
}

function analysisChunkMaxChars(duration) {
  if (duration > 3600) return 360;
  if (duration > 1800) return 280;
  if (duration > 600) return 240;
  return 220;
}

function maxAnalysisChunks(duration) {
  if (duration > 7200) return 1100;
  if (duration > 3600) return 1000;
  return 900;
}

function coarsenChunks(chunks, stride) {
  const coarsened = [];
  for (let index = 0; index < chunks.length; index += stride) {
    const group = chunks.slice(index, index + stride);
    coarsened.push({
      id: coarsened.length,
      start: group[0].start,
      end: group[group.length - 1].end,
      text: trimChunkText(group.map((item) => item.text).join(" "), 900)
    });
  }
  return coarsened;
}

function trimChunkText(text, max = 900) {
  text = String(text || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const side = Math.floor((max - 5) / 2);
  return `${text.slice(0, side)} ... ${text.slice(-side)}`;
}

function summarizeChunkText(text, max = 72) {
  text = String(text || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

async function callOpenAI(settings, chunks, payload, { signal } = {}) {
  if (!settings.openaiApiKey) throw new Error("OpenAI API key is missing.");
  const body = buildResponsesBody(settings.openaiModel, chunks, payload, settings, { temperature: 0 });
  const data = await fetchJson("https://api.openai.com/v1/responses", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.openaiApiKey}`
    },
    body: JSON.stringify(body)
  });
  return { ...parsePlanObject(data), source: "openai" };
}

async function callChatgptCodex(settings, chunks, payload, { signal } = {}) {
  let auth = await getChatgptAuth();
  if (!auth) throw new Error("ChatGPT Plus/Pro auth is not connected.");
  if (!auth.access || !auth.expires || auth.expires < Date.now() + 180_000) {
    auth = await refreshChatgptAuth(auth);
  }

  const body = buildResponsesBody(settings.chatgptModel, chunks, payload, settings);
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${auth.access}`,
    originator: "adaptive-speed-ai",
    "session-id": payload.videoId || crypto.randomUUID()
  };
  if (auth.accountId) headers["ChatGPT-Account-Id"] = auth.accountId;

  let data;
  try {
    data = await fetchJson(CODEX_API_ENDPOINT, {
      method: "POST",
      signal,
      headers,
      body: JSON.stringify(body)
    });
  } catch (error) {
    if (!/HTTP 401|HTTP 403/.test(error.message || "")) throw error;
    auth = await refreshChatgptAuth(auth);
    headers.Authorization = `Bearer ${auth.access}`;
    if (auth.accountId) headers["ChatGPT-Account-Id"] = auth.accountId;
    data = await fetchJson(CODEX_API_ENDPOINT, {
      method: "POST",
      signal,
      headers,
      body: JSON.stringify(body)
    });
  }
  return { ...parsePlanObject(data), source: "chatgpt-codex" };
}

async function callOpenRouter(settings, chunks, payload, { signal } = {}) {
  if (!settings.openrouterApiKey) throw new Error("OpenRouter API key is missing.");
  const prompts = buildPrompts(chunks, payload, settings);
  const data = await fetchJson("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.openrouterApiKey}`,
      "HTTP-Referer": "https://www.youtube.com/",
      "X-Title": "Adaptive Speed AI"
    },
    body: JSON.stringify({
      model: settings.openrouterModel,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompts.system },
        { role: "user", content: prompts.user }
      ]
    })
  });
  const content = data?.choices?.[0]?.message?.content || "";
  return { ...normalizePlanObject(parseJsonPlanText(content)), source: "openrouter" };
}

async function callGoogle(settings, chunks, payload, { signal } = {}) {
  if (!settings.googleApiKey) throw new Error("Google Gemini API key is missing.");
  const prompts = buildPrompts(chunks, payload, settings);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    settings.googleModel
  )}:generateContent?key=${encodeURIComponent(settings.googleApiKey)}`;
  const data = await fetchJson(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${prompts.system}\n\n${prompts.user}` }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    })
  });
  const content = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  return { ...normalizePlanObject(parseJsonPlanText(content)), source: "google" };
}

async function testOpenAIConnection(settings, { signal } = {}) {
  if (!settings.openaiApiKey) throw new Error("OpenAI API key is missing.");
  const data = await fetchJson("https://api.openai.com/v1/responses", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.openaiApiKey}`
    },
    body: JSON.stringify(buildConnectionTestResponsesBody(settings.openaiModel))
  });
  return parseTextResponse(data);
}

async function testChatgptConnection(settings, { signal } = {}) {
  let auth = await getChatgptAuth();
  if (!auth) throw new Error("ChatGPT Plus/Pro auth is not connected.");
  if (!auth.access || !auth.expires || auth.expires < Date.now() + 180_000) {
    auth = await refreshChatgptAuth(auth);
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${auth.access}`,
    originator: "adaptive-speed-ai",
    "session-id": crypto.randomUUID()
  };
  if (auth.accountId) headers["ChatGPT-Account-Id"] = auth.accountId;

  let data;
  try {
    data = await fetchJson(CODEX_API_ENDPOINT, {
      method: "POST",
      signal,
      headers,
      body: JSON.stringify(buildConnectionTestResponsesBody(settings.chatgptModel))
    });
  } catch (error) {
    if (!/HTTP 401|HTTP 403/.test(error.message || "")) throw error;
    auth = await refreshChatgptAuth(auth);
    headers.Authorization = `Bearer ${auth.access}`;
    if (auth.accountId) headers["ChatGPT-Account-Id"] = auth.accountId;
    data = await fetchJson(CODEX_API_ENDPOINT, {
      method: "POST",
      signal,
      headers,
      body: JSON.stringify(buildConnectionTestResponsesBody(settings.chatgptModel))
    });
  }
  return parseTextResponse(data);
}

async function testOpenRouterConnection(settings, { signal } = {}) {
  if (!settings.openrouterApiKey) throw new Error("OpenRouter API key is missing.");
  const data = await fetchJson("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.openrouterApiKey}`,
      "HTTP-Referer": "https://www.youtube.com/",
      "X-Title": "Adaptive Speed AI"
    },
    body: JSON.stringify({
      model: settings.openrouterModel,
      temperature: 0,
      max_tokens: 40,
      messages: [
        {
          role: "system",
          content: "You are a connection test. Reply with one short Turkish sentence confirming you are working."
        },
        {
          role: "user",
          content: "Selam. Test bağlantısı için kısa cevap ver: Merhaba, çalışıyorum."
        }
      ]
    })
  });
  return data?.choices?.[0]?.message?.content || "";
}

async function testGoogleConnection(settings, { signal } = {}) {
  if (!settings.googleApiKey) throw new Error("Google Gemini API key is missing.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    settings.googleModel
  )}:generateContent?key=${encodeURIComponent(settings.googleApiKey)}`;
  const data = await fetchJson(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "You are a connection test. Reply with one short Turkish sentence confirming you are working: Merhaba, çalışıyorum."
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 40
      }
    })
  });
  return data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
}

function buildConnectionTestResponsesBody(model) {
  const instructions = "You are a connection test. Reply with one short Turkish sentence confirming you are working.";
  return {
    model,
    instructions,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Selam. Test bağlantısı için kısa cevap ver: Merhaba, çalışıyorum."
          }
        ]
      }
	    ],
	    store: false,
	    stream: true,
	  };
	}

function buildResponsesBody(model, chunks, payload, settings, options = {}) {
  const prompts = buildPrompts(chunks, payload, settings);
  const body = {
    model,
    instructions: prompts.system,
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: prompts.user }]
      }
    ],
    store: false,
    stream: true,
    text: {
      format: {
        type: "json_schema",
        name: "speed_plan",
        strict: true,
        schema: SPEED_PLAN_SCHEMA
      }
    }
  };
  if (options.temperature !== undefined) body.temperature = options.temperature;
  return body;
}

function buildPrompts(chunks, payload, settings) {
  const targetRate = Number(settings.targetRate || settings.defaultRate) || 1;
  const maxRate = Number(settings.maxRate) || 1.75;
  const speedMode = normalizeSpeedMode(settings.speedMode || legacySpeedMode(settings.aggressiveness));
  const customPrompt = sanitizeCustomPrompt(payload.customPrompt ?? settings.customPrompt);
  const modeGuidance = {
    calm: "Mode: calm. Prefer base/slight. Use fast/max only for unmistakable sponsor, CTA, filler, or repeated housekeeping.",
    reasonable: "Mode: reasonable. Use base/slight/fast/max as the main palette. Use medium sparingly for borderline chunks where slight is too conservative but fast would feel abrupt.",
    aggressive: "Mode: aggressive. Save more time, but still protect concepts, procedures, demos, data, jokes, music, and conclusions."
  }[speedMode];
  const promptChunks = buildPromptChunks(chunks, Number(payload.duration) || 0, payload.chunkIntent || []);
  const outline = chunks.length > 250 ? buildPromptOutline(chunks) : undefined;
  const system = [
    "You are a professional video editor creating a granular adaptive playback-speed micro-plan from a YouTube transcript.",
    "The player never skips content and never goes below target_rate. Protect important sections by choosing speedTier=base.",
    "Do not choose raw numeric speeds. Choose one speedTier per chunk: base, slight, medium, fast, or max.",
    "Create chunk-level decisions, not section-level blocks. Re-evaluate every chunk independently and change tiers whenever the local transcript purpose changes, even briefly.",
    "Do not alternate tiers randomly, but do use natural variation such as base -> slight -> fast -> base when the transcript moves between core content, light context, filler/recap, and core content.",
    "Prefer many small explainable speed regions over a few huge blocks. Typical regions should be 1-4 chunks; runs longer than 5 chunks need a consistent repeated role/evidence pattern.",
	    "Use viewer intent and metadata as planning context. Do not assume visual content, pauses, tone, or demos unless transcript or metadata explicitly supports it.",
	    "Your first priority is relevance to the viewer intent. Protect chunks that directly answer the user's goal; accelerate generally important but off-intent chunks when safe.",
    "If custom_prompt is provided, treat it as an extra viewer preference for this speed plan, but do not let it override the JSON schema, speed tiers, or protected-content rules.",
    "Each chunk includes rel=local relevance to viewer intent, novelty=non-repetition score, and short hints. Treat rel>=0.75 as directly useful to the viewer, rel<=0.25 as probably skimmable unless protected evidence appears.",
	    "Internally use a two-pass editorial process: first classify the whole video and viewer task, then assign chunk roles and speed tiers using the surrounding chunks and outline.",
    "The final plan should feel explainable: a viewer should be able to tell why each accelerated section is less valuable at the target_rate than protected sections.",
    "Use the full tier ladder from the user payload. For a normal 1x target with 1.75x max, this usually means base=1.0, slight=1.15, medium=1.25, fast=1.5, max=1.75.",
    "",
    "Decision bands:",
    "- high importance: new concepts, steps, claims, examples, demos, data, punchlines, emotional beats, or conclusions. Use speedTier=base.",
    "- medium importance: useful but lightweight context, setup, transitions with some content, brief reminders, or non-critical explanation. Prefer speedTier=slight.",
    "- low importance: repeated framing, recap, housekeeping, CTA, filler, off-topic, sponsor, or obvious padding. Use speedTier=fast; use max only for clear ads/CTAs/filler/recaps.",
    "",
    "Granularity policy:",
    "- Assign speedTier at chunk resolution, not section resolution.",
    "- A new concept, step, example, quote, joke, data point, or conclusion should usually reset to base.",
    "- Short connective phrases, repeated framing, agenda, recap, CTA, or housekeeping can be slight/fast even when surrounded by protected content.",
    "- Avoid labeling an entire intro, interview answer, lecture section, or story arc with one tier unless every chunk has the same local value.",
    "",
    "Protected content: definitions, new concepts, procedures, ordered steps, commands, code, file paths, formulas, warnings, mistakes, troubleshooting, examples, demos, conclusions, nuanced claims, data/numbers, named entities, source attribution, jokes/punchlines, emotional moments, music/lyrics/performances.",
    "Acceleratable content: greetings, agenda, housekeeping, sponsor reads, affiliate/coupon pitches, like/subscribe CTAs, merch/newsletter/platform promos, repeated recaps, filler phrasing, rambling transitions, obvious off-topic asides.",
    "",
    "Video-type policy:",
    "- Podcasts/interviews: protect questions, direct answers, expert claims, story payoffs, jokes, emotional moments, and conclusions; accelerate greetings, praise padding, repeated framing, ads, CTAs, and rambling transitions.",
    "- Tutorials/lectures: protect prerequisites, definitions, warnings, steps, examples, troubleshooting, proofs, formulas, diagrams described in speech, and takeaways; accelerate agenda, repeated summaries, obvious navigation, waiting, and recap.",
    "- Coding demos: protect commands, code, config, file paths, errors, debugging, output interpretation, and architecture decisions; accelerate project intro, install waiting, repeated glue, boilerplate recap, sponsors, and CTAs.",
    "- News/analysis: protect headline facts, dates, numbers, named entities, quotes, source attribution, corrections, risk/safety/legal/financial implications, and cause-effect analysis; accelerate teasers, repeated headlines, banter, and coming-up segments.",
    "- Music/reaction: protect lyrics, performances, rhythm-dependent sections, reactions, and critique; accelerate only non-music intros, outros, sponsors, CTAs, and unrelated talking.",
    "- Sponsor reads: explicit ads, affiliate pitches, coupon codes, merch, newsletters, like/subscribe, and platform promos are low importance and usually speedTier=max unless mixed with real content.",
    "",
    "Confidence policy: use confidence >= 0.80 only for obvious section types. If evidence is mixed or confidence < 0.60, choose high/medium importance and at most speedTier=slight.",
    "Reasons must be short and specific, e.g. Core coding step, Sponsor read, News fact, Music performance, Repeated recap.",
    "Global output policy: set videoType to the dominant format, viewerTask to the likely reason someone is watching, and planStrategy to one short sentence explaining the speed policy for this specific video.",
    modeGuidance,
    "Return exactly one JSON object with this shape and no extra keys: {\"videoType\":\"tutorial_lecture\",\"viewerTask\":\"learn\",\"planStrategy\":\"Protect steps and examples; accelerate repeated framing and CTAs.\",\"items\":[{\"id\":0,\"speedTier\":\"base\",\"importance\":\"high\",\"role\":\"core\",\"evidence\":\"concept\",\"confidence\":0.7,\"reason\":\"Core idea\"}]}",
    "Include every input chunk id exactly once, in input order. No markdown, no prose.",
    `target_rate=${targetRate}; default_rate=${targetRate}; max_rate=${maxRate}; speed_mode=${speedMode}`
  ].join("\n");

  const user = JSON.stringify({
    context_version: PROMPT_VERSION,
    video: {
      id: payload.videoId || "",
      title: payload.title || "",
      duration: Number(payload.duration) || 0,
      language: payload.language || "",
      chunk_count: chunks.length,
      metadata: sanitizePromptMetadata(payload.metadata || {}),
      caption_track: sanitizePromptCaptionTrack(payload.captionTrack || {}),
      entry: sanitizePromptEntry(payload.entry || {})
    },
    viewer_intent: payload.intent || {},
    custom_prompt: customPrompt,
    policy: {
      target_rate: targetRate,
      max_rate: maxRate,
      speed_mode: speedMode,
      tier_rates: speedTierRates(settings),
      target_chunk_seconds: analysisChunkTargetSeconds(Number(payload.duration) || 0),
      typical_region_chunks: "1-4",
      avoid_uniform_runs_over_chunks: 5,
      video_types: VIDEO_TYPES,
      viewer_tasks: VIEWER_TASKS,
      roles: PLAN_ROLES,
      evidence_types: EVIDENCE_TYPES,
      speed_tiers: SPEED_TIERS
    },
    ...(outline ? { outline } : {}),
    chunks: promptChunks
  });

  return { system, user };
}

function buildPromptChunks(chunks, duration, chunkIntent = []) {
  const includeNeighbors = chunks.length <= 250;
  const intentById = new Map(chunkIntent.map((item) => [item.id, item]));
  return chunks.map((chunk, index) => {
    const intent = intentById.get(chunk.id) || {};
    const item = {
      id: chunk.id,
      i: index,
      start: round(chunk.start, 2),
      end: round(chunk.end, 2),
      dur: round(chunk.end - chunk.start, 1),
      pos: duration ? Math.round((chunk.start / duration) * 100) : 0,
      phase: chunkPhase(chunk, duration),
      rel: round(intent.rel ?? 0.35, 2),
      novelty: round(intent.novelty ?? 0.5, 2),
      hints: Array.isArray(intent.hints) ? intent.hints.slice(0, 3) : [],
      text: trimChunkText(chunk.text, 900)
    };
    if (chunks.length > 250) item.section = Math.floor(index / 10);
    if (includeNeighbors) {
      item.prev = summarizeChunkText(chunks[index - 1]?.text, 72);
      item.next = summarizeChunkText(chunks[index + 1]?.text, 72);
    }
    return item;
  });
}

function buildPromptOutline(chunks) {
  const out = [];
  for (let index = 0; index < chunks.length; index += 10) {
    const group = chunks.slice(index, index + 10);
    out.push({
      section: out.length,
      start: round(group[0].start, 1),
      end: round(group[group.length - 1].end, 1),
      summary: summarizeChunkText(group.map((chunk) => chunk.text).join(" "), 180)
    });
  }
  return out;
}

function chunkPhase(chunk, duration) {
  if (!duration) return "body";
  const pos = chunk.start / duration;
  if (pos < 0.08) return "intro";
  if (pos > 0.92) return "outro";
  return "body";
}

function deriveViewerIntent(payload, chunks, settings) {
  const metadata = sanitizePromptMetadata(payload.metadata || {});
  const entry = sanitizePromptEntry(payload.entry || {});
  const payloadGoalMode = VIEWER_GOAL_MODES.includes(payload.viewerGoalMode) ? payload.viewerGoalMode : "";
  const goalMode = payloadGoalMode || settings.viewerGoalMode || "auto";
  const goalText = sanitizeGoalText(payload.viewerGoalText ?? settings.viewerGoalText);
  const customPrompt = sanitizeCustomPrompt(payload.customPrompt ?? settings.customPrompt);
  const title = payload.title || metadata.title || "";
  const introText = chunks
    .slice(0, 12)
    .filter((chunk) => !hasLowValueIntentSignal(chunk.text))
    .map((chunk) => chunk.text)
    .join(" ");
  const signalText = [
    goalText,
    customPrompt,
    entry.searchQuery,
    title,
    metadata.channel,
    metadata.category,
    ...(metadata.keywords || []),
    ...(metadata.chapters || []).slice(0, 12).map((chapter) => chapter.title),
    introText
  ].join(" ");
  const keywords = topTerms(signalText, 14);
  const intentType = goalMode !== "auto" ? mapGoalModeToIntent(goalMode) : inferIntentType(signalText, metadata);
  const confidence = clamp(
      (goalText ? 0.32 : 0) +
      (customPrompt ? 0.12 : 0) +
      (goalMode !== "auto" ? 0.28 : 0) +
      (entry.searchQuery ? 0.2 : 0) +
      (title ? 0.16 : 0) +
      ((metadata.keywords || []).length ? 0.08 : 0) +
      ((metadata.chapters || []).length ? 0.08 : 0),
    0.28,
    0.95
  );
  const source = [
    goalText ? "user_goal" : "",
    customPrompt ? "custom_prompt" : "",
    goalMode !== "auto" ? "goal_mode" : "",
    entry.searchQuery ? "search_query" : "",
    title ? "title" : "",
    metadata.channel ? "metadata" : "",
    chunks.length ? "transcript_intro" : ""
  ].filter(Boolean).join("_");
  return {
    version: INTENT_VERSION,
    type: intentType,
    summary: summarizeIntent(intentType, goalText || customPrompt || entry.searchQuery || title, keywords),
    goalMode,
    goalText,
    keywords,
    protectedTopics: protectedTopicsForIntent(intentType, keywords),
    lowValueTopics: ["intro", "sponsor", "subscribe", "recap", "outro", "housekeeping", "promo"].slice(0, 8),
    confidence: round(confidence, 2),
    source: source || "unknown"
  };
}

function scoreChunkIntentRelevance(chunks, intent, payload) {
  const keywordSet = new Set((intent.keywords || []).map(normalizeToken).filter(Boolean));
  const seenTexts = [];
  return chunks.map((chunk) => {
    const text = chunk.text || "";
    const tokens = tokenize(text);
    const unique = new Set(tokens);
    const overlapCount = [...unique].filter((token) => keywordSet.has(token)).length;
    const overlap = keywordSet.size ? overlapCount / Math.min(keywordSet.size, 8) : 0;
    const hints = detectChunkHints(text, intent.type, overlapCount);
    const novelty = calculateNovelty(tokens, seenTexts);
    seenTexts.push(tokens);
    if (seenTexts.length > 12) seenTexts.shift();
    let rel = 0.26 + overlap * 0.52 + novelty * 0.12;
    if (hints.includes("direct_keyword")) rel += 0.14;
    if (hints.includes("procedure") && intent.type === "follow_steps") rel += 0.24;
    if (hints.includes("answer_marker") && intent.type === "find_answer") rel += 0.2;
    if (hints.includes("claim") && intent.type === "evaluate_claims") rel += 0.2;
    if (hints.includes("news_fact") && intent.type === "track_news") rel += 0.18;
    if (hints.includes("performance") && intent.type === "enjoy_performance") rel += 0.22;
    if (hints.includes("conclusion") && ["learn", "evaluate_claims", "find_answer"].includes(intent.type)) rel += 0.18;
    if (hints.includes("sponsor") || hints.includes("cta")) rel -= 0.28;
    if (hints.includes("recap") && overlapCount === 0) rel -= 0.14;
    if (hints.includes("filler")) rel -= 0.18;
    if (chunkPhase(chunk, Number(payload.duration) || 0) === "intro" && overlapCount === 0) rel -= 0.08;
    if (chunkPhase(chunk, Number(payload.duration) || 0) === "outro" && !hints.includes("conclusion")) rel -= 0.12;
    return {
      id: chunk.id,
      rel: round(clamp(rel, 0, 1), 2),
      novelty: round(novelty, 2),
      hints: hints.slice(0, 4)
    };
  });
}

function detectChunkHints(text, intentType, overlapCount) {
  const hints = [];
  const lower = String(text || "").toLowerCase();
  const sponsorLike = /(sponsor|sponsored|promo code|coupon|affiliate|discount|merch|newsletter|indirim|sponsor|kupon)/i.test(lower);
  const ctaLike = /(subscribe|like and subscribe|notification bell|follow me|join|abone|beğen|begeni|takip)/i.test(lower);
  if (overlapCount > 0) hints.push("direct_keyword");
  if (
    /(step|first|second|third|install|configure|setup|command|run|copy|paste|terminal|code|file|error|debug|fix|adım|kur|ayar|komut|hata)/i.test(
      lower
    ) &&
    !(sponsorLike && /(promo code|discount code|coupon|kupon)/i.test(lower))
  ) {
    hints.push("procedure");
  }
  if (/(because|why|answer|the reason|in short|basically|çünkü|cevap|sebep|özetle)/i.test(lower)) hints.push("answer_marker");
  if (/(claim|evidence|source|study|data|number|percent|risk|tradeoff|compare|versus|vs|kanıt|kaynak|veri|risk|karşılaştır)/i.test(lower)) hints.push("claim");
  if (/(today|breaking|reported|date|minister|company|market|release|announced|bugün|son dakika|açıkladı|tarih)/i.test(lower)) hints.push("news_fact");
  if (/(song|lyrics|chorus|verse|beat|performance|reaction|music|şarkı|sözleri|performans|müzik)/i.test(lower)) hints.push("performance");
  if (/(conclusion|finally|takeaway|result|so the point|sonuç|çıkarım|özet)/i.test(lower)) hints.push("conclusion");
  if (sponsorLike) hints.push("sponsor");
  if (ctaLike) hints.push("cta");
  if (/(as i said|again|recap|previously|tekrar|az önce|dediğim gibi|özet)/i.test(lower)) hints.push("recap");
  if (/(uh|um|you know|sort of|kind of|anyway|neyse|yani|şey)/i.test(lower) && text.length < 180) hints.push("filler");
  if (intentType === "skim" && hints.length === 0) hints.push("skim_context");
  return [...new Set(hints)];
}

function calculateNovelty(tokens, previousTokenLists) {
  if (!tokens.length || !previousTokenLists.length) return 1;
  const current = new Set(tokens);
  let maxOverlap = 0;
  for (const previous of previousTokenLists) {
    const prevSet = new Set(previous);
    const overlap = [...current].filter((token) => prevSet.has(token)).length;
    maxOverlap = Math.max(maxOverlap, overlap / Math.max(1, Math.min(current.size, prevSet.size)));
  }
  return clamp(1 - maxOverlap, 0, 1);
}

function hasLowValueIntentSignal(text) {
  return /(sponsor|sponsored|promo code|discount code|coupon|affiliate|discount|merch|newsletter|subscribe|like and subscribe|notification bell|welcome back|before we start|thanks for watching|indirim|kupon|abone|beğen|begeni|takip)/i.test(
    String(text || "")
  );
}

function mapGoalModeToIntent(mode) {
  if (mode === "find_answer") return "skim";
  if (mode === "follow_steps") return "follow_steps";
  if (mode === "evaluate_claims") return "evaluate_claims";
  if (mode === "enjoy") return "enjoy_performance";
  if (mode === "skim") return "skim";
  return "learn";
}

function inferIntentType(text, metadata) {
  text = String(text || "").toLowerCase();
  if (/(how to|tutorial|setup|install|configure|build|fix|debug|course|lesson|guide|nasıl|kurulum|ders|rehber|hata)/i.test(text)) return "follow_steps";
  if (/(review|versus|vs|compare|comparison|truth|claim|analysis|kanıt|inceleme|karşılaştır)/i.test(text)) return "evaluate_claims";
  if (/(news|breaking|today|market|election|son dakika|haber|gündem)/i.test(text) || /news/i.test(metadata.category || "")) return "track_news";
  if (/(song|music|reaction|lyrics|performance|şarkı|müzik|tepki)/i.test(text) || /music/i.test(metadata.category || "")) return "enjoy_performance";
  if (/(story|vlog|interview|podcast|documentary|hikaye|röportaj)/i.test(text)) return "understand_story";
  if (/(answer|quick|summary|tldr|explained|cevap|özet)/i.test(text)) return "skim";
  return "learn";
}

function summarizeIntent(type, sourceText, keywords) {
  const cleaned = String(sourceText || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (cleaned) return `${type}: ${cleaned}`;
  if (keywords?.length) return `${type}: ${keywords.slice(0, 6).join(", ")}`;
  return `${type}: infer from video context`;
}

function protectedTopicsForIntent(type, keywords) {
  const base = keywords.slice(0, 8);
  const extras = {
    follow_steps: ["steps", "commands", "errors", "warnings", "configuration"],
    evaluate_claims: ["claims", "evidence", "numbers", "tradeoffs", "sources"],
    track_news: ["facts", "dates", "names", "consequences", "corrections"],
    enjoy_performance: ["performance", "reaction", "lyrics", "critique"],
    skim: ["answer", "summary", "conclusion"],
    learn: ["concepts", "examples", "takeaways"]
  }[type] || ["concepts", "takeaways"];
  return [...new Set([...base, ...extras])].slice(0, 12);
}

function topTerms(text, limit) {
  const counts = new Map();
  for (const token of tokenize(text)) counts.set(token, (counts.get(token) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([token]) => token)
    .filter((token) => token.length > 2 && !LOW_VALUE_TERMS.has(token))
    .slice(0, limit);
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9çğıöşü_-]+/i)
    .map(normalizeToken)
    .filter((token) => token && !STOP_WORDS.has(token) && token.length > 1);
}

function normalizeToken(token) {
  return String(token || "").toLowerCase().replace(/^_+|_+$/g, "").trim();
}

function sanitizeGoalText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 180);
}

function sanitizeCustomPrompt(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 700);
}

const STOP_WORDS = new Set(
  "the a an and or to of in on for with from by this that these those is are was were be been being i you he she it we they me my your his her their our as at but if then so just not no yes do does did can could should would will about into over under after before very more most less like video today now here there what why how when where kim ne neden nasil nasıl niye bu su şu ve veya icin için ile bir de da mi mı mu mü ama yani gibi olan olarak".split(
    /\s+/
  )
);

const LOW_VALUE_TERMS = new Set(
  "subscribe subscription subscribed like likes sponsored sponsor promo coupon affiliate discount merch newsletter bell follow intro outro recap welcome cloudbox indirim kupon sponsor abone begen beğen takip".split(
    /\s+/
  )
);

function sanitizePromptMetadata(metadata) {
  return {
    title: trimChunkText(metadata.title || "", 180),
    channel: trimChunkText(metadata.channel || "", 120),
    channelId: trimChunkText(metadata.channelId || "", 80),
    category: trimChunkText(metadata.category || "", 80),
    publishDate: trimChunkText(metadata.publishDate || "", 24),
    uploadDate: trimChunkText(metadata.uploadDate || "", 24),
    isLive: Boolean(metadata.isLive),
    keywords: Array.isArray(metadata.keywords) ? metadata.keywords.map((item) => trimChunkText(item, 48)).filter(Boolean).slice(0, 16) : [],
    descriptionExcerpt: trimChunkText(metadata.descriptionExcerpt || "", 700),
    descriptionSignals: sanitizeDescriptionSignals(metadata.descriptionSignals || {}),
    chapters: Array.isArray(metadata.chapters)
      ? metadata.chapters
          .map((chapter) => ({
            start: round(Number(chapter.start) || 0, 1),
            title: trimChunkText(chapter.title || "", 80),
            source: trimChunkText(chapter.source || "", 20)
          }))
          .filter((chapter) => chapter.title)
          .slice(0, 32)
      : []
  };
}

function sanitizeDescriptionSignals(signals) {
  return {
    timestampLines: Array.isArray(signals.timestampLines) ? signals.timestampLines.map((line) => trimChunkText(line, 140)).slice(0, 20) : [],
    sponsorMarkers: Array.isArray(signals.sponsorMarkers) ? signals.sponsorMarkers.map((line) => trimChunkText(line, 140)).slice(0, 8) : [],
    hasRepoLink: Boolean(signals.hasRepoLink),
    hasSourceLinks: Boolean(signals.hasSourceLinks)
  };
}

function sanitizePromptCaptionTrack(track) {
  return {
    source: trimChunkText(track.source || "", 24),
    format: trimChunkText(track.format || "", 12),
    language: trimChunkText(track.language || "", 24),
    vssId: trimChunkText(track.vssId || "", 40),
    kind: trimChunkText(track.kind || "", 16),
    name: trimChunkText(track.name || "", 80),
    isTranslatable: Boolean(track.isTranslatable)
  };
}

function sanitizePromptEntry(entry) {
  return {
    list: trimChunkText(entry.list || "", 80),
    index: trimChunkText(entry.index || "", 12),
    startSeconds: Math.max(0, Number(entry.startSeconds) || 0),
    searchQuery: trimChunkText(entry.searchQuery || "", 160)
  };
}

function parsePlanObject(data) {
  if (Array.isArray(data?.items) || Array.isArray(data?.segments) || Array.isArray(data)) {
    return normalizePlanObject(data);
  }
  if (typeof data?.output_text === "string") return normalizePlanObject(parseJsonPlanText(data.output_text));

  const output = data?.output || [];
  const text = [];
  for (const item of output) {
    for (const part of item?.content || []) {
      if (part?.text) text.push(part.text);
      if (part?.type === "output_text" && part?.text) text.push(part.text);
    }
  }
  return normalizePlanObject(parseJsonPlanText(text.join("\n")));
}

function parsePlanItems(data) {
  return parsePlanObject(data).items;
}

function normalizePlanObject(data) {
  if (Array.isArray(data)) data = { items: data };
  if (!data || typeof data !== "object") return { items: [] };
  return {
    videoType: VIDEO_TYPES.includes(data.videoType) ? data.videoType : "",
    viewerTask: VIEWER_TASKS.includes(data.viewerTask) ? data.viewerTask : "",
    planStrategy: String(data.planStrategy || "").replace(/\s+/g, " ").trim().slice(0, 220),
    items: Array.isArray(data.items) ? data.items : Array.isArray(data.segments) ? data.segments : []
  };
}

function parseTextResponse(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  const text = [];
  for (const item of data?.output || []) {
    for (const part of item?.content || []) {
      if (part?.text) text.push(part.text);
      if (part?.type === "output_text" && part?.text) text.push(part.text);
    }
  }
  return text.join("\n");
}

function normalizeTestMessage(message) {
  const cleaned = String(message || "").replace(/\s+/g, " ").trim();
  if (!cleaned) throw new Error("Provider responded, but returned empty text.");
  return cleaned.slice(0, 240);
}

function parseSseOutputText(text) {
  const items = parseSseOutputItems(text);
  const direct = [];
  for (const item of items) {
    for (const part of item?.content || []) {
      if (part?.type === "output_text" && part?.text) direct.push(part.text);
      else if (part?.text) direct.push(part.text);
    }
  }
  if (direct.length) return direct.join("\n");

  const deltas = [];
  for (const event of parseSseEvents(text)) {
    if (event.type === "response.output_text.done" && event.text) return event.text;
    if (event.type === "response.output_text.delta" && event.delta) deltas.push(event.delta);
  }
  return deltas.join("");
}

function parseSseOutputItems(text) {
  const completed = [...parseSseEvents(text)].reverse().find((event) => event.type === "response.completed");
  if (completed?.response?.output) return completed.response.output;

  const items = [];
  for (const event of parseSseEvents(text)) {
    if (event.type === "response.output_item.done" && event.item) items.push(event.item);
  }
  return items;
}

function parseSseEvents(text) {
  const events = [];
  for (const block of String(text || "").split(/\n\n+/)) {
    const dataLines = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());
    if (!dataLines.length) continue;
    const data = dataLines.join("\n");
    if (!data || data === "[DONE]") continue;
    try {
      events.push(JSON.parse(data));
    } catch {
      // Ignore partial or non-JSON SSE frames.
    }
  }
  return events;
}

function parseJsonPlanText(text) {
  const cleaned = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  if (!cleaned) return { items: [] };
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Model returned non-JSON output.");
  }
}

function makeHeuristicItems(chunks, settings, chunkIntent = []) {
  const maxRate = Number(settings.maxRate) || 1.75;
  const mode = normalizeSpeedMode(settings.speedMode || legacySpeedMode(settings.aggressiveness));
  const aggression = mode === "aggressive" ? 1 : mode === "calm" ? -1 : 0;
  const intentById = new Map(chunkIntent.map((item) => [item.id, item]));

  return chunks.map((chunk) => {
    const text = chunk.text.toLowerCase();
    const intent = intentById.get(chunk.id) || {};
    let score = 0;
    const lowValueMatch =
      /(sponsor|sponsored|promo code|discount|subscribe|like and subscribe|smash|notification bell|intro|outro|welcome back|before we start|abone|begeni|beğeni|sponsor|indirim|kanala)/i.test(
        text
      );
    if (lowValueMatch) score -= 4;
    if (/(again|as i said|basically|you know|sort of|kind of|anyway|tekrar|az once|yani|aslinda|aslında|neyse)/i.test(text)) score -= 1;
    if (
      !lowValueMatch &&
      /(important|key point|the point is|because|therefore|result|conclusion|warning|mistake|error|step|first|second|finally|definition|example|demo|code|formula|proof|onemli|önemli|dikkat|sonuc|sonuç|cunku|çünkü|hata|adim|adım|ornek|örnek)/i.test(
        text
      )
    ) {
      score += 3;
    }
    if (/[0-9]{2,}|[$%]/.test(text)) score += 1;
    if ((intent.rel || 0) >= 0.72) score += 3;
    else if ((intent.rel || 0) <= 0.25) score -= 2;
    score += aggression;

    let speed = 1.25;
    let importance = "medium";
    let confidence = 0.54;
    if (score >= 3) {
      speed = 1;
      importance = "high";
      confidence = 0.68;
    } else if (score <= -3) {
      speed = maxRate;
      importance = "low";
      confidence = 0.72;
    } else if (score <= -1) {
      speed = Math.min(maxRate, 1.5);
      importance = "low";
      confidence = 0.6;
    }
    return {
      id: chunk.id,
      speed,
      speedTier: tierFromSpeed(speed, settings),
      importance,
      role: importance === "high" ? "core" : importance === "low" ? "filler" : "setup",
      evidence: importance === "high" ? "concept" : importance === "low" ? "filler" : "normal",
      confidence,
      reason: "Local heuristic"
    };
  });
}

function normalizeSpeedPlan(chunks, items, duration, settings, chunkIntent = []) {
  const defaultRate = Number(settings.targetRate || settings.defaultRate) || 1;
  const byId = new Map(items.map((item) => [Number(item.id), item]));
  const intentById = new Map(chunkIntent.map((item) => [item.id, item]));
  const raw = chunks.map((chunk) => {
    const item = byId.get(chunk.id);
    if (!item) {
      return {
        start: chunk.start,
        end: chunk.end,
        speed: defaultRate,
        speedTier: "base",
        importance: "high",
        role: "uncertain",
        evidence: "uncertain",
        confidence: 0.4,
        reason: "Missing model item"
      };
    }
    const normalized = normalizePlanItem(item, settings, intentById.get(chunk.id));
    return {
      start: chunk.start,
      end: chunk.end,
      ...normalized
    };
  });
  const withGaps = fillGaps(raw, duration, defaultRate);
  const smoothingSeconds = Math.min(Number(settings.minSegmentSeconds) || 4, 5);
  const smoothed = smoothSpeedIslands(withGaps, smoothingSeconds, settings);
  const limited = limitSpeedStepChanges(smoothed, settings);
  return mergeAdjacent(limited).map((item) => ({
    ...item,
    start: round(item.start, 2),
    end: round(item.end, 2),
    speed: round(item.speed, 2),
    confidence: round(item.confidence, 2)
  }));
}

function normalizePlanItem(item, settings, intentScore) {
  const importance = ["low", "medium", "high"].includes(item.importance) ? item.importance : "medium";
  const role = PLAN_ROLES.includes(item.role) ? item.role : "uncertain";
  const evidence = EVIDENCE_TYPES.includes(item.evidence) ? item.evidence : "uncertain";
  const confidence = clamp(Number(item.confidence) || 0.5, 0, 1);
  const rawTier = SPEED_TIERS.includes(item.speedTier) ? item.speedTier : tierFromSpeed(item.speed, settings);
  const guardedTier = applyPlanGuardrails(rawTier, { importance, role, evidence, confidence });
  const speedTier = applyIntentGuardrails(guardedTier, { importance, role, evidence, confidence }, intentScore);
  return {
    speed: speedForTier(speedTier, settings),
    speedTier,
    importance,
    role,
    evidence,
    confidence,
    reason: String(item.reason || `${role} ${evidence}`).replace(/\s+/g, " ").trim().slice(0, 140)
  };
}

function applyPlanGuardrails(tier, item) {
  const protectedEvidence = ["concept", "procedure", "example", "warning", "conclusion", "music"].includes(item.evidence);
  const acceleratableEvidence = ["recap", "repetition", "filler", "sponsor_cta", "off_topic"].includes(item.evidence);

  if (item.importance === "high") return "base";
  if (item.evidence === "music" && item.importance !== "low") return "base";
  if ((PROTECTED_ROLES.has(item.role) || protectedEvidence) && !acceleratableEvidence) {
    if (item.importance === "medium" && item.confidence >= 0.65) return tier === "base" ? "base" : "slight";
    return item.importance === "low" && item.confidence >= 0.85 ? "slight" : "base";
  }
  if (item.confidence < 0.55) return item.importance === "low" ? "slight" : "base";
  if (item.confidence < 0.65 && ["fast", "max"].includes(tier)) return item.importance === "low" ? "medium" : "slight";
  if (item.importance === "medium" && tier === "max") return item.confidence >= 0.85 ? "fast" : "medium";
  if (tier === "max" && !(ACCELERATABLE_ROLES.has(item.role) || acceleratableEvidence) && item.confidence < 0.85) return "fast";
  return tier;
}

function applyIntentGuardrails(tier, item, intentScore) {
  if (!intentScore) return tier;
  const rel = Number(intentScore.rel);
  if (!Number.isFinite(rel)) return tier;
  const acceleratable = ACCELERATABLE_ROLES.has(item.role) || ["recap", "repetition", "filler", "sponsor_cta", "off_topic"].includes(item.evidence);
  const protectedSignal =
    PROTECTED_ROLES.has(item.role) || ["concept", "procedure", "example", "warning", "conclusion", "music"].includes(item.evidence);

  const clearLowValue =
    ["sponsor", "filler", "recap", "outro"].includes(item.role) ||
    ["recap", "repetition", "filler", "sponsor_cta", "off_topic"].includes(item.evidence);

  if (rel >= 0.78 && !clearLowValue) return "base";
  if (rel >= 0.62 && !clearLowValue) return tierRank(tier) > tierRank("slight") ? "slight" : tier;
  if (rel >= 0.5 && protectedSignal) return tierRank(tier) > tierRank("slight") ? "slight" : tier;
  if (rel <= 0.24 && (acceleratable || clearLowValue) && item.confidence >= 0.6) return tierRank(tier) < tierRank("fast") ? "fast" : tier;
  if (rel <= 0.18 && item.evidence === "sponsor_cta" && item.confidence >= 0.72) return "max";
  return tier;
}

function tierRank(tier) {
  return SPEED_TIERS.indexOf(tier);
}

function tierFromSpeed(speed, settings) {
  const allowed = allowedRates(settings);
  const value = Number(speed);
  if (!Number.isFinite(value)) return "base";
  const index = allowed.reduce((best, rate, current) => (Math.abs(rate - value) < Math.abs(allowed[best] - value) ? current : best), 0);
  if (index <= 0) return "base";
  if (index >= allowed.length - 1) return "max";
  if (index === 1) return "slight";
  if (index === 2) return "medium";
  return "fast";
}

function speedForTier(tier, settings) {
  const allowed = allowedRates(settings);
  if (!allowed.length) return snapRate(settings.targetRate || settings.defaultRate || 1, 1, 4);
  const mode = normalizeSpeedMode(settings.speedMode || legacySpeedMode(settings.aggressiveness));
  const tierIndexes = {
    calm: { base: 0, slight: 1, medium: 1, fast: 2, max: allowed.length - 1 },
    reasonable: { base: 0, slight: 1, medium: 2, fast: 3, max: allowed.length - 1 },
    aggressive: { base: 0, slight: 1, medium: 3, fast: 4, max: allowed.length - 1 }
  }[mode];
  const index = Math.min(allowed.length - 1, tierIndexes[tier] ?? 0);
  return allowed[index];
}

function speedTierRates(settings) {
  return Object.fromEntries(SPEED_TIERS.map((tier) => [tier, speedForTier(tier, settings)]));
}

function allowedRates(settings) {
  const defaultRate = snapRate(settings.targetRate || settings.defaultRate || 1, 1, 4);
  const maxRate = Math.max(defaultRate, snapRate(settings.maxRate || 1.75, 1, 4));
  return [...new Set([defaultRate, maxRate, ...RATE_STEPS])]
    .filter((rate) => rate >= defaultRate - 0.001 && rate <= maxRate + 0.001)
    .sort((a, b) => a - b);
}

function fillGaps(plan, duration, defaultRate) {
  const out = [];
  let cursor = 0;
  for (const item of plan.sort((a, b) => a.start - b.start)) {
    if (item.start > cursor + 0.4) {
      out.push({
        start: cursor,
        end: item.start,
        speed: defaultRate,
        speedTier: "base",
        importance: "high",
        role: "uncertain",
        evidence: "uncertain",
        confidence: 1,
        reason: "Gap"
      });
    }
    out.push(item);
    cursor = Math.max(cursor, item.end);
  }
  if (duration && cursor < duration - 0.4) {
    out.push({
      start: cursor,
      end: duration,
      speed: defaultRate,
      speedTier: "base",
      importance: "high",
      role: "uncertain",
      evidence: "uncertain",
      confidence: 1,
      reason: "Tail"
    });
  }
  return out.filter((item) => item.end > item.start);
}

function smoothSpeedIslands(plan, minSeconds, settings) {
  return plan.map((item, index) => {
    const prev = plan[index - 1];
    const next = plan[index + 1];
    const duration = item.end - item.start;
    if (
      prev &&
      next &&
      prev.speed === next.speed &&
      duration <= minSeconds &&
      !isClearAcceleration(item) &&
      !isClearProtection(item)
    ) {
      return { ...item, speed: prev.speed, speedTier: tierFromSpeed(prev.speed, settings), reason: item.reason || "Smoothed island" };
    }
    if (
      prev &&
      next &&
      item.speed > prev.speed &&
      item.speed > next.speed &&
      duration <= minSeconds &&
      !isClearAcceleration(item) &&
      !isClearProtection(item)
    ) {
      const reduced = Math.max(prev.speed, next.speed);
      return { ...item, speed: reduced, speedTier: tierFromSpeed(reduced, settings), reason: item.reason || "Reduced speed spike" };
    }
    if (item.confidence < 0.62 && item.speedTier && ["fast", "max"].includes(item.speedTier) && !isClearAcceleration(item)) {
      const speed = speedForTier("slight", settings);
      return { ...item, speed, speedTier: "slight" };
    }
    return item;
  });
}

function limitSpeedStepChanges(plan, settings) {
  const allowed = allowedRates(settings);
  return plan.map((item, index) => {
    const prev = plan[index - 1];
    if (!prev || isClearAcceleration(item)) return item;
    const prevIndex = nearestRateIndex(prev.speed, allowed);
    const itemIndex = nearestRateIndex(item.speed, allowed);
    if (itemIndex - prevIndex <= 2) return item;
    const speed = allowed[Math.min(allowed.length - 1, prevIndex + 2)];
    return { ...item, speed, speedTier: tierFromSpeed(speed, settings) };
  });
}

function nearestRateIndex(speed, allowed) {
  return allowed.reduce((best, rate, index) => (Math.abs(rate - speed) < Math.abs(allowed[best] - speed) ? index : best), 0);
}

function isClearAcceleration(item) {
  return (
    item.confidence >= 0.74 &&
    (ACCELERATABLE_ROLES.has(item.role) ||
      ["recap", "repetition", "filler", "sponsor_cta", "off_topic"].includes(item.evidence))
  );
}

function isClearProtection(item) {
  return (
    item.importance === "high" ||
    PROTECTED_ROLES.has(item.role) ||
    ["concept", "procedure", "example", "warning", "conclusion", "music"].includes(item.evidence)
  );
}

function mergeAdjacent(plan) {
  const merged = [];
  for (const item of plan) {
    const last = merged[merged.length - 1];
    if (last && canMergeSegments(last, item)) {
      last.end = item.end;
      last.importance = stricterImportance(last.importance, item.importance);
      last.confidence = Math.min(last.confidence, item.confidence);
      if (last.role !== item.role && item.importance === "high") last.role = item.role;
      if (last.evidence !== item.evidence && item.confidence > last.confidence) last.evidence = item.evidence;
      if (!last.reason && item.reason) last.reason = item.reason;
    } else {
      merged.push({ ...item });
    }
  }
  return merged;
}

function canMergeSegments(last, item) {
  const combinedDuration = item.end - last.start;
  return (
    Math.abs(last.end - item.start) < 0.75 &&
    last.speed === item.speed &&
    last.speedTier === item.speedTier &&
    last.importance === item.importance &&
    last.role === item.role &&
    last.evidence === item.evidence &&
    combinedDuration <= 45
  );
}

function stricterImportance(a, b) {
  const rank = { low: 0, medium: 1, high: 2 };
  return (rank[b] || 0) > (rank[a] || 0) ? b : a;
}

function snapSpeed(value, settings) {
  const allowed = allowedRates(settings);
  const defaultRate = allowed[0] || snapRate(settings.targetRate || settings.defaultRate || 1, 1, 4);
  const maxRate = allowed[allowed.length - 1] || defaultRate;
  const numeric = clamp(Number(value) || defaultRate, defaultRate, maxRate);
  return allowed.reduce((best, rate) => (Math.abs(rate - numeric) < Math.abs(best - numeric) ? rate : best), allowed[0]);
}

function snapRate(value, min, max) {
  const numeric = clamp(Number(value) || min, min, max);
  return RATE_STEPS.reduce((best, rate) => {
    if (rate < min - 0.001 || rate > max + 0.001) return best;
    return Math.abs(rate - numeric) < Math.abs(best - numeric) ? rate : best;
  }, min);
}

async function getPlanCache() {
  const data = await chrome.storage.local.get(PLAN_CACHE_KEY);
  return data[PLAN_CACHE_KEY] || {};
}

async function trimAndSavePlanCache(cache) {
  const entries = Object.entries(cache);
  const trimmed = Object.fromEntries(entries.slice(Math.max(0, entries.length - 80)));
  await chrome.storage.local.set({ [PLAN_CACHE_KEY]: trimmed });
}

async function buildCacheKey(payload, chunks, settings) {
  const sample = chunks.map((chunk) => `${chunk.start}:${chunk.end}:${chunk.text.slice(0, 80)}`).join("|");
  const raw = JSON.stringify({
    promptVersion: PROMPT_VERSION,
    intentVersion: INTENT_VERSION,
    videoId: payload.videoId,
    language: payload.language,
    title: String(payload.title || "").slice(0, 160),
    duration: Number(payload.duration) || 0,
    viewerGoalMode: VIEWER_GOAL_MODES.includes(payload.viewerGoalMode) ? payload.viewerGoalMode : settings.viewerGoalMode,
    viewerGoalText: sanitizeGoalText(payload.viewerGoalText ?? settings.viewerGoalText),
    customPrompt: sanitizeCustomPrompt(payload.customPrompt ?? settings.customPrompt),
    intentType: payload.intent?.type || "",
    intentSummary: payload.intent?.summary || "",
    intentConfidence: Math.round((Number(payload.intent?.confidence) || 0) * 10) / 10,
    channelId: payload.metadata?.channelId || "",
    category: payload.metadata?.category || "",
    publishDate: payload.metadata?.publishDate || "",
    metadataHash: await sha256(
      JSON.stringify({
        keywords: payload.metadata?.keywords || [],
        chapters: (payload.metadata?.chapters || []).slice(0, 20),
        descriptionSignals: payload.metadata?.descriptionSignals || {},
        captionTrack: payload.captionTrack || {},
        entry: payload.entry || {}
      })
    ),
    provider: settings.provider,
    model: providerModel(settings),
    speedMode: settings.speedMode,
    targetRate: settings.targetRate || settings.defaultRate,
    maxRate: settings.maxRate,
    sample
  });
  return sha256(raw);
}

function providerModel(settings) {
  if (settings.provider === "openai") return settings.openaiModel;
  if (settings.provider === "openrouter") return settings.openrouterModel;
  if (settings.provider === "google") return settings.googleModel;
  if (settings.provider === "chatgpt") return settings.chatgptModel;
  return "heuristic";
}

async function startChatgptBrowserAuth() {
  const pkce = await generatePKCE();
  const state = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)).buffer);
  const authUrl = buildAuthorizeUrl(CODEX_BROWSER_REDIRECT, pkce, state);
  await storageSessionSet(OAUTH_PENDING_KEY, {
    pkce,
    state,
    createdAt: Date.now()
  });
  const tab = await chrome.tabs.create({ url: authUrl, active: true });
  return {
    method: "browser",
    tabId: tab.id,
    url: authUrl,
    redirect: CODEX_BROWSER_REDIRECT,
    note: "If Chrome does not capture the redirect, copy the final localhost URL and reconnect with the device flow."
  };
}

async function handleChatgptBrowserRedirect(url, tabId) {
  const pending = await storageSessionGet(OAUTH_PENDING_KEY);
  if (!pending) return;
  const parsed = new URL(url);
  const error = parsed.searchParams.get("error");
  const code = parsed.searchParams.get("code");
  const state = parsed.searchParams.get("state");

  if (error || !code || state !== pending.state) {
    await storageSessionRemove(OAUTH_PENDING_KEY);
    await chrome.tabs.update(tabId, { url: chrome.runtime.getURL("auth-failed.html") });
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(code, CODEX_BROWSER_REDIRECT, pending.pkce);
    await saveChatgptTokens(tokens);
    await storageSessionRemove(OAUTH_PENDING_KEY);
    await chrome.tabs.update(tabId, { url: chrome.runtime.getURL("auth-success.html") });
  } catch {
    await storageSessionRemove(OAUTH_PENDING_KEY);
    await chrome.tabs.update(tabId, { url: chrome.runtime.getURL("auth-failed.html") });
  }
}

async function startChatgptDeviceAuth() {
  const response = await fetchJson(`${OPENAI_ISSUER}/api/accounts/deviceauth/usercode`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ client_id: OPENAI_CLIENT_ID })
  });

  const pending = {
    device_auth_id: response.device_auth_id,
    user_code: response.user_code,
    interval: Math.max(parseInt(response.interval, 10) || 5, 1),
    createdAt: Date.now()
  };
  await storageSessionSet(DEVICE_PENDING_KEY, pending);
  return {
    method: "device",
    url: `${OPENAI_ISSUER}/codex/device`,
    userCode: pending.user_code,
    interval: pending.interval
  };
}

async function pollChatgptDeviceAuth() {
  const pending = await storageSessionGet(DEVICE_PENDING_KEY);
  if (!pending) throw new Error("No pending device auth session.");

  const response = await fetch(`${OPENAI_ISSUER}/api/accounts/deviceauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      device_auth_id: pending.device_auth_id,
      user_code: pending.user_code
    })
  });

  if (response.status === 403 || response.status === 404) {
    return { pending: true, interval: pending.interval, userCode: pending.user_code };
  }
  if (!response.ok) throw new Error(`Device auth polling failed: ${response.status}`);

  const data = await response.json();
  const tokenResponse = await fetchJson(`${OPENAI_ISSUER}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: data.authorization_code,
      redirect_uri: `${OPENAI_ISSUER}/deviceauth/callback`,
      client_id: OPENAI_CLIENT_ID,
      code_verifier: data.code_verifier
    }).toString()
  });

  await saveChatgptTokens(tokenResponse);
  await storageSessionRemove(DEVICE_PENDING_KEY);
  return { pending: false, connected: true, status: await getProviderStatus() };
}

function buildAuthorizeUrl(redirectUri, pkce, state) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: OPENAI_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "openid profile email offline_access",
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
    id_token_add_organizations: "true",
    codex_cli_simplified_flow: "true",
    state,
    originator: "adaptive-speed-ai"
  });
  return `${OPENAI_ISSUER}/oauth/authorize?${params.toString()}`;
}

async function exchangeCodeForTokens(code, redirectUri, pkce) {
  return fetchJson(`${OPENAI_ISSUER}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: OPENAI_CLIENT_ID,
      code_verifier: pkce.verifier
    }).toString()
  });
}

async function refreshChatgptAuth(auth) {
  const tokens = await fetchJson(`${OPENAI_ISSUER}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: auth.refresh,
      client_id: OPENAI_CLIENT_ID
    }).toString()
  });
  return saveChatgptTokens(tokens, auth.accountId);
}

async function saveChatgptTokens(tokens, fallbackAccountId = "") {
  const accountId = extractAccountId(tokens) || fallbackAccountId || "";
  const auth = {
    type: "oauth",
    refresh: tokens.refresh_token,
    access: tokens.access_token,
    expires: Date.now() + (tokens.expires_in || 3600) * 1000,
    accountId
  };
  await chrome.storage.local.set({ [CHATGPT_AUTH_KEY]: auth });
  return auth;
}

async function getChatgptAuth() {
  const data = await chrome.storage.local.get(CHATGPT_AUTH_KEY);
  return data[CHATGPT_AUTH_KEY] || null;
}

function extractAccountId(tokens) {
  const claims = parseJwtClaims(tokens.id_token) || parseJwtClaims(tokens.access_token) || {};
  return (
    claims.chatgpt_account_id ||
    claims?.["https://api.openai.com/auth"]?.chatgpt_account_id ||
    claims.organizations?.[0]?.id ||
    ""
  );
}

function parseJwtClaims(token) {
  if (!token || String(token).split(".").length !== 3) return null;
  try {
    return JSON.parse(atobUrl(String(token).split(".")[1]));
  } catch {
    return null;
  }
}

async function generatePKCE() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const verifier = Array.from(crypto.getRandomValues(new Uint8Array(64)))
    .map((byte) => chars[byte % chars.length])
    .join("");
  const challenge = base64UrlEncode(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return { verifier, challenge };
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    const detail = json?.error?.message || json?.error || text || response.statusText;
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }
  if (text.startsWith("event:") || text.includes("\ndata:")) {
    return { raw: text, output_text: parseSseOutputText(text), output: parseSseOutputItems(text) };
  }
  return json;
}

async function sha256(text) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return base64UrlEncode(hash);
}

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function atobUrl(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(padded);
}

async function storageSessionGet(key) {
  if (chrome.storage.session) {
    const data = await chrome.storage.session.get(key);
    return data[key];
  }
  const data = await chrome.storage.local.get(key);
  return data[key];
}

async function storageSessionSet(key, value) {
  if (chrome.storage.session) return chrome.storage.session.set({ [key]: value });
  return chrome.storage.local.set({ [key]: value });
}

async function storageSessionRemove(key) {
  if (chrome.storage.session) return chrome.storage.session.remove(key);
  return chrome.storage.local.remove(key);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
