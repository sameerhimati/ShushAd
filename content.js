import { adManager } from './adHandler/adManager.js';
import { cookieManager } from './cookieManager/cookieHandler.js';
import { createDOMObserver } from './utils/domObserver.js';
import { logger } from './utils/logger.js';
import { initAntiDetection } from './utils/antiDetection.js';

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