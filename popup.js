class OptimizedPopupController {
  constructor() {
    this.settings = {
      isEnabled: true,
      blurIntensity: 10,
      whitelist: [],
    };

    this.currentDomain = "";
    this.elements = {};
    this.updateTimeout = null;

    this.cacheElements();
    this.init();
  }

  cacheElements() {
    this.elements = {
      enableToggle: document.getElementById("enableToggle"),
      blurSlider: document.getElementById("blurSlider"),
      blurValue: document.getElementById("blurValue"),
      domainName: document.getElementById("domainName"),
      quickAdd: document.getElementById("quickAdd"),
      domainInput: document.getElementById("domainInput"),
      addDomain: document.getElementById("addDomain"),
      whitelistItems: document.getElementById("whitelistItems"),
    };
  }

  async init() {
    // Load data in parallel
    const [settings, domain] = await Promise.all([
      this.loadSettings(),
      this.getCurrentDomain(),
    ]);

    this.setupEventListeners();
    this.updateUI();
  }

  loadSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "getSettings" }, (settings) => {
        this.settings = {
          isEnabled: settings?.isEnabled !== false,
          blurIntensity: settings?.blurIntensity || 10,
          whitelist: settings?.whitelist || [],
        };
        resolve(this.settings);
      });
    });
  }

  async getCurrentDomain() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.url) {
        this.currentDomain = new URL(tab.url).hostname;
        return this.currentDomain;
      }
    } catch (error) {
      console.warn("Could not get current domain");
    }
    return "";
  }

  setupEventListeners() {
    // Toggle
    this.elements.enableToggle.addEventListener("click", () => {
      this.settings.isEnabled = !this.settings.isEnabled;
      this.debouncedUpdate();
    });

    // Slider with immediate visual feedback
    this.elements.blurSlider.addEventListener("input", (e) => {
      const value = parseInt(e.target.value);
      this.elements.blurValue.textContent = `${value}px blur`;
      this.settings.blurIntensity = value;
      this.debouncedUpdate();
    });

    // Domain input
    this.elements.addDomain.addEventListener("click", () => this.addDomain());
    this.elements.domainInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.addDomain();
    });

    // Quick add
    this.elements.quickAdd.addEventListener("click", () =>
      this.quickAddDomain()
    );
  }

  debouncedUpdate() {
    clearTimeout(this.updateTimeout);

    // Update UI immediately for responsiveness
    this.updateToggleUI();

    // Debounce settings save
    this.updateTimeout = setTimeout(() => {
      this.saveSettings();
    }, 150);
  }

  addDomain() {
    const domain = this.elements.domainInput.value.trim().toLowerCase();
    if (domain && !this.settings.whitelist.includes(domain)) {
      this.settings.whitelist.push(domain);
      this.elements.domainInput.value = "";
      this.updateUI();
      this.saveSettings();
    }
  }

  quickAddDomain() {
    if (
      this.currentDomain &&
      !this.settings.whitelist.includes(this.currentDomain)
    ) {
      this.settings.whitelist.push(this.currentDomain);
      this.updateUI();
      this.saveSettings();
    }
  }

  removeDomain(index) {
    this.settings.whitelist.splice(index, 1);
    this.updateUI();
    this.saveSettings();
  }

  updateUI() {
    this.updateToggleUI();
    this.updateSliderUI();
    this.updateDomainUI();
    this.updateWhitelistUI();
  }

  updateToggleUI() {
    this.elements.enableToggle.classList.toggle(
      "active",
      this.settings.isEnabled
    );
  }

  updateSliderUI() {
    this.elements.blurSlider.value = this.settings.blurIntensity;
    this.elements.blurValue.textContent = `${this.settings.blurIntensity}px blur`;
  }

  updateDomainUI() {
    this.elements.domainName.textContent = this.currentDomain || "Unknown";

    const isAlreadyWhitelisted = this.settings.whitelist.includes(
      this.currentDomain
    );
    this.elements.quickAdd.disabled =
      !this.currentDomain || isAlreadyWhitelisted;
    this.elements.quickAdd.textContent = isAlreadyWhitelisted
      ? "Already Trusted"
      : "Add Current Domain";
  }

  updateWhitelistUI() {
    const container = this.elements.whitelistItems;

    if (this.settings.whitelist.length === 0) {
      container.innerHTML =
        '<div class="empty-state">No trusted domains yet</div>';
      return;
    }

    container.innerHTML = this.settings.whitelist
      .map(
        (domain, index) => `
        <div class="whitelist-item">
          <span class="whitelist-domain">${domain}</span>
          <button class="btn btn-danger" data-index="${index}">Remove</button>
        </div>
      `
      )
      .join("");

    // Attach remove listeners efficiently
    container.addEventListener("click", (e) => {
      if (e.target.classList.contains("btn-danger")) {
        const index = parseInt(e.target.dataset.index);
        this.removeDomain(index);
      }
    });
  }

  saveSettings() {
    chrome.runtime.sendMessage({
      type: "updateSettings",
      settings: this.settings,
    });
  }
}

// Initialize with error handling
try {
  new OptimizedPopupController();
} catch (error) {
  console.error("Popup initialization failed:", error);
}
