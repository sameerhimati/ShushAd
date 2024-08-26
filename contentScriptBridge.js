(function() {
  // Logger implementation
  const logger = {
    log: (...args) => console.log('[Extension]', ...args),
    warn: (...args) => console.warn('[Extension]', ...args),
    error: (...args) => console.error('[Extension]', ...args)
  };

  // State implementation
  const state = {
    settings: {},
    stats: { adsHandled: 0, cookiesManaged: 0 },
    initializeState: async function() {
      const result = await chrome.storage.sync.get(['settings', 'stats']);
      this.settings = result.settings || {
        muteAds: true,
        skipAds: true,
        handleCookies: true,
        clearNonEssentialCookies: false,
        advancedMode: false,
        cookiePreference: 'minimal' // 'minimal', 'balanced', or 'all'
      };
      this.stats = result.stats || { adsHandled: 0, cookiesManaged: 0 };
    },
    updateState: async function(newState) {
      Object.assign(this, newState);
      await chrome.storage.sync.set(newState);
    },
    getState: function() {
      return { settings: this.settings, stats: this.stats };
    }
  };

  // AdManager implementation
  const AdManager = {
    muteAd: function(adElement) {
      if (adElement.tagName === 'VIDEO') {
        adElement.muted = true;
        logger.log('Ad muted');
      }
    },
    skipAd: function(adElement) {
      if (adElement.tagName === 'VIDEO') {
        adElement.currentTime = adElement.duration;
        logger.log('Ad skipped');
      }
    },
    hideAd: function(adElement) {
      adElement.style.display = 'none';
      logger.log('Ad hidden');
    },
    handleAd: function(adElement) {
      if (state.settings.muteAds) this.muteAd(adElement);
      if (state.settings.skipAds) this.skipAd(adElement);
      this.hideAd(adElement);
      state.stats.adsHandled++;
      state.updateState({ stats: state.stats });
    }
  };

  const ConsentManager = {
    consentButtonSelectors: [
      'button[id*="reject"]',
      'button[id*="deny"]',
      'button[id*="decline"]',
      'button[class*="reject"]',
      'button[class*="deny"]',
      'button[class*="decline"]',
      'a[id*="reject"]',
      'a[id*="deny"]',
      'a[id*="decline"]',
      'a[class*="reject"]',
      'a[class*="deny"]',
      'a[class*="decline"]'
    ],
    essentialOnlySelectors: [
      'input[id*="essential"]',
      'input[id*="necessary"]',
      'input[id*="required"]'
    ],
    saveButtonSelectors: [
      'button[id*="save"]',
      'button[id*="confirm"]',
      'button[id*="accept"]',
      'a[id*="save"]',
      'a[id*="confirm"]',
      'a[id*="accept"]'
    ],
    handleConsent: function() {
      // Try to find and click "Reject All" or similar buttons
      for (const selector of this.consentButtonSelectors) {
        const button = document.querySelector(selector);
        if (button) {
          button.click();
          logger.log('Consent rejected');
          return;
        }
      }
      // If no reject button found, try to select only essential cookies
      const cookieOptions = document.querySelectorAll('input[type="checkbox"]');
      let changedPreferences = false;
      cookieOptions.forEach(option => {
        const isEssential = this.essentialOnlySelectors.some(selector => option.matches(selector));
        if (isEssential) {
          option.checked = true;
          changedPreferences = true;
        } else {
          option.checked = false;
          changedPreferences = true;
        }
      });

      // If preferences were changed, try to save the changes
      if (changedPreferences) {
        for (const selector of this.saveButtonSelectors) {
          const saveButton = document.querySelector(selector);
          if (saveButton) {
            saveButton.click();
            logger.log('Minimal cookie preferences saved');
            return;
          }
        }
      }

      logger.log('Unable to handle cookie consent automatically');
    }
  };

  // CookieManager implementation
  const CookieManager = {
    handleCookieConsent: function() {
      const consentForms = this.findConsentForms();
      if (consentForms.length === 0) return;

      for (const form of consentForms) {
        const minimumButton = this.findMinimumConsentButton(form);
        if (minimumButton) {
          minimumButton.click();
          logger.log('Clicked minimal cookie consent button');
          break;
        }
      }
    },

    findConsentForms: function() {
      const possibleForms = document.querySelectorAll('form, div[role="dialog"], div[aria-modal="true"]');
      return Array.from(possibleForms).filter(el => 
        this.elementContainsConsentKeywords(el) && this.hasInteractiveElements(el)
      );
    },

    elementContainsConsentKeywords: function(element) {
      const consentKeywords = ['cookie', 'consent', 'gdpr', 'privacy'];
      const text = element.textContent.toLowerCase();
      return consentKeywords.some(keyword => text.includes(keyword));
    },

    hasInteractiveElements: function(element) {
      return element.querySelectorAll('button, input[type="checkbox"], input[type="radio"]').length > 0;
    },

    findMinimumConsentButton: function(form) {
      const buttons = form.querySelectorAll('button, input[type="submit"]');
      const minimumKeywords = ['reject', 'minimum', 'necessary', 'essential', 'basic'];
      
      return Array.from(buttons).find(button => {
        const text = button.textContent.toLowerCase();
        return minimumKeywords.some(keyword => text.includes(keyword));
      });
    }
  };

  // Handler implementations
  const YouTubeHandler = {
    handleAds: function() {
      const adOverlay = document.querySelector('.ytp-ad-overlay-container');
      if (adOverlay) AdManager.hideAd(adOverlay);

      const videoAd = document.querySelector('.html5-video-player video');
      if (videoAd && videoAd.src.includes('googlevideo.com')) AdManager.handleAd(videoAd);
    }
  };

  const FacebookHandler = {
    handleAds: function() {
      const sponsoredPosts = document.querySelectorAll('[data-testid="sponsored_post"]');
      sponsoredPosts.forEach(post => AdManager.hideAd(post));
    }
  };

  const GenericVideoHandler = {
    handleAds: function() {
      const videoElements = document.querySelectorAll('video');
      videoElements.forEach(video => {
        if (video.src.includes('ad') || video.className.includes('ad')) {
          AdManager.handleAd(video);
        }
      });
    }
  };

  const StaticAdHandler = {
    handleAds: function() {
      const adElements = document.querySelectorAll('div[id*="ad"], div[class*="ad"]');
      adElements.forEach(ad => AdManager.hideAd(ad));
    }
  };

  // Utility implementations
  const utils = {
    randomizeAction: () => Math.random() < 0.5,
    addDecoyElements: () => {
      const decoy = document.createElement('div');
      decoy.id = 'decoy-element';
      decoy.style.display = 'none';
      document.body.appendChild(decoy);
    },
    simulateUserActivity: () => {
      const event = new MouseEvent('mousemove', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: Math.random() * window.innerWidth,
        clientY: Math.random() * window.innerHeight
      });
      document.dispatchEvent(event);
    },
    obfuscateExtensionName: () => btoa('SmartAdHandler'),
    initAntiDetection: () => {
      utils.addDecoyElements();
      setInterval(utils.simulateUserActivity, 30000 + Math.random() * 30000);
    },
    mediaController: {
      play: (mediaElement) => mediaElement.play(),
      pause: (mediaElement) => mediaElement.pause(),
      setVolume: (mediaElement, volume) => mediaElement.volume = volume
    }
  };

  // BloomFilter implementation
  const BloomFilter = {
    filter: new Set(),
    add: function(item) {
      this.filter.add(item);
    },
    check: function(item) {
      return this.filter.has(item);
    }
  };

  // Create and expose the extensionAPI
  window.extensionAPI = {
    logger,
    state,
    AdManager,
    CookieManager,
    ConsentManager,
    handlers: {
      YouTubeHandler,
      FacebookHandler,
      GenericVideoHandler,
      StaticAdHandler
    },
    utils,
    GenericVideoHandler,
    StaticAdHandler,
    BloomFilter
  };

  // Initialize state
  state.initializeState().then(() => {
    logger.log('State initialized');

    // Load content.js as a module
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content.js');
    script.type = 'module';
    (document.head || document.documentElement).appendChild(script);

    // Initialize anti-detection measures
    utils.initAntiDetection();
  }).catch(error => {
    logger.error('Failed to initialize state:', error);
  });
})();

