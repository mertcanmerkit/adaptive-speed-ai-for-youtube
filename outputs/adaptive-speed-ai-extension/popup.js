const pageStatusEl = document.getElementById("pageStatus");
const providerStatusEl = document.getElementById("providerStatus");
const analyzeEl = document.getElementById("analyze");
const optionsEl = document.getElementById("options");
const messageEl = document.getElementById("message");
const plannedSavingsEl = document.getElementById("plannedSavings");
const videoSavedEl = document.getElementById("videoSaved");
const totalSavedEl = document.getElementById("totalSaved");
const providerSelectEl = document.getElementById("providerSelect");
const modelSelectEl = document.getElementById("modelSelect");
const speedModeEl = document.getElementById("speedMode");
const viewerGoalModeEl = document.getElementById("viewerGoalMode");
const viewerGoalTextEl = document.getElementById("viewerGoalText");
const customPromptEl = document.getElementById("customPrompt");
const targetRateEl = document.getElementById("targetRate");
const maxRateEl = document.getElementById("maxRate");

const RATE_OPTIONS = [1, 1.15, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5, 4];
const MODEL_OPTIONS = {
  heuristic: [{ value: "local", label: "Local heuristic" }],
  openai: [
    { value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
    { value: "gpt-4.1", label: "gpt-4.1" },
    { value: "gpt-4o-mini", label: "gpt-4o-mini" },
    { value: "gpt-4o", label: "gpt-4o" }
  ],
  openrouter: [
    { value: "openai/gpt-4.1-mini", label: "openai/gpt-4.1-mini" },
    { value: "openai/gpt-4.1", label: "openai/gpt-4.1" },
    { value: "google/gemini-2.0-flash-001", label: "google/gemini-2.0-flash-001" },
    { value: "anthropic/claude-3.5-sonnet", label: "anthropic/claude-3.5-sonnet" }
  ],
  google: [
    { value: "gemini-2.0-flash", label: "gemini-2.0-flash" },
    { value: "gemini-2.5-flash", label: "gemini-2.5-flash" },
    { value: "gemini-2.5-pro", label: "gemini-2.5-pro" }
  ],
  chatgpt: [
    { value: "gpt-5.4-mini", label: "gpt-5.4-mini" },
    { value: "gpt-5.4", label: "gpt-5.4" },
    { value: "gpt-5.3-codex-spark", label: "gpt-5.3-codex-spark" }
  ]
};

let currentSettings = null;

void init();

async function init() {
  try {
    const settings = await sendRuntime({ type: "getSettings" });
    currentSettings = settings;
    populateRateSelect(targetRateEl, settings.targetRate || settings.defaultRate || 1);
    populateRateSelect(maxRateEl, settings.maxRate || 1.75);
    applySettings(settings);
	    const provider = await sendRuntime({ type: "getProviderStatus" });
	    providerStatusEl.textContent = formatProvider(provider);
	    await refreshUsageStats();
	    await refreshPageState();
  } catch (error) {
    setMessage(error.message || String(error));
  }
}

providerSelectEl.addEventListener("change", () => {
  if (!currentSettings) return;
  currentSettings.provider = providerSelectEl.value;
  populateModelSelect();
  void savePopupSettings({ analyzeHint: true });
});

modelSelectEl.addEventListener("change", () => void savePopupSettings({ analyzeHint: true }));
speedModeEl.addEventListener("change", () => void savePopupSettings());
viewerGoalModeEl.addEventListener("change", () => void savePopupSettings({ analyzeHint: true }));
viewerGoalTextEl.addEventListener("change", () => void savePopupSettings({ analyzeHint: true }));
customPromptEl.addEventListener("change", () => void savePopupSettings({ analyzeHint: true }));
targetRateEl.addEventListener("change", () => {
  syncRateBounds();
  void savePopupSettings();
});
maxRateEl.addEventListener("change", () => {
  syncRateBounds();
  void savePopupSettings();
});

analyzeEl.addEventListener("click", async () => {
  analyzeEl.disabled = true;
  setMessage("Analyzing...");
  try {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error("No active tab.");
    const response = await sendTab(tab.id, { type: "popupAnalyze" });
    setMessage(`${response.source || "Ready"} (${response.plan?.length || 0} segments)`);
    await refreshPageState();
  } catch (error) {
    setMessage(error.message || String(error));
  } finally {
    analyzeEl.disabled = false;
  }
});

optionsEl.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

async function refreshPageState() {
  const tab = await getActiveTab();
	  if (!tab?.id || !tab.url?.includes("youtube.com/watch")) {
	    pageStatusEl.textContent = "Not on a YouTube watch page";
	    analyzeEl.disabled = true;
	    plannedSavingsEl.textContent = "--";
	    videoSavedEl.textContent = "0:00";
	    await refreshUsageStats();
	    return;
	  }
	  try {
	    const state = await sendTab(tab.id, { type: "getPageState" });
		    pageStatusEl.textContent = state.videoId
		      ? `${state.enabled ? state.status || "Ready" : "AI Speed off"} - ${state.planSegments || 0} speed segments`
		      : "Waiting for video";
		    plannedSavingsEl.textContent = state.plannedSavings ? formatDuration(state.plannedSavings) : "--";
		    videoSavedEl.textContent = formatDuration(state.videoSaved || 0);
		    totalSavedEl.textContent = formatDuration(state.totalSaved || 0);
		    analyzeEl.disabled = !state.enabled;
	  } catch {
	    pageStatusEl.textContent = "Reload the YouTube tab";
	    analyzeEl.disabled = true;
	    await refreshUsageStats();
	  }
	}

async function refreshUsageStats() {
  try {
    const stats = await sendRuntime({ type: "getUsageStats" });
    totalSavedEl.textContent = formatDuration(stats.totalSavedSeconds || 0);
  } catch {
    totalSavedEl.textContent = "0:00";
  }
}

function formatProvider(status) {
  if (status.provider === "chatgpt") return status.chatgpt?.connected ? "ChatGPT Plus/Pro connected" : "ChatGPT not connected";
  if (status.provider === "openai") return status.byok?.openai ? "OpenAI API key" : "OpenAI key missing";
  if (status.provider === "openrouter") return status.byok?.openrouter ? "OpenRouter key" : "OpenRouter key missing";
  if (status.provider === "google") return status.byok?.google ? "Google key" : "Google key missing";
  return "Local heuristic";
}

function applySettings(settings) {
  providerSelectEl.value = settings.provider || "heuristic";
  speedModeEl.value = settings.speedMode || legacySpeedMode(settings.aggressiveness);
  viewerGoalModeEl.value = settings.viewerGoalMode || "auto";
  viewerGoalTextEl.value = settings.viewerGoalText || "";
  customPromptEl.value = settings.customPrompt || "";
  targetRateEl.value = String(settings.targetRate || settings.defaultRate || 1);
  maxRateEl.value = String(settings.maxRate || 1.75);
  populateModelSelect();
  syncRateBounds();
}

function populateRateSelect(select, selected) {
  select.innerHTML = "";
  for (const rate of RATE_OPTIONS) {
    const option = document.createElement("option");
    option.value = String(rate);
    option.textContent = `${rate}x`;
    select.appendChild(option);
  }
  select.value = String(snapRate(selected));
}

function populateModelSelect() {
  const provider = providerSelectEl.value || "heuristic";
  const key = modelKey(provider);
  const current = currentSettings?.[key] || "";
  const options = [...(MODEL_OPTIONS[provider] || [])];
  if (current && !options.some((option) => option.value === current)) {
    options.unshift({ value: current, label: `${current} (current)` });
  }
  modelSelectEl.innerHTML = "";
  for (const option of options) {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;
    modelSelectEl.appendChild(node);
  }
  modelSelectEl.disabled = provider === "heuristic";
  modelSelectEl.value = current || options[0]?.value || "";
}

async function savePopupSettings({ analyzeHint = false } = {}) {
  try {
    const patch = collectSettingsPatch();
    const settings = await sendRuntime({ type: "saveSettings", settings: patch });
    currentSettings = settings;
    applySettings(settings);
    const provider = await sendRuntime({ type: "getProviderStatus" });
    providerStatusEl.textContent = formatProvider(provider);
    await notifyActiveTab(settings);
    setMessage(analyzeHint ? "Saved. Analyze again to use this model." : "Saved.");
  } catch (error) {
    setMessage(error.message || String(error));
  }
}

function collectSettingsPatch() {
  const provider = providerSelectEl.value;
  const patch = {
    provider,
    speedMode: speedModeEl.value,
    viewerGoalMode: viewerGoalModeEl.value,
    viewerGoalText: viewerGoalTextEl.value.trim(),
    customPrompt: customPromptEl.value.trim(),
    targetRate: Number(targetRateEl.value),
    defaultRate: Number(targetRateEl.value),
    maxRate: Number(maxRateEl.value)
  };
  const key = modelKey(provider);
  if (key && modelSelectEl.value && provider !== "heuristic") patch[key] = modelSelectEl.value;
  return patch;
}

function syncRateBounds() {
  const targetRate = snapRate(targetRateEl.value);
  const maxRate = Math.max(targetRate, snapRate(maxRateEl.value));
  targetRateEl.value = String(targetRate);
  maxRateEl.value = String(maxRate);
}

function snapRate(value) {
  const numeric = Number(value) || 1;
  return RATE_OPTIONS.reduce((best, rate) => (Math.abs(rate - numeric) < Math.abs(best - numeric) ? rate : best), 1);
}

function modelKey(provider) {
  if (provider === "openai") return "openaiModel";
  if (provider === "openrouter") return "openrouterModel";
  if (provider === "google") return "googleModel";
  if (provider === "chatgpt") return "chatgptModel";
  return "";
}

function legacySpeedMode(value) {
  if (value === "conservative") return "calm";
  if (value === "aggressive") return "aggressive";
  return "reasonable";
}

async function notifyActiveTab(settings) {
  const tab = await getActiveTab();
  if (tab?.id && tab.url?.includes("youtube.com/watch")) {
    await sendTab(tab.id, { type: "settingsUpdated", settings }).catch(() => {});
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function sendRuntime(message) {
  return chrome.runtime.sendMessage(message).then(unwrapResponse);
}

function sendTab(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message).then(unwrapResponse);
}

function unwrapResponse(response) {
  if (!response?.ok) throw new Error(response?.error || "Extension message failed");
  return response.result;
}

function setMessage(text) {
  messageEl.textContent = text;
}

function formatDuration(seconds) {
  seconds = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
