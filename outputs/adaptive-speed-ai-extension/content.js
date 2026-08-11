(() => {
  const STATE = {
    videoId: "",
    title: "",
    duration: 0,
    language: "",
    metadata: {},
    captionTrack: {},
    segments: [],
    plan: [],
    enabled: true,
    autoAnalyze: true,
    targetRate: 1,
    defaultRate: 1,
    maxRate: 1.75,
    speedMode: "reasonable",
    defaultViewerGoalMode: "auto",
    defaultViewerGoalText: "",
    viewerGoalMode: "auto",
    viewerGoalText: "",
    customPrompt: "",
    viewerGoalTouched: false,
    status: "Idle",
	    source: "",
	    warning: "",
	    plannedSavings: 0,
	    videoSaved: 0,
	    totalSaved: 0,
	    pendingSaved: 0,
	    lastSavingsTick: 0,
	    lastSavingsVideoTime: null,
	    lastSavingsFlush: 0,
	    lastAppliedRate: 1,
	    pendingTargetSpeed: 0,
	    pendingTargetSince: 0,
    analyzing: false,
    analysisRunId: 0,
    manualHoldUntil: 0,
    rateCooldownUntil: 0,
    applyingRate: false,
    observedVideo: null
  };

  let overlay;
	  let rateEl;
	  let barEl;
	  let savingsEl;
	  let toggleEl;
	  let modeEl;
	  let analyzeButton;
  let goalButton;
  let goalPopover;
  let goalModeEl;
  let goalTextEl;
  let goalApplyButton;
  let goalCancelButton;
  let lastUrl = location.href;

	  void init();

	  async function init() {
		    createOverlay();
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      handleRuntimeMessage(message)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
      return true;
    });
	    await loadSettings();
	    window.addEventListener("message", (event) => {
	      if (event.source !== window) return;
	      if (event.data?.source !== "adaptive-speed-ai-bridge") return;
	      if (event.data?.type === "YOUTUBE_NAVIGATED") void handleNavigation(false);
	    });
	    window.addEventListener("pagehide", () => void flushSavedTime());
	    void handleNavigation(true);
	    setInterval(tick, 500);
	    setInterval(() => {
	      mountControls();
	      mountNativePlanBar();
	    }, 1000);
	    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        void handleNavigation(false);
      }
    }, 800);
  }

	  async function handleRuntimeMessage(message) {
	    if (message?.type === "popupAnalyze") return analyzeCurrentVideo({ force: true });
	    if (message?.type === "popupToggle") {
	      await setEnabledState(Boolean(message.enabled), { persist: false });
	      return { enabled: STATE.enabled };
	    }
	    if (message?.type === "settingsUpdated") {
      const wasEnabled = STATE.enabled;
	      applyRuntimeSettings(message.settings || {});
      if (!STATE.enabled) {
        stopAiSpeedWork("AI Speed off");
      } else if (!wasEnabled) {
        void handleNavigation(true);
      }
	      STATE.plannedSavings = calculatePlanSavings(STATE.plan, Number(getVideo()?.duration) || STATE.duration);
	      renderPlanBar();
      updateSavingsUI();
      return {
        enabled: STATE.enabled,
        targetRate: STATE.targetRate,
        defaultRate: STATE.defaultRate,
        maxRate: STATE.maxRate,
        speedMode: STATE.speedMode
      };
    }
	    if (message?.type === "getPageState") {
	      await flushSavedTime();
	      await refreshUsageStats();
		      return {
		        videoId: STATE.videoId,
		        title: STATE.title,
		        status: STATE.status,
        enabled: STATE.enabled,
		        source: STATE.source,
	        planSegments: STATE.plan.length,
	        transcriptSegments: STATE.segments.length,
	        rate: STATE.lastAppliedRate,
	        plannedSavings: STATE.plannedSavings,
	        videoSaved: STATE.videoSaved,
	        totalSaved: STATE.totalSaved,
	        targetRate: STATE.targetRate,
	        defaultRate: STATE.defaultRate,
	        maxRate: STATE.maxRate,
	        speedMode: STATE.speedMode,
	        warning: STATE.warning
	      };
	    }
    return null;
  }

  async function loadSettings() {
    const response = await sendMessage({ type: "getSettings" });
	    const settings = response.result || {};
	    applyRuntimeSettings(settings);
	    updateSavingsUI();
	  }

		  function applyRuntimeSettings(settings) {
		    STATE.enabled = settings.aiSpeedActive === undefined ? Boolean(settings.enabled) : Boolean(settings.aiSpeedActive);
		    STATE.autoAnalyze = Boolean(settings.autoAnalyze);
	    STATE.targetRate = normalizeRate(settings.targetRate ?? settings.defaultRate, 1);
	    STATE.defaultRate = STATE.targetRate;
	    STATE.maxRate = Math.max(STATE.defaultRate, normalizeRate(settings.maxRate, 1.75));
	    STATE.speedMode = normalizeSpeedMode(settings.speedMode || legacySpeedMode(settings.aggressiveness));
    STATE.defaultViewerGoalMode = normalizeViewerGoalMode(settings.viewerGoalMode || "auto");
    STATE.defaultViewerGoalText = String(settings.viewerGoalText || "").replace(/\s+/g, " ").trim().slice(0, 180);
    STATE.customPrompt = String(settings.customPrompt || "").replace(/\s+/g, " ").trim().slice(0, 700);
    resetVideoGoal();
	    if (toggleEl) toggleEl.checked = STATE.enabled;
		    if (modeEl) modeEl.value = STATE.speedMode;
    updateModeTitle();
    updateGoalButton();
		  }

  async function setEnabledState(enabled, { persist } = { persist: true }) {
    STATE.enabled = Boolean(enabled);
    if (toggleEl) toggleEl.checked = STATE.enabled;
    if (persist) await sendMessage({ type: "saveSettings", settings: { aiSpeedActive: STATE.enabled } });
    if (!STATE.enabled) {
      stopAiSpeedWork("AI Speed off");
      if (getVideo()) getVideo().playbackRate = 1;
      return;
    }
    updateStatus("AI Speed on");
    void handleNavigation(true);
  }

  function stopAiSpeedWork(status = "AI Speed off") {
    STATE.analysisRunId += 1;
    STATE.analyzing = false;
    STATE.segments = [];
    STATE.language = "";
    STATE.plan = [];
    STATE.source = "";
    STATE.warning = "";
    STATE.plannedSavings = 0;
    STATE.pendingTargetSpeed = 0;
    STATE.pendingTargetSince = 0;
    STATE.rateCooldownUntil = 0;
    setAnalyzeButtonBusy(false);
    renderPlanBar();
    updateSavingsUI();
    updateStatus(status);
  }

	  async function handleNavigation(initial) {
    const videoId = getVideoId();
    if (!videoId) {
      resetVideoState();
      updateStatus("Open a YouTube video");
      return;
    }
	    if (!initial && videoId === STATE.videoId) return;

	    await flushSavedTime();
	    resetVideoState();
	    STATE.videoId = videoId;
	    STATE.title = getVideoTitle();
	    const video = getVideo();
	    STATE.duration = Number(video?.duration) || 0;
		    attachVideoListeners(video);
		    mountControls();
		    mountNativePlanBar();
		    await refreshUsageStats();
    if (!STATE.enabled) {
      stopAiSpeedWork("AI Speed off");
      return;
    }
		    updateStatus("Reading transcript...");

	    try {
      if (!STATE.enabled) return;
	      const transcript = await extractTranscript();
      if (!STATE.enabled) return;
	      STATE.segments = transcript.segments;
	      STATE.language = transcript.language || "";
      STATE.metadata = transcript.metadata || {};
      STATE.captionTrack = transcript.captionTrack || {};
	      STATE.title = getVideoTitle();
      STATE.duration = Number(getVideo()?.duration) || transcript.duration || 0;
      updateStatus(`Transcript ready (${STATE.segments.length})`);
	      if (STATE.enabled && STATE.autoAnalyze) void analyzeCurrentVideo({ force: false });
    } catch (error) {
      updateStatus(error.message || "Transcript unavailable");
    }
  }

  function resetVideoState() {
    STATE.videoId = "";
	    STATE.title = "";
	    STATE.duration = 0;
	    STATE.language = "";
    STATE.metadata = {};
    STATE.captionTrack = {};
    resetVideoGoal();
	    STATE.segments = [];
    STATE.plan = [];
	    STATE.source = "";
	    STATE.warning = "";
	    STATE.plannedSavings = 0;
	    STATE.videoSaved = 0;
	    STATE.pendingSaved = 0;
		    STATE.lastSavingsTick = 0;
		    STATE.lastSavingsVideoTime = null;
		    STATE.lastSavingsFlush = 0;
		    STATE.analyzing = false;
	    STATE.analysisRunId += 1;
		    renderPlanBar();
	    updateSavingsUI();
	  }

  function resetVideoGoal() {
    STATE.viewerGoalMode = STATE.defaultViewerGoalMode || "auto";
    STATE.viewerGoalText = STATE.defaultViewerGoalText || "";
    STATE.viewerGoalTouched = false;
    updateGoalButton();
    updateGoalPopoverValues();
  }

	  async function analyzeCurrentVideo({ force }) {
	    if (STATE.analyzing) return { analyzing: true };
	    if (!STATE.videoId) throw new Error("No YouTube video detected.");
    if (!STATE.enabled) {
      stopAiSpeedWork("AI Speed off");
      return { disabled: true, source: "", plan: [] };
    }
    const runId = ++STATE.analysisRunId;
	    if (!STATE.segments.length) {
	      const transcript = await extractTranscript();
      if (!STATE.enabled || runId !== STATE.analysisRunId) return { disabled: true, source: "", plan: [] };
		      STATE.segments = transcript.segments;
		      STATE.language = transcript.language || "";
      STATE.metadata = transcript.metadata || {};
      STATE.captionTrack = transcript.captionTrack || {};
	    }

	    STATE.analyzing = true;
    setAnalyzeButtonBusy(true);
    updateStatus("Analyzing...");
    try {
      const response = await sendMessage({
        type: "analyzeTranscript",
        payload: {
          videoId: STATE.videoId,
	          title: STATE.title || getVideoTitle(),
	          duration: Number(getVideo()?.duration) || STATE.duration,
	          language: STATE.language,
          metadata: STATE.metadata || {},
          captionTrack: STATE.captionTrack || {},
          entry: getEntryContext(),
          viewerGoalMode: STATE.viewerGoalMode,
          viewerGoalText: STATE.viewerGoalText,
          customPrompt: STATE.customPrompt,
	          segments: STATE.segments,
	          force
	        }
	      });
      if (!STATE.enabled || runId !== STATE.analysisRunId) return { disabled: true, source: "", plan: [] };
	      const result = response.result;
	      STATE.plan = Array.isArray(result.plan) ? result.plan : [];
	      STATE.source = result.source || "";
	      STATE.warning = result.warning || "";
	      STATE.plannedSavings = calculatePlanSavings(STATE.plan, Number(getVideo()?.duration) || STATE.duration);
	      renderPlanBar();
	      updateSavingsUI();
	      updateStatus(`${result.cached ? "Cached" : "Ready"}: ${STATE.source}`);
      return result;
    } finally {
      STATE.analyzing = false;
      setAnalyzeButtonBusy(false);
    }
  }

	  function tick() {
	    const video = getVideo();
	    if (!video) return;
	    attachVideoListeners(video);
	    if (!STATE.duration && Number.isFinite(video.duration)) STATE.duration = video.duration;
	    const now = Date.now();
	    trackSavedTime(video, now);

	    if (!STATE.enabled || Date.now() < STATE.manualHoldUntil) {
	      rateEl.textContent = `${round(video.playbackRate, 2)}x`;
	      updateSavingsUI();
	      return;
	    }

    const target = findRateForTime(video.currentTime);
    const targetSpeed = target ? effectiveSegmentSpeed(target) : STATE.defaultRate;
	    if (
	      Date.now() > STATE.rateCooldownUntil &&
	      (!target || video.currentTime > target.start + 0.35) &&
	      Math.abs(video.playbackRate - targetSpeed) > 0.04
	    ) {
      if (Math.abs(STATE.pendingTargetSpeed - targetSpeed) > 0.04) {
        STATE.pendingTargetSpeed = targetSpeed;
        STATE.pendingTargetSince = now;
        rateEl.textContent = `${round(video.playbackRate, 2)}x`;
        updateSavingsUI();
        updateActiveBar(video.currentTime);
        return;
      }
	      if (now - STATE.pendingTargetSince < 450) {
        rateEl.textContent = `${round(video.playbackRate, 2)}x`;
        updateSavingsUI();
        updateActiveBar(video.currentTime);
        return;
      }
      STATE.applyingRate = true;
      video.playbackRate = targetSpeed;
	      STATE.lastAppliedRate = targetSpeed;
	      STATE.pendingTargetSpeed = 0;
	      STATE.pendingTargetSince = 0;
	      STATE.rateCooldownUntil = Date.now() + 1600;
      window.setTimeout(() => {
        STATE.applyingRate = false;
      }, 250);
	    }
	    if (Math.abs(video.playbackRate - targetSpeed) <= 0.04) {
	      STATE.pendingTargetSpeed = 0;
	      STATE.pendingTargetSince = 0;
	    }
	    rateEl.textContent = `${round(video.playbackRate, 2)}x`;
	    updateSavingsUI();
	    updateActiveBar(video.currentTime);
	  }

  function findRateForTime(time) {
    let low = 0;
    let high = STATE.plan.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const item = STATE.plan[mid];
      if (time < item.start) high = mid - 1;
      else if (time >= item.end) low = mid + 1;
      else return item;
    }
    return null;
  }

	  async function extractTranscript() {
    if (!STATE.enabled) throw new Error("AI Speed off");
	    const playerResponse = await getPlayerResponse();
    const metadata = extractVideoMetadata(playerResponse);
	    const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
	    const captionTracks = Array.isArray(tracks) ? rankCaptionTracks(tracks.filter((track) => track.baseUrl)) : [];
	    if (!captionTracks.length) {
	      const panelResult = await scrapeTranscriptPanel(metadata);
	      if (panelResult.segments.length) return panelResult;
	      throw new Error("No captions or rendered transcript found for this video.");
	    }

    const errors = [];
    for (const selected of captionTracks) {
      for (const fmt of ["json3", "srv3"]) {
        try {
          const url = withTimedTextFormat(selected.baseUrl, fmt);
          const response = await fetch(url, { credentials: "include" });
          if (!response.ok) throw new Error(`timedtext ${response.status}`);
          const body = await response.text();
          if (!body.trim()) throw new Error(`empty timedtext ${fmt}`);
          const segments = fmt === "json3" ? parseJson3Transcript(JSON.parse(body)) : parseXmlTranscript(body);
	          if (segments.length) {
	            return {
	              language: selected.languageCode || selected.vssId || "",
	              duration: Number(getVideo()?.duration) || segments[segments.length - 1].end,
              metadata,
              captionTrack: summarizeCaptionTrack(selected, fmt),
	              segments
	            };
	          }
        } catch (error) {
          errors.push(error.message || String(error));
        }
      }
    }

	    const panelResult = await scrapeTranscriptPanel(metadata);
    if (panelResult.segments.length) return panelResult;

    throw new Error(errors.find((error) => !/Unexpected end of JSON input|empty timedtext/.test(error)) || "Transcript was present but unreadable.");
  }

  function rankCaptionTracks(tracks) {
    return [...tracks].sort((a, b) => scoreCaptionTrack(b) - scoreCaptionTrack(a));
  }

  function scoreCaptionTrack(track) {
    const lang = track.languageCode || "";
    let score = 0;
    if (track.kind !== "asr") score += 12;
    if (/^en\b/i.test(lang)) score += 8;
    if (/^tr\b/i.test(lang)) score += 7;
    if (track.isTranslatable) score += 1;
    return score;
  }

  function withTimedTextFormat(baseUrl, fmt) {
    if (/[?&]fmt=/.test(baseUrl)) return baseUrl.replace(/([?&]fmt=)[^&]+/, `$1${fmt}`);
    return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}fmt=${fmt}`;
  }

  function parseJson3Transcript(data) {
    const output = [];
    for (const event of data?.events || []) {
      if (!event.segs?.length) continue;
      const start = Number(event.tStartMs || 0) / 1000;
      const duration = Number(event.dDurationMs || 0) / 1000;
      const text = event.segs.map((seg) => seg.utf8 || "").join("").replace(/\s+/g, " ").trim();
      if (!text) continue;
      output.push({
        start,
        end: start + Math.max(duration, 0.8),
        text
      });
    }
    return output;
  }

  function parseXmlTranscript(xml) {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const textNodes = [...doc.querySelectorAll("text")].map((node) => {
      const start = Number(node.getAttribute("start"));
      const duration = Number(node.getAttribute("dur") || 1);
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (!Number.isFinite(start) || !text) return null;
      return { start, end: start + Math.max(duration, 0.8), text };
    });
    const srv3Nodes = [...doc.querySelectorAll("p")].map((node) => {
      const start = Number(node.getAttribute("t") || 0) / 1000;
      const duration = Number(node.getAttribute("d") || 1000) / 1000;
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (!Number.isFinite(start) || !text) return null;
      return { start, end: start + Math.max(duration, 0.8), text };
    });
    return [...textNodes, ...srv3Nodes].filter(Boolean).sort((a, b) => a.start - b.start);
  }

		  async function scrapeTranscriptPanel(metadata = {}) {
	    const alreadyOpen = hasVisibleTranscriptPanel();
	    const autoHidden = !alreadyOpen;
	    const scrollX = window.scrollX;
	    const scrollY = window.scrollY;
	    if (autoHidden) document.documentElement.classList.add("asai-auto-transcript-hidden");

	    try {
	      await openTranscriptPanel();

	      let previousCount = 0;
	      let stable = 0;
	      const rowMap = new Map();
	      for (let attempt = 0; attempt < 14; attempt += 1) {
	        const nodes = getTranscriptPanelNodes();
	        for (const row of nodes.map(parseTranscriptNode).filter(Boolean)) {
	          rowMap.set(`${row.start}:${row.text}`, row);
	        }
	        for (const row of parseTranscriptRowsFromText(document.body.innerText || document.body.textContent || "")) {
	          rowMap.set(`${row.start}:${row.text}`, row);
	        }
	        scrollTranscriptPanel(nodes);
	        if (rowMap.size === previousCount) stable += 1;
	        else stable = 0;
	        previousCount = rowMap.size;
	        if (rowMap.size && stable >= 2) break;
	        await sleep(400);
	      }

	      const rows = [...rowMap.values()]
	        .sort((a, b) => a.start - b.start)
	        .filter((row, index, list) => index === 0 || row.start !== list[index - 1].start || row.text !== list[index - 1].text);

	      const segments = rows.map((row, index) => {
	        const next = rows[index + 1];
	        return {
	          start: row.start,
	          end: next ? Math.max(next.start, row.start + 0.8) : row.start + 4,
	          text: row.text
	        };
	      });

	      return {
	        language: "",
	        duration: Number(getVideo()?.duration) || segments[segments.length - 1]?.end || 0,
	        metadata,
	        captionTrack: { source: "panel", kind: "rendered", language: "" },
	        segments
	      };
	    } finally {
	      if (autoHidden) {
	        await closeAutoTranscriptPanel();
	        document.documentElement.classList.remove("asai-auto-transcript-hidden");
	        window.scrollTo(scrollX, scrollY);
	      }
	    }
	  }

	  async function openTranscriptPanel() {
	    if (getTranscriptPanelNodes().length) return;

	    const visibleButton = findTranscriptButton();
	    if (visibleButton && isVisible(visibleButton)) {
	      visibleButton.click();
	      await sleep(900);
	      if (getTranscriptPanelNodes().length) return;
	    }

	    await openTranscriptFromActionsMenu();
	    if (getTranscriptPanelNodes().length) return;

	    const expanders = [
	      ...queryDeep("ytd-watch-metadata ytd-text-inline-expander #expand"),
	      ...queryDeep("ytd-watch-metadata tp-yt-paper-button#expand"),
	      ...queryDeep("ytd-watch-metadata #expand")
	    ];
	    for (const expander of expanders.slice(0, 2)) {
	      if (isVisible(expander)) {
	        expander.click();
	        await sleep(250);
	      }
	    }

	    const button = findTranscriptButton();
	    if (button) {
	      button.click();
	      await sleep(900);
	      if (getTranscriptPanelNodes().length) return;
	    }
	  }

	  async function openTranscriptFromActionsMenu() {
	    const menuButtons = [
	      ...queryDeep("ytd-watch-metadata ytd-menu-renderer button"),
	      ...queryDeep("ytd-watch-metadata ytd-menu-renderer #button"),
	      ...queryDeep("button[aria-label*='More']"),
	      ...queryDeep("button[aria-label*='more']"),
	      ...queryDeep("button[aria-label*='Daha']"),
	      ...queryDeep("button[aria-label*='daha']")
	    ];
	    const menuButton = menuButtons.find((candidate) => {
	      const label = getNodeText(candidate).toLowerCase();
	      return isVisible(candidate) && /more actions|more|daha fazla|diğer|diger/.test(label);
	    }) || menuButtons.find(isVisible);
	    if (!menuButton) return;

	    menuButton.click();
	    await sleep(500);
	    const transcriptItem = [
	      ...queryDeep("ytd-menu-service-item-renderer"),
	      ...queryDeep("tp-yt-paper-item"),
	      ...queryDeep("[role='menuitem']"),
	      ...queryDeep("[role='option']")
	    ].find((item) => /transcript|transkript|transcripción|transcription|metni göster/.test(getNodeText(item).toLowerCase()));
	    if (transcriptItem) {
	      transcriptItem.click();
	      await sleep(900);
	    } else {
	      menuButton.click();
	      await sleep(150);
	    }
	  }

	  async function closeAutoTranscriptPanel() {
	    const panels = getTranscriptPanelContainers();
	    const closeCandidates = panels.flatMap((panel) =>
	      Array.from(panel.querySelectorAll?.("button, [role='button'], tp-yt-paper-icon-button, yt-icon-button") || [])
	    );
	    const closeButton = closeCandidates.find((node) => {
	      const label = `${node.id || ""} ${node.getAttribute?.("aria-label") || ""} ${node.getAttribute?.("title") || ""} ${node.textContent || ""}`.toLowerCase();
	      return /dismiss|close|hide|kapat|gizle/.test(label);
	    });
	    if (closeButton) {
	      closeButton.click();
	      await sleep(250);
	    }
	  }

	  function hasVisibleTranscriptPanel() {
	    return getTranscriptPanelContainers().some(isVisible);
	  }

	  function findTranscriptButton() {
	    const candidates = [
	      ...queryDeep("ytd-video-description-transcript-section-renderer button"),
	      ...queryDeep("ytd-video-description-transcript-section-renderer [role='button']"),
	      ...queryDeep("[target-id*='PAmodern_transcript'] button"),
	      ...queryDeep("[target-id*='transcript'] button"),
	      ...queryDeep("button"),
	      ...queryDeep('[role="button"]')
	    ];
    return candidates.find((button) => {
      const label = `${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`.toLowerCase();
      return /transcript|transkript|transcripción|transcription|show transcript|metni göster/.test(label);
    });
  }

	  function getTranscriptPanelNodes() {
	    const transcriptSelectors = [
	      "ytd-engagement-panel-section-list-renderer[target-id*='PAmodern_transcript'] transcript-segment-view-model",
	      "ytd-engagement-panel-section-list-renderer[target-id*='transcript'] transcript-segment-view-model",
	      "ytd-engagement-panel-section-list-renderer[target-id*='PAmodern_transcript'] [class*='TranscriptSegment']",
	      "ytd-engagement-panel-section-list-renderer[target-id*='transcript'] [class*='TranscriptSegment']",
	      "transcript-segment-view-model.ytwTranscriptSegmentViewModelHost",
	      "transcript-segment-view-model",
	      ".ytwTranscriptSegmentViewModelHost",
	      "ytd-transcript-segment-renderer",
	      "yt-transcript-segment-renderer",
	      "ytd-transcript-segment-list-renderer button",
      "ytd-engagement-panel-section-list-renderer button",
	      "ytd-engagement-panel-section-list-renderer [role='button']",
	      "[class*='transcript'] button",
	      "[class*='transcript'] [role='button']",
	      "[id*='transcript'] button",
	      "[id*='transcript'] [role='button']",
	      "[class*='ytwTranscriptSegmentViewModel']"
	    ];
	    const knownNodes = transcriptSelectors.flatMap((selector) => queryDeep(selector));
	    const timestampRows = [...queryDeep("button"), ...queryDeep('[role="button"]'), ...queryDeep("[aria-label]")]
      .filter((node) => looksLikeTranscriptRow(getNodeText(node)));
    return [
      ...new Set([...knownNodes, ...timestampRows])
    ];
  }

	  function getTranscriptPanelContainers() {
	    return [
	      ...queryDeep("ytd-engagement-panel-section-list-renderer[target-id*='PAmodern_transcript']"),
	      ...queryDeep("ytd-engagement-panel-section-list-renderer[target-id*='transcript']"),
	      ...queryDeep("ytd-transcript-renderer"),
	      ...queryDeep("[class*='transcript']")
	    ].filter((node) => node && node.getBoundingClientRect);
	  }

	  function looksLikeTranscriptRow(text) {
	    text = String(text || "").replace(/\s+/g, " ").trim();
	    if (text.length < 14) return false;
	    if (/\sof\s+\d+\s+(?:hours?|minutes?|seconds?)/i.test(text)) return false;
	    if (isTranscriptUiText(text)) return false;
	    if (/^\d{1,2}:\d{2}(?::\d{2})?\s+\S/.test(text)) return true;
	    return /^(?:\d+\s*(?:hours?|hrs?|hr|saat),?\s*(?:and\s+)?)?(?:\d+\s*(?:minutes?|mins?|min|dakika|dk),?\s*(?:and\s+)?)?\d+\s*(?:seconds?|secs?|sec|saniye|sn)\s+\S/i.test(text);
	  }

	  function extractTimestampText(value) {
	    const text = String(value || "").trim();
	    return (
	      text.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/)?.[0] ||
	      text.match(/^(?:\d+\s*(?:hours?|hrs?|hr|saat),?\s*(?:and\s+)?)?(?:\d+\s*(?:minutes?|mins?|min|dakika|dk),?\s*(?:and\s+)?)?\d+\s*(?:seconds?|secs?|sec|saniye|sn)/i)?.[0] ||
	      ""
	    );
	  }

	  function parseTranscriptNode(node) {
	    const explicitText =
	      node.querySelector?.([
	        ".segment-text",
	        ".ytwTranscriptSegmentViewModelText",
	        "[class*='SegmentText']",
	        "[class*='segment-text']",
	        "#segment-text",
	        "span.ytAttributedStringHost[role='text']",
	        "yt-formatted-string"
	      ].join(","))?.textContent || "";
	    const explicitTime =
	      node.querySelector?.([
	        ".segment-timestamp",
	        ".ytwTranscriptSegmentViewModelTimestamp",
	        "[class*='timestamp']",
	        "[class*='Timestamp']",
	        "#timestamp",
	        "#segment-start-offset",
	        "[id*='timestamp']",
	        "[id*='start-offset']"
	      ].join(","))?.textContent?.trim() || "";
	    const fullText = getNodeText(node);
	    const rawText = (explicitText || fullText).replace(/\s+/g, " ").trim();
	    const timeText = explicitTime || extractTimestampText(fullText) || extractTimestampText(rawText);
	    const start = parseTimestamp(timeText);
	    const cleanText = timeText ? rawText.replace(timeText, "").replace(/^[-–—,\s]+/, "").trim() : rawText;
	    if (!Number.isFinite(start) || cleanText.length < 4) return null;
	    if (isTranscriptUiText(cleanText)) return null;
	    return { start, text: cleanText };
	  }

	  function parseTranscriptRowsFromText(text) {
	    const lines = String(text || "")
	      .split(/\n+/)
	      .map((line) => line.replace(/\s+/g, " ").trim())
	      .filter(Boolean);
	    const rows = [];
	    for (let index = 0; index < lines.length; index += 1) {
	      const line = lines[index];
	      const timeText = extractTimestampText(line);
	      if (!timeText || !line.startsWith(timeText)) continue;
	      const start = parseTimestamp(timeText);
	      if (!Number.isFinite(start)) continue;
	      let textLine = line.replace(timeText, "").replace(/^[-–—,\s]+/, "").trim();
	      if (textLine.length < 4 && lines[index + 1] && !extractTimestampText(lines[index + 1])) {
	        textLine = lines[index + 1];
	        index += 1;
	      }
	      if (textLine.length < 4 || isTranscriptUiText(textLine)) continue;
	      rows.push({ start, text: textLine });
	    }
	    return rows;
	  }

	  function scrollTranscriptPanel(nodes) {
	    const autoHidden = document.documentElement.classList.contains("asai-auto-transcript-hidden");
	    const panel = getTranscriptPanelContainers().find((node) => isVisible(node) || autoHidden);
	    const scrollables = panel
	      ? [
	          panel,
	          ...panel.querySelectorAll?.("#content, #contents, #segments-container, yt-section-list-renderer, ytd-transcript-segment-list-renderer, [style*='overflow']")
	        ]
	      : [];
	    const scroller = scrollables.find((node) => node.scrollHeight > node.clientHeight + 20);
	    if (scroller) scroller.scrollTop = scroller.scrollHeight;
	    else if (nodes.length && !autoHidden) nodes[nodes.length - 1].scrollIntoView({ block: "end" });
	  }

	  function isTranscriptUiText(text) {
	    return /^(?:chapter|chapters|like|dislike|share|save|reply|sort by|search|load|open|hide|more actions|description|comments|autoplay|settings|subtitles|transcript|show transcript|show less|show more|download|clip|thanks|join|subscribe|abone|begeni|beğeni|paylaş|kaydet|yanıtla|ara|aç|gizle|daha fazla|metni göster)\b/i.test(String(text || "").trim());
	  }

	  function isVisible(node) {
	    if (!node || !node.getBoundingClientRect) return false;
	    const box = node.getBoundingClientRect();
	    return box.width > 0 && box.height > 0;
	  }

  function getNodeText(node) {
    return `${node.getAttribute?.("aria-label") || ""} ${node.textContent || ""}`.replace(/\s+/g, " ").trim();
  }

  function queryDeep(selector, root = document) {
    const results = [];
    const seenRoots = new Set();
    walkRoot(root);
    return results;

    function walkRoot(currentRoot) {
      if (!currentRoot || seenRoots.has(currentRoot)) return;
      seenRoots.add(currentRoot);
      try {
        results.push(...currentRoot.querySelectorAll(selector));
      } catch {
        return;
      }
      const all = currentRoot.querySelectorAll("*");
      for (const node of all) {
        if (node.shadowRoot) walkRoot(node.shadowRoot);
      }
    }
  }

  function parseTimestamp(value) {
    const text = String(value || "").trim();
    if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(text)) {
      const parts = text.split(":").map((part) => Number(part));
      if (!parts.length || parts.some((part) => !Number.isFinite(part))) return NaN;
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
	    const hours = Number(text.match(/(\d+)\s*(?:hours?|hrs?|hr|saat)\b/i)?.[1] || 0);
	    const minutes = Number(text.match(/(\d+)\s*(?:minutes?|mins?|min|dakika|dk)\b/i)?.[1] || 0);
	    const seconds = Number(text.match(/(\d+)\s*(?:seconds?|secs?|sec|saniye|sn)\b/i)?.[1] || 0);
	    if (hours || minutes || seconds) return hours * 3600 + minutes * 60 + seconds;
	    return NaN;
	  }

	  function sleep(ms) {
	    return new Promise((resolve) => window.setTimeout(resolve, ms));
	  }

  function extractVideoMetadata(playerResponse) {
    const details = playerResponse?.videoDetails || {};
    const microformat = playerResponse?.microformat?.playerMicroformatRenderer || {};
    const description = compactText(details.shortDescription || microformat.description?.simpleText || textFromRuns(microformat.description?.runs), 1800);
    const chapters = uniqueChapters([
      ...extractChaptersFromPlayerResponse(playerResponse),
      ...extractTimestampChapters(description)
    ]);
    const keywords = Array.isArray(details.keywords) ? details.keywords : [];
    return {
      title: compactText(details.title || microformat.title?.simpleText || textFromRuns(microformat.title?.runs), 180),
      channel: compactText(details.author || microformat.ownerChannelName || "", 120),
      channelId: compactText(details.channelId || microformat.externalChannelId || "", 80),
      category: compactText(microformat.category || "", 80),
      publishDate: compactText(microformat.publishDate || "", 24),
      uploadDate: compactText(microformat.uploadDate || "", 24),
      isLive: Boolean(details.isLiveContent || microformat.liveBroadcastDetails),
      keywords: keywords.map((item) => compactText(item, 48)).filter(Boolean).slice(0, 16),
      descriptionExcerpt: compactText(description, 900),
      descriptionSignals: extractDescriptionSignals(description),
      chapters: chapters.slice(0, 40)
    };
  }

  function summarizeCaptionTrack(track, format) {
    const name = textFromRuns(track.name?.runs) || track.name?.simpleText || "";
    return {
      source: "timedtext",
      format,
      language: track.languageCode || "",
      vssId: track.vssId || "",
      kind: track.kind === "asr" ? "asr" : "manual",
      name: compactText(name, 80),
      isTranslatable: Boolean(track.isTranslatable)
    };
  }

  function extractDescriptionSignals(description) {
    const lines = String(description || "")
      .split(/\n+/)
      .map((line) => compactText(line, 180))
      .filter(Boolean);
    const timestampLines = lines.filter((line) => /^\s*(?:\d{1,2}:)?\d{1,2}:\d{2}\b/.test(line)).slice(0, 24);
    const sponsorMarkers = lines
      .filter((line) => /sponsor|sponsored|promo|coupon|affiliate|discount|merch|newsletter|subscribe|abone|indirim/i.test(line))
      .slice(0, 10);
    return {
      timestampLines,
      sponsorMarkers,
      hasRepoLink: /github\.com|gitlab\.com|repo|repository|source code|code/i.test(description),
      hasSourceLinks: /(?:sources?|references?|links?)\s*:/i.test(description)
    };
  }

  function extractTimestampChapters(text) {
    return String(text || "")
      .split(/\n+/)
      .map((line) => {
        const match = line.match(/^\s*((?:\d{1,2}:)?\d{1,2}:\d{2})\s+(.{2,120})$/);
        if (!match) return null;
        const start = parseTimestamp(match[1]);
        if (!Number.isFinite(start)) return null;
        return { start, title: compactText(match[2], 80), source: "description" };
      })
      .filter(Boolean);
  }

  function extractChaptersFromPlayerResponse(playerResponse) {
    const chapters = [];
    walkJson(playerResponse, (node) => {
      const renderer = node?.chapterRenderer || node?.macroMarkersListItemRenderer;
      if (!renderer) return;
      const title = compactText(
        renderer.title?.simpleText || textFromRuns(renderer.title?.runs) || renderer.title || "",
        80
      );
      const start = Number(
        renderer.timeRangeStartMillis !== undefined
          ? Number(renderer.timeRangeStartMillis) / 1000
          : renderer.onTap?.watchEndpoint?.startTimeSeconds ?? renderer.navigationEndpoint?.watchEndpoint?.startTimeSeconds
      );
      if (title && Number.isFinite(start)) chapters.push({ start, title, source: "player" });
    });
    return chapters;
  }

  function uniqueChapters(chapters) {
    const seen = new Set();
    return chapters
      .sort((a, b) => a.start - b.start)
      .filter((chapter) => {
        const key = `${Math.round(chapter.start)}:${chapter.title.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function walkJson(root, visit, depth = 0, seen = new WeakSet()) {
    if (!root || typeof root !== "object" || depth > 8 || seen.has(root)) return;
    seen.add(root);
    visit(root);
    if (Array.isArray(root)) {
      for (const item of root) walkJson(item, visit, depth + 1, seen);
      return;
    }
    for (const value of Object.values(root)) walkJson(value, visit, depth + 1, seen);
  }

  function textFromRuns(runs) {
    return Array.isArray(runs) ? runs.map((run) => run.text || "").join("").replace(/\s+/g, " ").trim() : "";
  }

  function compactText(value, max = 240) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= max) return text;
    return text.slice(0, max - 1).trimEnd();
  }

	  async function getPlayerResponse() {
    const fromBridge = await requestPlayerResponseFromBridge();
    if (fromBridge) return fromBridge;

    const fromScripts = findPlayerResponseInDocument(document);
    if (fromScripts) return fromScripts;

    const html = await fetch(location.href, { credentials: "include" }).then((response) => response.text());
    const doc = new DOMParser().parseFromString(html, "text/html");
    const fromFetched = findPlayerResponseInDocument(doc);
    if (fromFetched) return fromFetched;
    throw new Error("Could not read YouTube player response.");
  }

  function requestPlayerResponseFromBridge() {
    return new Promise((resolve) => {
      const requestId = `${Date.now()}-${Math.random()}`;
      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", onMessage);
        resolve(null);
      }, 1200);
      function onMessage(event) {
        if (event.source !== window) return;
        if (event.data?.source !== "adaptive-speed-ai-bridge") return;
        if (event.data?.type !== "PLAYER_RESPONSE") return;
        if (event.data?.requestId !== requestId) return;
        window.clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
        resolve(event.data.response || null);
      }
      window.addEventListener("message", onMessage);
      window.postMessage({ source: "adaptive-speed-ai-content", type: "REQUEST_PLAYER_RESPONSE", requestId }, "*");
    });
  }

  function findPlayerResponseInDocument(doc) {
    const scripts = [...doc.querySelectorAll("script")].map((script) => script.textContent || "");
    for (const text of scripts) {
      const direct = extractJsonAfterMarker(text, "ytInitialPlayerResponse");
      if (direct) return direct;

      const quoted = extractPlayerResponseFromYtcfg(text);
      if (quoted) return quoted;
    }
    return null;
  }

  function extractPlayerResponseFromYtcfg(text) {
    const lower = text.indexOf("player_response");
    const upper = text.indexOf("PLAYER_RESPONSE");
    const index = lower >= 0 ? lower : upper;
    if (index < 0) return null;
    const start = text.indexOf("{", index);
    if (start < 0) return null;
    const json = extractBalancedObject(text, start);
    if (!json) return null;
    try {
      return JSON.parse(json);
    } catch {
      try {
        return JSON.parse(JSON.parse(`"${json.replace(/"/g, '\\"')}"`));
      } catch {
        return null;
      }
    }
  }

  function extractJsonAfterMarker(text, marker) {
    const index = text.indexOf(marker);
    if (index < 0) return null;
    const start = text.indexOf("{", index);
    if (start < 0) return null;
    const json = extractBalancedObject(text, start);
    if (!json) return null;
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function extractBalancedObject(text, start) {
    let depth = 0;
    let inString = false;
    let quote = "";
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) inString = false;
      } else if (char === '"' || char === "'") {
        inString = true;
        quote = char;
      } else if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) return text.slice(start, index + 1);
      }
    }
    return "";
  }

	  function getVideoId() {
	    const url = new URL(location.href);
	    if (url.hostname.includes("youtube.com")) return url.searchParams.get("v") || "";
	    return "";
	  }

  function getEntryContext() {
    const url = new URL(location.href);
    const referrer = safeUrl(document.referrer);
    const searchQuery =
      referrer?.hostname?.includes("youtube.com") && referrer.pathname === "/results"
        ? compactText(referrer.searchParams.get("search_query") || "", 160)
        : "";
    return {
      list: compactText(url.searchParams.get("list") || "", 80),
      index: compactText(url.searchParams.get("index") || "", 12),
      startSeconds: parseUrlTime(url.searchParams.get("t") || url.searchParams.get("start") || ""),
      searchQuery
    };
  }

  function safeUrl(value) {
    try {
      return value ? new URL(value) : null;
    } catch {
      return null;
    }
  }

  function parseUrlTime(value) {
    value = String(value || "").trim();
    if (!value) return 0;
    if (/^\d+$/.test(value)) return Number(value);
    const hours = Number(value.match(/(\d+)h/i)?.[1] || 0);
    const minutes = Number(value.match(/(\d+)m/i)?.[1] || 0);
    const seconds = Number(value.match(/(\d+)s/i)?.[1] || 0);
    return hours * 3600 + minutes * 60 + seconds;
  }

	  function getVideoTitle() {
    return (
      document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent?.trim() ||
      document.querySelector("h1.title")?.textContent?.trim() ||
      document.title.replace(/ - YouTube$/i, "").trim()
    );
  }

  function getVideo() {
    return document.querySelector("video.html5-main-video") || document.querySelector("video");
  }

  function attachVideoListeners(video) {
    if (!video || STATE.observedVideo === video) return;
    STATE.observedVideo = video;
    video.addEventListener("ratechange", () => {
      if (STATE.applyingRate) return;
      if (Math.abs(video.playbackRate - STATE.lastAppliedRate) < 0.05) return;
      STATE.manualHoldUntil = Date.now() + 45_000;
      STATE.lastAppliedRate = video.playbackRate;
      updateStatus("Manual speed hold");
    });
	    video.addEventListener("seeking", () => {
	      STATE.rateCooldownUntil = Date.now() + 1200;
	      resetSavingsTracker(video);
	    });
	    video.addEventListener("waiting", () => {
	      STATE.rateCooldownUntil = Date.now() + 1200;
	      resetSavingsTracker(video);
	    });
	    video.addEventListener("playing", () => resetSavingsTracker(video));
	    video.addEventListener("timeupdate", () => trackSavedTime(video, Date.now()));
	    video.addEventListener("pause", () => {
	      resetSavingsTracker(video);
	      void flushSavedTime();
	    });
	    video.addEventListener("ended", () => void flushSavedTime());
	  }

	  function createOverlay() {
	    overlay = document.createElement("div");
	    overlay.className = "asai-controls";
	    overlay.innerHTML = `
	      <label class="asai-switch" title="Toggle adaptive speed">
	        <input class="asai-toggle" type="checkbox" />
	        <span></span>
	      </label>
	      <strong class="asai-brand" title="AI Speed" aria-label="AI Speed">
	        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-2 8 9-12h-7l2-8Z"></path></svg>
	      </strong>
	      <span class="asai-rate">1x</span>
	      <select class="asai-mode" title="Speed mode">
	        <option value="calm" title="Calm">C</option>
	        <option value="reasonable" title="Reasonable">R</option>
	        <option value="aggressive" title="Aggressive">A</option>
	      </select>
	      <button class="asai-goal-button" type="button" title="Set goal for this video" aria-label="Set goal for this video">
	        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9h-3a6 6 0 1 1-6-6V3Z"></path><path d="M12 8a4 4 0 1 0 4 4h-3a1 1 0 1 1-1-1V8Z"></path><path d="M15 3h6v6h-2V6.4l-6.1 6.1-1.4-1.4L17.6 5H15V3Z"></path></svg>
	      </button>
	      <span class="asai-savings">S: --</span>
	      <button class="asai-analyze" type="button" aria-label="Analyze current video">
	        <svg class="asai-analyze-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 4.4 12.4l3.1 3.1 1.5-1.5-3.1-3.1A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"></path></svg>
	      </button>
	      <div class="asai-goal-popover" hidden>
	        <label>
	          <span>Watching for</span>
	          <select class="asai-goal-mode">
	            <option value="auto">Auto infer</option>
	            <option value="learn">Learn deeply</option>
	            <option value="find_answer">Find answer</option>
	            <option value="follow_steps">Follow steps</option>
	            <option value="skim">Skim</option>
	            <option value="evaluate_claims">Evaluate claims</option>
	            <option value="enjoy">Enjoy / normal watch</option>
	          </select>
	        </label>
	        <label>
	          <span>Specific goal</span>
	          <input class="asai-goal-text" type="text" maxlength="180" placeholder="What do you want from this video?" />
	        </label>
	        <div class="asai-goal-actions">
	          <button class="asai-goal-cancel" type="button">Close</button>
	          <button class="asai-goal-apply" type="button">Apply</button>
	        </div>
	      </div>
	    `;
	    document.documentElement.appendChild(overlay);
	    rateEl = overlay.querySelector(".asai-rate");
	    savingsEl = overlay.querySelector(".asai-savings");
	    toggleEl = overlay.querySelector(".asai-toggle");
	    modeEl = overlay.querySelector(".asai-mode");
	    analyzeButton = overlay.querySelector(".asai-analyze");
    goalButton = overlay.querySelector(".asai-goal-button");
    goalPopover = overlay.querySelector(".asai-goal-popover");
    goalModeEl = overlay.querySelector(".asai-goal-mode");
    goalTextEl = overlay.querySelector(".asai-goal-text");
    goalApplyButton = overlay.querySelector(".asai-goal-apply");
    goalCancelButton = overlay.querySelector(".asai-goal-cancel");

		    toggleEl.addEventListener("change", () => void setEnabledState(toggleEl.checked, { persist: true }));
	    modeEl.addEventListener("change", () => void handleModeChange());
	    analyzeButton.addEventListener("click", () => void analyzeCurrentVideo({ force: true }));
    goalButton.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleGoalPopover();
    });
    goalApplyButton.addEventListener("click", () => void applyGoalPopover());
    goalCancelButton.addEventListener("click", () => closeGoalPopover());
    goalPopover.addEventListener("click", (event) => event.stopPropagation());
    document.addEventListener("click", () => closeGoalPopover());
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeGoalPopover();
    });
	    mountControls();
	    mountNativePlanBar();
	  }

	  async function handleModeChange() {
	    STATE.speedMode = normalizeSpeedMode(modeEl.value);
	    updateModeTitle();
	    await sendMessage({ type: "saveSettings", settings: { speedMode: STATE.speedMode } });
	    STATE.plannedSavings = calculatePlanSavings(STATE.plan, Number(getVideo()?.duration) || STATE.duration);
	    renderPlanBar();
	    updateSavingsUI();
	    if (STATE.segments.length && !STATE.analyzing) void analyzeCurrentVideo({ force: true });
	  }

  function toggleGoalPopover() {
    if (!goalPopover) return;
    const willOpen = goalPopover.hidden;
    if (willOpen) {
      updateGoalPopoverValues();
      goalPopover.hidden = false;
      goalTextEl?.focus();
      goalTextEl?.select();
    } else {
      closeGoalPopover();
    }
  }

  function closeGoalPopover() {
    if (goalPopover) goalPopover.hidden = true;
  }

  async function applyGoalPopover() {
    STATE.viewerGoalMode = normalizeViewerGoalMode(goalModeEl?.value || "auto");
    STATE.viewerGoalText = String(goalTextEl?.value || "").replace(/\s+/g, " ").trim().slice(0, 180);
    STATE.viewerGoalTouched = true;
    closeGoalPopover();
    updateGoalButton();
    if (STATE.enabled && STATE.videoId) {
      try {
        await analyzeCurrentVideo({ force: true });
      } catch (error) {
        updateStatus(error.message || "Goal saved. Analyze failed.");
      }
    } else {
      updateStatus("Goal set for this video");
    }
  }

	  function updateGoalPopoverValues() {
    if (goalModeEl) goalModeEl.value = STATE.viewerGoalMode || "auto";
    if (goalTextEl) goalTextEl.value = STATE.viewerGoalText || "";
  }

  function updateModeTitle() {
    if (!modeEl) return;
    const labels = { calm: "Calm", reasonable: "Reasonable", aggressive: "Aggressive" };
    modeEl.title = `Speed mode: ${labels[STATE.speedMode] || "Reasonable"}`;
    modeEl.setAttribute("aria-label", modeEl.title);
  }

  function updateGoalButton() {
    if (!goalButton) return;
    const labels = {
      auto: "Auto infer",
      learn: "Learn deeply",
      find_answer: "Find answer",
      follow_steps: "Follow steps",
      skim: "Skim",
      evaluate_claims: "Evaluate claims",
      enjoy: "Enjoy / normal watch"
    };
    const label = labels[STATE.viewerGoalMode] || "Set goal";
    goalButton.classList.toggle("asai-goal-active", STATE.viewerGoalMode !== "auto" || Boolean(STATE.viewerGoalText));
    goalButton.title = STATE.viewerGoalText
      ? `${label}: ${STATE.viewerGoalText}`
      : `Goal: ${label}`;
    goalButton.setAttribute("aria-label", goalButton.title);
  }

	  function mountControls() {
	    if (!overlay) return;
	    const secondaryMount = findSecondaryControlsMount();
	    if (secondaryMount?.host) {
	      try {
	        if (overlay.parentElement !== secondaryMount.host) {
	          secondaryMount.host.insertBefore(overlay, secondaryMount.before || null);
	        } else if (secondaryMount.before && overlay.nextElementSibling !== secondaryMount.before) {
	          secondaryMount.host.insertBefore(overlay, secondaryMount.before);
	        }
	        overlay.classList.add("asai-mounted", "asai-secondary-mounted");
	        return;
	      } catch {
	        overlay.classList.remove("asai-secondary-mounted");
	      }
	    }

	    const host =
	      document.querySelector("ytd-watch-metadata #top-row") ||
	      document.querySelector("#above-the-fold #top-row") ||
	      document.querySelector("ytd-watch-metadata #owner")?.parentElement;
	    if (!host) return;
	    const actions = host.querySelector("#actions");
	    if (overlay.parentElement !== host) {
	      host.insertBefore(overlay, actions || null);
	    }
	    overlay.classList.add("asai-mounted");
	    overlay.classList.remove("asai-secondary-mounted");
	  }

	  function findSecondaryControlsMount() {
	    const secondary =
	      document.querySelector("ytd-watch-flexy #secondary-inner") ||
	      document.querySelector("ytd-watch-flexy #secondary") ||
	      document.querySelector("#secondary-inner") ||
	      document.querySelector("#secondary");
	    if (!secondary || !isVisible(secondary)) return null;

	    return { host: secondary, before: firstSecondaryChild(secondary) };
	  }

	  function firstSecondaryChild(parent) {
	    return (
	      [...parent.children].find(
	        (node) => node !== overlay && !node.matches("script, style, template, link")
	      ) || null
	    );
	  }

	  function mountNativePlanBar() {
	    const progress =
	      document.querySelector(".html5-video-player .ytp-progress-bar-container") ||
	      document.querySelector(".html5-video-player .ytp-progress-bar .ytp-progress-list") ||
	      document.querySelector(".html5-video-player .ytp-progress-list") ||
	      document.querySelector(".html5-video-player .ytp-progress-bar");
	    if (!progress) return;
	    let changed = false;
	    if (!barEl) {
	      barEl = document.createElement("div");
	      barEl.className = "asai-native-plan-bar";
	      changed = true;
	    }
	    if (barEl.parentElement !== progress) {
	      progress.appendChild(barEl);
	      changed = true;
	    }
	    if (changed) renderPlanBar();
	  }

	  function updateStatus(text) {
	    STATE.status = text;
	    if (analyzeButton && !STATE.analyzing) {
	      analyzeButton.title = text;
	      analyzeButton.setAttribute("aria-label", `Analyze. ${text}`);
	    }
	    updateSavingsUI();
	  }

	  function renderPlanBar() {
	    if (!barEl) return;
	    barEl.innerHTML = "";
	    barEl.classList.toggle("asai-has-plan", STATE.plan.length > 0);
	    if (!STATE.plan.length) return;
	    const duration = STATE.duration || STATE.plan[STATE.plan.length - 1].end || 1;
    for (const segment of STATE.plan) {
      const speed = effectiveSegmentSpeed(segment);
      const piece = document.createElement("span");
      piece.className = `asai-piece asai-speed-${String(speed).replace(".", "_")}`;
      piece.style.left = `${(segment.start / duration) * 100}%`;
      piece.style.width = `${Math.max(0.08, ((segment.end - segment.start) / duration) * 100)}%`;
      piece.style.background = speedColor(speed);
      piece.title = `${speed}x ${segment.importance || ""} ${segment.reason || ""}`.trim();
      barEl.appendChild(piece);
    }
  }

	  function updateActiveBar(time) {
	    if (!barEl) return;
	    const duration = STATE.duration || getVideo()?.duration || 1;
	    barEl.style.setProperty("--asai-progress", `${Math.max(0, Math.min(100, (time / duration) * 100))}%`);
	  }

	  function calculatePlanSavings(plan, duration) {
	    if (!Array.isArray(plan) || !plan.length) return 0;
	    const total = Number(duration) || plan[plan.length - 1]?.end || 0;
	    let adaptiveSeconds = 0;
	    for (const segment of plan) {
	      const start = Math.max(0, Number(segment.start) || 0);
	      const end = Math.min(total || Infinity, Number(segment.end) || start);
	      const speed = effectiveSegmentSpeed(segment);
	      if (end > start) adaptiveSeconds += (end - start) / speed;
	    }
	    return Math.max(0, (total || 0) - adaptiveSeconds);
	  }

	  function resetSavingsTracker(video) {
	    STATE.lastSavingsTick = Date.now();
	    STATE.lastSavingsVideoTime = Number(video?.currentTime) || 0;
	  }

	  function trackSavedTime(video, now) {
	    const currentTime = Number(video.currentTime) || 0;
	    if (STATE.lastSavingsVideoTime === null) {
	      STATE.lastSavingsTick = now;
	      STATE.lastSavingsVideoTime = currentTime;
	      return;
	    }
	    const mediaDelta = currentTime - STATE.lastSavingsVideoTime;
	    STATE.lastSavingsTick = now;
	    STATE.lastSavingsVideoTime = currentTime;
	    if (
	      !STATE.enabled ||
	      (!STATE.plan.length && STATE.defaultRate <= 1) ||
	      now < STATE.manualHoldUntil ||
	      video.paused ||
	      video.ended ||
	      mediaDelta <= 0
	    ) {
	      return;
	    }
	    if (mediaDelta > 8) return;

	    const rate = Math.max(1, Number(video.playbackRate) || 1);
	    const saved = mediaDelta * Math.max(0, 1 - 1 / rate);
	    if (saved <= 0.01) return;

	    STATE.videoSaved += saved;
	    STATE.totalSaved += saved;
	    STATE.pendingSaved += saved;
	    updateSavingsUI();
	    if (STATE.pendingSaved >= 2 || now - STATE.lastSavingsFlush > 5000) void flushSavedTime();
	  }

	  async function flushSavedTime() {
	    if (!STATE.pendingSaved || !STATE.videoId) return;
	    const seconds = STATE.pendingSaved;
	    STATE.pendingSaved = 0;
	    STATE.lastSavingsFlush = Date.now();
	    try {
	      const response = await sendMessage({
	        type: "addSavedTime",
	        payload: { videoId: STATE.videoId, seconds }
	      });
	      const stats = response.result || {};
	      STATE.totalSaved = Number(stats.totalSavedSeconds) || STATE.totalSaved;
	      if (stats.videos?.[STATE.videoId] !== undefined) {
	        STATE.videoSaved = Math.max(STATE.videoSaved, Number(stats.videos[STATE.videoId]) || 0);
	      }
	      updateSavingsUI();
	    } catch {
	      STATE.pendingSaved += seconds;
	    }
	  }

	  async function refreshUsageStats() {
	    try {
	      const response = await sendMessage({ type: "getUsageStats" });
	      const stats = response.result || {};
	      STATE.totalSaved = Math.max(0, Number(stats.totalSavedSeconds) || 0);
	      if (STATE.videoId && stats.videos?.[STATE.videoId] !== undefined) {
	        STATE.videoSaved = Math.max(STATE.videoSaved, Number(stats.videos[STATE.videoId]) || 0);
	      }
	      updateSavingsUI();
	    } catch {
	      // Statistics are non-critical; playback should keep working without them.
	    }
	  }

	  function updateSavingsUI() {
	    if (rateEl && getVideo()) rateEl.textContent = `${round(getVideo().playbackRate || 1, 2)}x`;
	    if (savingsEl) {
	      const planned = STATE.plannedSavings ? formatDuration(STATE.plannedSavings) : "--";
	      const saved = STATE.videoSaved ? formatDuration(STATE.videoSaved) : "0:00";
	      savingsEl.textContent = `S: ${planned}`;
	      savingsEl.title = `Plan saves ${planned}. This video saved so far: ${saved}. Total saved: ${formatDuration(STATE.totalSaved)}.`;
	    }
	  }

	  function setAnalyzeButtonBusy(busy) {
	    if (!analyzeButton) return;
	    analyzeButton.disabled = busy;
	    analyzeButton.classList.toggle("asai-busy", busy);
	    analyzeButton.title = busy ? "Analyzing transcript and speed plan" : STATE.status || "Analyze current video";
	    analyzeButton.setAttribute("aria-label", analyzeButton.title);
	  }

	  function effectiveSegmentSpeed(segment) {
	    const raw = normalizeRate(segment?.speed, STATE.defaultRate);
	    return normalizeRate(clamp(raw, STATE.defaultRate, STATE.maxRate), STATE.defaultRate);
	  }

	  function normalizeRate(value, fallback) {
	    const numeric = Number(value);
	    const raw = Number.isFinite(numeric) ? numeric : fallback;
	    const allowed = [1, 1.15, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5, 4];
	    const clamped = clamp(raw, 1, 4);
	    return allowed.reduce((best, rate) => (Math.abs(rate - clamped) < Math.abs(best - clamped) ? rate : best), 1);
	  }

	  function normalizeSpeedMode(value) {
	    return ["calm", "reasonable", "aggressive"].includes(value) ? value : "reasonable";
	  }

  function normalizeViewerGoalMode(value) {
    return ["auto", "learn", "find_answer", "follow_steps", "skim", "evaluate_claims", "enjoy"].includes(value)
      ? value
      : "auto";
  }

	  function legacySpeedMode(value) {
	    if (value === "conservative") return "calm";
	    if (value === "aggressive") return "aggressive";
	    return "reasonable";
	  }

	  function speedColor(speed) {
	    if (speed <= 1.1) return "#48b18c";
	    if (speed <= 1.3) return "#94ba5a";
	    if (speed <= 1.55) return "#e0ad42";
	    if (speed <= 1.9) return "#ec7245";
	    if (speed <= 2.4) return "#df4e5b";
	    if (speed <= 3.1) return "#ad6df2";
	    return "#63a4ff";
	  }

	  function clamp(value, min, max) {
	    return Math.max(min, Math.min(max, value));
	  }

	  function formatDuration(seconds) {
	    seconds = Math.max(0, Math.round(Number(seconds) || 0));
	    const hours = Math.floor(seconds / 3600);
	    const minutes = Math.floor((seconds % 3600) / 60);
	    const rest = seconds % 60;
	    if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
	    return `${minutes}:${String(rest).padStart(2, "0")}`;
	  }

	  function sendMessage(message) {
    return chrome.runtime.sendMessage(message).then((response) => {
      if (!response?.ok) throw new Error(response?.error || "Extension message failed");
      return response;
    });
  }

  function round(value, digits) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }
})();
