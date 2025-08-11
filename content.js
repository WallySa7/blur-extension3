(function () {
  "use strict";

  class HighPerformanceBlurShield {
    constructor() {
      this.isEnabled = true;
      this.blurIntensity = 10;
      this.whitelist = [];
      this.currentDomain = location.hostname;
      this.isWhitelisted = false;
      this.hoverBtn = null;
      this.currentTarget = null;
      this.styleSheet = null;
      this.isInitialized = false;

      // Performance optimizations
      this.mutationDebounce = null;
      this.hoverDebounce = null;
      this.intersectionObserver = null;

      // Cache DOM queries
      this.bodyElement = null;

      this.initializeImmediate();
    }

    // CRITICAL: Initialize instantly to prevent image flash
    initializeImmediate() {
      // Create high-priority style injection
      this.injectInstantBlurCSS();

      // Load settings and continue initialization
      this.loadSettingsAndInit();
    }

    injectInstantBlurCSS() {
      // Create stylesheet with maximum priority
      this.styleSheet = document.createElement("style");
      this.styleSheet.textContent = this.generateBlurCSS(this.blurIntensity);

      // Insert as first child for maximum priority
      const target = document.head || document.documentElement;
      target.insertBefore(this.styleSheet, target.firstChild);
    }

    generateBlurCSS(intensity = 10) {
      return `
        img:not(.blur-shield-unblurred):not(.blur-shield-whitelist *),
        picture:not(.blur-shield-unblurred):not(.blur-shield-whitelist *),
        video:not(.blur-shield-unblurred):not(.blur-shield-whitelist *),
        canvas:not(.blur-shield-unblurred):not(.blur-shield-whitelist *),
        svg:not(.blur-shield-unblurred):not(.blur-shield-whitelist *),
        [style*="background-image"]:not(.blur-shield-unblurred):not(.blur-shield-whitelist *) {
          filter: blur(${intensity}px) !important;
          transition: filter 0.2s ease !important;
          transform: translateZ(0);
        }
      `;
    }

    async loadSettingsAndInit() {
      try {
        const settings = await this.getStorageSettings();

        this.isEnabled = settings.isEnabled !== false;
        this.blurIntensity = settings.blurIntensity || 10;
        this.whitelist = settings.whitelist || [];

        // Check whitelist status
        this.isWhitelisted = this.whitelist.some(
          (domain) =>
            this.currentDomain.includes(domain) ||
            domain.includes(this.currentDomain)
        );

        // Apply settings immediately
        this.applySettings();

        // Complete initialization when DOM is ready
        if (document.readyState === "loading") {
          document.addEventListener(
            "DOMContentLoaded",
            () => this.completeInit(),
            { once: true }
          );
        } else {
          this.completeInit();
        }
      } catch (error) {
        console.warn("BlurShield: Settings load failed, using defaults");
        this.completeInit();
      }
    }

    getStorageSettings() {
      return new Promise((resolve) => {
        if (typeof chrome !== "undefined" && chrome.storage) {
          chrome.storage.sync.get(
            ["isEnabled", "blurIntensity", "whitelist"],
            resolve
          );
        } else {
          resolve({});
        }
      });
    }

    applySettings() {
      if (!this.styleSheet) return;

      if (!this.isEnabled || this.isWhitelisted) {
        // Disable all blurring
        this.styleSheet.textContent = "";
        this.addWhitelistClass();
      } else {
        // Update blur intensity
        this.styleSheet.textContent = this.generateBlurCSS(this.blurIntensity);
        this.removeWhitelistClass();
      }
    }

    addWhitelistClass() {
      if (document.documentElement) {
        document.documentElement.classList.add("blur-shield-whitelist");
      }
    }

    removeWhitelistClass() {
      if (document.documentElement) {
        document.documentElement.classList.remove("blur-shield-whitelist");
      }
    }

    completeInit() {
      if (this.isInitialized) return;
      this.isInitialized = true;

      this.bodyElement = document.body;

      if (!this.isEnabled || this.isWhitelisted) return;

      this.setupOptimizedObservers();
      this.setupEventDelegation();
      this.createHoverButton();
      this.setupMessageListener();
    }

    setupOptimizedObservers() {
      // Optimized MutationObserver with debouncing
      const observer = new MutationObserver((mutations) => {
        if (this.mutationDebounce) return;

        this.mutationDebounce = requestAnimationFrame(() => {
          this.processMutations(mutations);
          this.mutationDebounce = null;
        });
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src", "style", "class"],
      });

      // Intersection Observer for large image sets
      this.intersectionObserver = new IntersectionObserver(
        (entries) => this.processIntersection(entries),
        { rootMargin: "50px" }
      );
    }

    processMutations(mutations) {
      const newImages = new Set();

      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              // Element node
              this.collectImages(node, newImages);
            }
          }
        }
      }

      // Process new images efficiently
      if (newImages.size > 0) {
        this.processNewImages(newImages);
      }
    }

    collectImages(element, imageSet) {
      if (this.isImageElement(element)) {
        imageSet.add(element);
      }

      // Use efficient selector for batch collection
      const images = element.querySelectorAll?.(
        'img, picture, video, canvas, svg, [style*="background-image"]'
      );
      if (images) {
        images.forEach((img) => imageSet.add(img));
      }
    }

    processNewImages(images) {
      const fragment = document.createDocumentFragment();

      images.forEach((img) => {
        if (!img.classList.contains("blur-shield-processed")) {
          img.classList.add("blur-shield-processed", "blur-shield-blurred");
          this.intersectionObserver?.observe(img);
        }
      });
    }

    processIntersection(entries) {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (!img.classList.contains("blur-shield-hover-ready")) {
            img.classList.add("blur-shield-hover-ready");
          }
        }
      });
    }

    isImageElement(element) {
      const tagName = element.tagName;
      return (
        tagName === "IMG" ||
        tagName === "PICTURE" ||
        tagName === "VIDEO" ||
        tagName === "CANVAS" ||
        tagName === "SVG" ||
        (element.style?.backgroundImage &&
          element.style.backgroundImage !== "none")
      );
    }

    setupEventDelegation() {
      // Use event delegation for performance
      this.bodyElement?.addEventListener("mouseover", this.handleMouseOver, {
        passive: true,
      });
      this.bodyElement?.addEventListener("mouseout", this.handleMouseOut, {
        passive: true,
      });
      this.bodyElement?.addEventListener("click", this.handleClick, {
        passive: false,
      }); // Not passive for preventDefault
    }

    handleMouseOver = (e) => {
      if (!this.isEnabled || this.isWhitelisted) return;

      const target = e.target;
      if (
        this.isImageElement(target) &&
        !target.classList.contains("blur-shield-unblurred")
      ) {
        this.debouncedShowHover(target, e);
      }
    };

    handleMouseOut = (e) => {
      const target = e.target;
      // Only hide if we're leaving the current target and not entering the button
      if (
        target === this.currentTarget &&
        !e.relatedTarget?.classList?.contains("blur-shield-hover-btn")
      ) {
        this.hideHoverButton();
      }
    };

    handleClick = (e) => {
      // Only handle clicks outside the button for re-blurring
      if (!e.target.closest(".blur-shield-hover-btn")) {
        this.reblurCurrentImage();
        this.hideHoverButton();
      }
    };

    debouncedShowHover(target, event) {
      if (this.hoverDebounce) return;

      this.hoverDebounce = requestAnimationFrame(() => {
        this.showHoverButton(target, event);
        this.hoverDebounce = null;
      });
    }

    createHoverButton() {
      this.hoverBtn = document.createElement("div");
      this.hoverBtn.className = "blur-shield-hover-btn";
      this.hoverBtn.innerHTML = "👁️ Show Image";
      this.hoverBtn.style.display = "none";

      // Add click handler directly to the button
      this.hoverBtn.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.unblurCurrentImage();
        },
        { passive: false }
      );

      // Prevent button from hiding when hovering over it
      this.hoverBtn.addEventListener("mouseenter", (e) => {
        e.stopPropagation();
      });

      // Append to body when available
      if (this.bodyElement) {
        this.bodyElement.appendChild(this.hoverBtn);
      } else {
        document.addEventListener(
          "DOMContentLoaded",
          () => {
            document.body.appendChild(this.hoverBtn);
          },
          { once: true }
        );
      }
    }

    showHoverButton(target, event) {
      if (!this.hoverBtn) return;

      this.currentTarget = target;
      this.hoverBtn.style.display = "block";

      // Position button in the center of the image
      const rect = target.getBoundingClientRect();
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft =
        window.pageXOffset || document.documentElement.scrollLeft;

      // Calculate center position
      const centerX = rect.left + scrollLeft + rect.width / 2;
      const centerY = rect.top + scrollTop + rect.height / 2;

      // Position the button (transform: translate(-50%, -50%) centers it)
      this.hoverBtn.style.left = centerX + "px";
      this.hoverBtn.style.top = centerY + "px";

      // Ensure button stays within viewport
      requestAnimationFrame(() => {
        const btnRect = this.hoverBtn.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let adjustedX = centerX;
        let adjustedY = centerY;

        // Adjust if button would go outside viewport
        if (btnRect.right > viewportWidth) {
          adjustedX = viewportWidth - btnRect.width / 2 - 10 + scrollLeft;
        }
        if (btnRect.left < 0) {
          adjustedX = btnRect.width / 2 + 10 + scrollLeft;
        }
        if (btnRect.bottom > viewportHeight) {
          adjustedY = viewportHeight - btnRect.height / 2 - 10 + scrollTop;
        }
        if (btnRect.top < 0) {
          adjustedY = btnRect.height / 2 + 10 + scrollTop;
        }

        this.hoverBtn.style.left = adjustedX + "px";
        this.hoverBtn.style.top = adjustedY + "px";
      });
    }

    hideHoverButton() {
      if (this.hoverBtn) {
        this.hoverBtn.style.display = "none";
      }
      this.currentTarget = null;
    }

    unblurCurrentImage() {
      if (this.currentTarget) {
        this.currentTarget.classList.add("blur-shield-unblurred");
        this.hideHoverButton();

        // Optional: Add a brief visual feedback
        if (this.hoverBtn) {
          this.hoverBtn.innerHTML = "✓ Unblurred";
          setTimeout(() => {
            if (this.hoverBtn) {
              this.hoverBtn.innerHTML = "👁️ Show Image";
            }
          }, 1000);
        }
      }
    }

    reblurCurrentImage() {
      if (
        this.currentTarget &&
        this.currentTarget.classList.contains("blur-shield-unblurred")
      ) {
        this.currentTarget.classList.remove("blur-shield-unblurred");
      }
    }

    setupMessageListener() {
      if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener(
          (message, sender, sendResponse) => {
            if (message.type === "settingsChanged") {
              this.handleSettingsChange(message.settings);
            }
          }
        );
      }
    }

    handleSettingsChange(settings) {
      this.isEnabled = settings.isEnabled;
      this.blurIntensity = settings.blurIntensity;
      this.whitelist = settings.whitelist;

      // Recalculate whitelist status
      this.isWhitelisted = this.whitelist.some(
        (domain) =>
          this.currentDomain.includes(domain) ||
          domain.includes(this.currentDomain)
      );

      // Apply new settings immediately
      this.applySettings();

      // Clean up unblurred images if needed
      if (!this.isEnabled || this.isWhitelisted) {
        document.querySelectorAll(".blur-shield-unblurred").forEach((img) => {
          img.classList.remove("blur-shield-unblurred");
        });
        this.hideHoverButton();
      }
    }
  }

  // Initialize immediately - critical for performance
  new HighPerformanceBlurShield();
})();
