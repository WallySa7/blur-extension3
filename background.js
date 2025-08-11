// Optimized background script with minimal overhead
const DEFAULT_SETTINGS = {
  isEnabled: true,
  blurIntensity: 10,
  whitelist: [],
};

// Cache settings in memory for faster access
let cachedSettings = null;

// Store per-tab blur state (temporary overrides)
let tabBlurState = new Map(); // tabId -> boolean (true = force blur, false = force unblur, undefined = use global settings)

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set(DEFAULT_SETTINGS);
  cachedSettings = DEFAULT_SETTINGS;
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-blur") {
    try {
      // Get the active tab
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!activeTab) return;

      // Toggle the blur state for this tab
      const currentState = tabBlurState.get(activeTab.id);
      const newState = currentState === false ? undefined : false; // Toggle between disabled and default

      if (newState === undefined) {
        tabBlurState.delete(activeTab.id);
      } else {
        tabBlurState.set(activeTab.id, newState);
      }

      // Send message to content script
      chrome.tabs
        .sendMessage(activeTab.id, {
          type: "toggleBlur",
          forceState: newState, // undefined = use global settings, false = force disable, true = force enable
        })
        .catch(() => {
          // Ignore errors for inactive tabs
        });
    } catch (error) {
      console.error("Error handling toggle command:", error);
    }
  }
});

// Clean up tab state when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabBlurState.delete(tabId);
});

// Efficient message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "getSettings":
      if (cachedSettings) {
        const response = { ...cachedSettings };
        // Include per-tab state if available
        if (sender.tab && tabBlurState.has(sender.tab.id)) {
          response.tabForceState = tabBlurState.get(sender.tab.id);
        }
        sendResponse(response);
      } else {
        chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS), (settings) => {
          cachedSettings = { ...DEFAULT_SETTINGS, ...settings };
          const response = { ...cachedSettings };
          // Include per-tab state if available
          if (sender.tab && tabBlurState.has(sender.tab.id)) {
            response.tabForceState = tabBlurState.get(sender.tab.id);
          }
          sendResponse(response);
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
                  tabForceState: tabBlurState.get(tab.id),
                })
                .catch(() => {}) // Ignore errors for inactive tabs
          );

          Promise.allSettled(updatePromises).then(() => {
            sendResponse({ success: true });
          });
        });
      });
      return true;

    case "getTabState":
      // Allow content script to query its tab-specific state
      if (sender.tab) {
        sendResponse({
          tabForceState: tabBlurState.get(sender.tab.id),
        });
      }
      return true;
  }
});
