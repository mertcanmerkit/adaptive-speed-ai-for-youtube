const fields = {
  autoAnalyze: document.getElementById("autoAnalyze"),
  speedMode: document.getElementById("speedMode"),
  viewerGoalMode: document.getElementById("viewerGoalMode"),
  viewerGoalText: document.getElementById("viewerGoalText"),
  customPrompt: document.getElementById("customPrompt"),
  targetRate: document.getElementById("targetRate"),
  maxRate: document.getElementById("maxRate"),
  provider: document.getElementById("provider"),
  openaiApiKey: document.getElementById("openaiApiKey"),
  openaiModel: document.getElementById("openaiModel"),
  openrouterApiKey: document.getElementById("openrouterApiKey"),
  openrouterModel: document.getElementById("openrouterModel"),
  googleApiKey: document.getElementById("googleApiKey"),
  googleModel: document.getElementById("googleModel"),
  chatgptModel: document.getElementById("chatgptModel")
};

const saveEl = document.getElementById("save");
const messageEl = document.getElementById("message");
const browserAuthEl = document.getElementById("browserAuth");
const deviceAuthEl = document.getElementById("deviceAuth");
const disconnectEl = document.getElementById("disconnectChatgpt");
const chatgptStatusEl = document.getElementById("chatgptStatus");
const deviceBoxEl = document.getElementById("deviceBox");
const deviceUrlEl = document.getElementById("deviceUrl");
const deviceCodeEl = document.getElementById("deviceCode");
const clearCacheEl = document.getElementById("clearCache");
const forgetKeysEl = document.getElementById("forgetKeys");
const testConnectionEl = document.getElementById("testConnection");
const connectionStatusEl = document.getElementById("connectionStatus");

let devicePollTimer = 0;
const MODEL_FIELD_IDS = ["openaiModel", "openrouterModel", "googleModel", "chatgptModel"];

void init();

async function init() {
  try {
    const settings = await sendRuntime({ type: "getSettings" });
    applySettings(settings);
    await refreshProviderStatus();
    renderProviderPanels();
  } catch (error) {
    setMessage(error.message || String(error));
  }
}

saveEl.addEventListener("click", async () => {
  try {
    const patch = collectSettings();
    const settings = await sendRuntime({ type: "saveSettings", settings: patch });
    applySettings(settings);
    setMessage("Saved.");
    await refreshProviderStatus();
    await notifyYoutubeTabs(settings);
  } catch (error) {
    setMessage(error.message || String(error));
  }
});

fields.provider.addEventListener("change", renderProviderPanels);
fields.targetRate.addEventListener("change", syncRateBounds);
fields.maxRate.addEventListener("change", syncRateBounds);

testConnectionEl.addEventListener("click", async () => {
  testConnectionEl.disabled = true;
  connectionStatusEl.textContent = "Testing...";
  try {
    await sendRuntime({ type: "saveSettings", settings: collectSettings() });
    const result = await sendRuntime({ type: "testProviderConnection" });
    connectionStatusEl.textContent = `${providerLabel(result.provider)} (${result.model}): ${result.message}`;
    setMessage("Connection test succeeded.");
  } catch (error) {
    connectionStatusEl.textContent = "";
    setMessage(error.message || String(error));
  } finally {
    testConnectionEl.disabled = false;
  }
});

browserAuthEl.addEventListener("click", async () => {
  browserAuthEl.disabled = true;
  try {
    const result = await sendRuntime({ type: "startChatgptBrowserAuth" });
    setMessage(`Browser auth opened. Redirect target: ${result.redirect}`);
  } catch (error) {
    setMessage(error.message || String(error));
  } finally {
    browserAuthEl.disabled = false;
  }
});

deviceAuthEl.addEventListener("click", async () => {
  deviceAuthEl.disabled = true;
  try {
    const result = await sendRuntime({ type: "startChatgptDeviceAuth" });
    deviceBoxEl.hidden = false;
    deviceUrlEl.href = result.url;
    deviceCodeEl.textContent = result.userCode;
    setMessage("Device auth started.");
    window.clearInterval(devicePollTimer);
    devicePollTimer = window.setInterval(() => void pollDeviceAuth(), Math.max(result.interval, 5) * 1000 + 3000);
  } catch (error) {
    setMessage(error.message || String(error));
  } finally {
    deviceAuthEl.disabled = false;
  }
});

disconnectEl.addEventListener("click", async () => {
  try {
    await sendRuntime({ type: "disconnectChatgpt" });
    await refreshProviderStatus();
    setMessage("Disconnected.");
  } catch (error) {
    setMessage(error.message || String(error));
  }
});

clearCacheEl.addEventListener("click", async () => {
  try {
    await sendRuntime({ type: "clearCache" });
    setMessage("Cache cleared.");
  } catch (error) {
    setMessage(error.message || String(error));
  }
});

