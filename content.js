const { logger, state, AdManager, CookieManager, handlers, utils } = window.extensionAPI;

let settings = {};
let adManager, cookieManager;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'pageLoad') {
    initializeContentScript();
  }
});

async function initializeContentScript() {
  settings = await getSettings();
  adManager = new AdManager(settings);
  cookieManager = new CookieManager(settings);
  setupAdHandling();
  setupCookieHandling();
  utils.initAntiDetection();
  chrome.runtime.sendMessage({ action: 'setupMessageListeners' });
}

function setupAdHandling() {
  if (settings.muteAds) {
    adManager.muteAds();
  }
  if (settings.skipAds) {
    adManager.setupAdSkipping();
  }
  if (settings.hideAds) {
    adManager.hideAds();
  }
  adManager.observeNewAds();
}

function setupCookieHandling() {
  if (settings.handleCookies) {
    cookieManager.handleCookieConsent();
    cookieManager.setupConsentObserver();
  }
  if (settings.clearNonEssentialCookies) {
    cookieManager.clearNonEssentialCookies();
  }
}

async function getSettings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      resolve(response.data);
    });
  });
}

class ContentScript {
  constructor() {
    this.init();
  }

  async init() {
    try {
      await this.loadSettings();
      this.setupMessageListener();
      this.injectRelevantScripts();
      this.setupDOMObserver();
      initAntiDetection();
    } catch (error) {
      logger.error('Error initializing content script', error);
    }
  }

  async loadSettings() {
    this.settings = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
        resolve(response.data);
      });
    });
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'updateSettings') {
        this.updateSettings(request.settings);
        sendResponse({success: true});
      }
    });
  }

  injectRelevantScripts() {
    const hostname = window.location.hostname;
    if (hostname.includes('youtube.com')) {
      this.injectScript('youtubeHandler.js');
    } else if (hostname.includes('facebook.com')) {
      this.injectScript('facebookHandler.js');
    } else {
      this.injectScript('genericVideoHandler.js');
      this.injectScript('staticAdHandler.js');
    }
  }

  injectScript(scriptName) {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(`adHandler/${scriptName}`);
    (document.head || document.documentElement).appendChild(script);
  }

  setupDOMObserver() {
    const targetNode = document.body;
    const config = { childList: true, subtree: true };
    
    const callback = (mutationsList, observer) => {
      for (let mutation of mutationsList) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.handleNewElement(node);
            }
          });
        }
      }
    };

    createDOMObserver(targetNode, callback, config);
  }

  handleNewElement(element) {
    if (this.settings.handleAds) {
      adManager.handleAds(element);
    }
    if (this.settings.handleCookies) {
      cookieManager.handleCookieConsent(element);
    }
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    adManager.updateSettings(this.settings);
    cookieManager.updateSettings(this.settings);
    logger.log('Settings updated', this.settings);
  }
}

const contentScript = new ContentScript();

// Expose a global function for debugging
window.debugAdHandler = () => {
  logger.log('Ad Handler Debug Info', adManager.getDebugInfo());
};

document.addEventListener('DOMContentLoaded', () => {
  logger.log('DOM fully loaded and parsed');
  
  // Initialize the content script
  initializeContentScript();
  
  // Perform initial ad and cookie handling
  if (settings.handleAds) {
    adManager.handleAds(document.body);
  }
  if (settings.handleCookies) {
    cookieManager.handleCookieConsent(document.body);
  }
  
  // Set up mutation observer for dynamic content
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (settings.handleAds) {
              adManager.handleAds(node);
            }
            if (settings.handleCookies) {
              cookieManager.handleCookieConsent(node);
            }
          }
        });
      }
    });
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  logger.log('Content script initialization complete');
});



