chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "mel-fetch-json") return false;

  fetch(message.url, {
    headers: { Accept: "application/json" },
    cache: "no-cache"
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      sendResponse({ ok: true, payload: await response.json() });
    })
    .catch((error) => {
      sendResponse({ ok: false, error: error.message || String(error) });
    });

  return true;
});