forgetKeysEl.addEventListener("click", async () => {
  try {
    await sendRuntime({ type: "forgetProviderKeys" });
    fields.openaiApiKey.value = "";
    fields.openaiApiKey.placeholder = "sk-...";
    fields.openrouterApiKey.value = "";
    fields.openrouterApiKey.placeholder = "sk-or-...";
    fields.googleApiKey.value = "";
    fields.googleApiKey.placeholder = "";
    setMessage("Provider API keys removed.");
  } catch (error) {
    setMessage(error.message || String(error));
  }
});

async function pollDeviceAuth() {
  try {
    const result = await sendRuntime({ type: "pollChatgptDeviceAuth" });
    if (result.pending) {
      setMessage("Waiting for device approval...");
      return;
    }
    window.clearInterval(devicePollTimer);
    deviceBoxEl.hidden = true;
    await refreshProviderStatus();
    setMessage("ChatGPT connected.");
  } catch (error) {
    window.clearInterval(devicePollTimer);
    setMessage(error.message || String(error));
  }
}

function applySettings(settings) {
  fields.autoAnalyze.checked = Boolean(settings.autoAnalyze);
  fields.speedMode.value = settings.speedMode || legacySpeedMode(settings.aggressiveness);
  fields.viewerGoalMode.value = settings.viewerGoalMode || "auto";
  fields.viewerGoalText.value = settings.viewerGoalText || "";
  fields.customPrompt.value = settings.customPrompt || "";
  fields.targetRate.value = String(settings.targetRate || settings.defaultRate || 1);
  fields.maxRate.value = String(settings.maxRate || 1.75);
  fields.provider.value = settings.provider || "heuristic";
  for (const id of MODEL_FIELD_IDS) setSelectValue(fields[id], settings[id] || "");
  fields.openaiApiKey.placeholder = settings.openaiApiKey ? settings.openaiApiKey : "sk-...";
  fields.openrouterApiKey.placeholder = settings.openrouterApiKey ? settings.openrouterApiKey : "sk-or-...";
  fields.googleApiKey.placeholder = settings.googleApiKey ? settings.googleApiKey : "";
  syncRateBounds();
}

function collectSettings() {
  const patch = {
    autoAnalyze: fields.autoAnalyze.checked,
    speedMode: fields.speedMode.value,
    viewerGoalMode: fields.viewerGoalMode.value,
    viewerGoalText: fields.viewerGoalText.value.trim(),
    customPrompt: fields.customPrompt.value.trim(),
    targetRate: Number(fields.targetRate.value),
    defaultRate: Number(fields.targetRate.value),
    maxRate: Number(fields.maxRate.value),
    provider: fields.provider.value,
    openaiModel: fields.openaiModel.value.trim(),
    openrouterModel: fields.openrouterModel.value.trim(),
    googleModel: fields.googleModel.value.trim(),
    chatgptModel: fields.chatgptModel.value.trim()
  };
  if (fields.openaiApiKey.value.trim()) patch.openaiApiKey = fields.openaiApiKey.value.trim();
  if (fields.openrouterApiKey.value.trim()) patch.openrouterApiKey = fields.openrouterApiKey.value.trim();
  if (fields.googleApiKey.value.trim()) patch.googleApiKey = fields.googleApiKey.value.trim();
  return patch;
}

function renderProviderPanels() {
  const active = fields.provider.value;
  document.querySelectorAll(".provider-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.provider === active);
  });
}

function setSelectValue(select, value) {
  if (value && ![...select.options].some((option) => option.value === value)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `${value} (current)`;
    select.insertBefore(option, select.firstChild);
  }
  select.value = value || select.options[0]?.value || "";
}

function syncRateBounds() {
  const targetRate = Number(fields.targetRate.value) || 1;
  const maxRate = Math.max(targetRate, Number(fields.maxRate.value) || targetRate);
  fields.maxRate.value = String(maxRate);
}

function legacySpeedMode(value) {
  if (value === "conservative") return "calm";
  if (value === "aggressive") return "aggressive";
  return "reasonable";
}

async function notifyYoutubeTabs(settings) {
  const tabs = await chrome.tabs.query({ url: ["https://www.youtube.com/watch*", "https://youtube.com/watch*"] });
  await Promise.allSettled(tabs.map((tab) => chrome.tabs.sendMessage(tab.id, { type: "settingsUpdated", settings })));
}

function providerLabel(provider) {
  if (provider === "openai") return "OpenAI";
  if (provider === "openrouter") return "OpenRouter";
  if (provider === "google") return "Google";
  if (provider === "chatgpt") return "ChatGPT";
  return "Heuristic";
}

async function refreshProviderStatus() {
  const status = await sendRuntime({ type: "getProviderStatus" });
  if (status.chatgpt?.connected) {
    const expires = status.chatgpt.expires ? new Date(status.chatgpt.expires).toLocaleString() : "unknown";
    chatgptStatusEl.textContent = `Connected. Token expires: ${expires}`;
  } else {
    chatgptStatusEl.textContent = "Not connected.";
  }
}

function sendRuntime(message) {
  return chrome.runtime.sendMessage(message).then((response) => {
    if (!response?.ok) throw new Error(response?.error || "Extension message failed");
    return response.result;
  });
}

function setMessage(text) {
  messageEl.textContent = text;
}
