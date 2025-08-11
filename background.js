// Optimized background script with minimal overhead
const DEFAULT_SETTINGS = {
  isEnabled: true,
  blurIntensity: 10,
  whitelist: [],
};

// Cache settings in memory for faster access
let cachedSettings = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set(DEFAULT_SETTINGS);
  cachedSettings = DEFAULT_SETTINGS;
});

// Efficient message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "getSettings":
      if (cachedSettings) {
        sendResponse(cachedSettings);
      } else {
        chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS), (settings) => {
          cachedSettings = { ...DEFAULT_SETTINGS, ...settings };
          sendResponse(cachedSettings);
        });
      }
      return true;

    case "updateSettings":
      cachedSettings = message.settings;
      chrome.storage.sync.set(message.settings, () => {
        // Efficient tab messaging with error handling
        chrome.tabs.query({}, (tabs) => {
          const updatePromises = tabs.map(
            (tab) =>
              chrome.tabs
                .sendMessage(tab.id, {
                  type: "settingsChanged",
                  settings: message.settings,
                })
                .catch(() => {}) // Ignore errors for inactive tabs
          );

          Promise.allSettled(updatePromises).then(() => {
            sendResponse({ success: true });
          });
        });
      });
      return true;
  }
});
