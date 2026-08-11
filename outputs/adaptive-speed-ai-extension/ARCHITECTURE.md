# Architecture

## Message boundaries

- `content.js`
  - Runs on YouTube watch pages.
  - Extracts caption tracks from YouTube player response.
  - Sends normalized transcript segments to the background service worker.
  - Applies the returned speed plan to the active HTML video element.

- `background.js`
  - Stores settings, API keys, ChatGPT tokens, pending auth state, and speed-plan cache.
  - Calls BYOK providers and the experimental Codex endpoint.
  - Normalizes and smooths speed plans before returning them to the content script.

- `popup.*`
  - Fast control surface for current tab.

- `options.*`
  - Provider selection, API keys, ChatGPT auth, and playback settings.

## Normalized transcript segment

```json
{
  "start": 12.4,
  "end": 18.2,
  "text": "Transcript text"
}
```

## Normalized speed segment

```json
{
  "start": 12.4,
  "end": 28.2,
  "speed": 1.5,
  "importance": "low",
  "confidence": 0.76,
  "reason": "Intro recap"
}
```

## LLM contract

The background script chunks captions into small transcript windows, derives a local viewer-intent relevance score per chunk, then asks the model to return one item per chunk id:

```json
{
  "videoType": "tutorial_lecture",
  "viewerTask": "learn",
  "planStrategy": "Protect core explanations; accelerate filler and CTAs.",
  "items": [
    {
      "id": 0,
      "speedTier": "base",
      "importance": "high",
      "role": "core",
      "evidence": "concept",
      "confidence": 0.9,
      "reason": "Core explanation"
    }
  ]
}
```

The extension maps semantic tiers to the user's target/max rate, applies deterministic relevance guardrails, clamps rates, fills gaps, smooths short islands, and merges adjacent compatible segments.
