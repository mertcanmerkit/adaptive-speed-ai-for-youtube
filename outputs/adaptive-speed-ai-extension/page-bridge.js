(() => {
  const SOURCE = "adaptive-speed-ai-bridge";

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== "adaptive-speed-ai-content") return;
    if (event.data?.type !== "REQUEST_PLAYER_RESPONSE") return;

    const response = readPlayerResponse();
    window.postMessage(
      {
        source: SOURCE,
        type: "PLAYER_RESPONSE",
        requestId: event.data.requestId,
        response
      },
      "*"
    );
  });

  window.addEventListener("yt-navigate-finish", () => {
    window.postMessage(
      {
        source: SOURCE,
        type: "YOUTUBE_NAVIGATED",
        url: location.href
      },
      "*"
    );
  });

  function readPlayerResponse() {
    try {
      if (window.ytInitialPlayerResponse) return window.ytInitialPlayerResponse;
      const fromYtcfg = window.ytcfg?.get?.("PLAYER_RESPONSE") || window.ytcfg?.data_?.PLAYER_RESPONSE;
      if (fromYtcfg) return typeof fromYtcfg === "string" ? JSON.parse(fromYtcfg) : fromYtcfg;
    } catch {
      return null;
    }
    return null;
  }
})();
