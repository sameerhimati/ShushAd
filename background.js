import { initializeState, updateState, getState } from './state.js';
import { logger } from './utils/logger.js';

class BackgroundScript {
  constructor() {
    this.init();
  }

  async init() {
    await initializeState();
    this.setupListeners();
    this.setupDeclarativeNetRequest();
  }

  setupListeners() {
    chrome.runtime.onInstalled.addListener(this.handleInstall.bind(this));
    chrome.tabs.onUpdated.addListener(this.handleTabUpdate.bind(this));
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  }

  async handleInstall(details) {
    if (details.reason === 'install') {
      await this.setDefaultSettings();
    }
  }

  async handleTabUpdate(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
      await this.injectContentScript(tabId, tab.url);
    }
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'getSettings':
          const settings = await this.getSettings();
          sendResponse({ success: true, data: settings });
          break;
        case 'updateSettings':
          await this.updateSettings(request.settings);
          sendResponse({ success: true });
          break;
        case 'getState':
          const state = getState();
          sendResponse({ success: true, data: state });
          break;
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      logger.error('Error handling message', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Indicates we will send a response asynchronously
  }

  async setDefaultSettings() {
    const defaultSettings = {
      muteAds: true,
      skipAds: true,
      handleCookies: true,
      advancedMode: false
    };
    await updateState({ settings: defaultSettings });
    logger.log('Default settings set', defaultSettings);
  }

  async getSettings() {
    const state = getState();
    return state.settings;
  }

  async updateSettings(newSettings) {
    await updateState({ settings: newSettings });
    logger.log('Settings updated', newSettings);
  }

  async injectContentScript(tabId, url) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      logger.log('Content script injected', { tabId, url });
    } catch (error) {
      logger.error('Error injecting content script', error);
    }
  }

  setupDeclarativeNetRequest() {
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1],
      addRules: [{
        id: 1,
        priority: 1,
        action: {
          type: 'block'
        },
        condition: {
          urlFilter: '||example.com/ads/*',
          resourceTypes: ['script', 'image']
        }
      }]
    });
  }
}

// Error handling
window.addEventListener('error', (event) => {
  logger.error('Unhandled error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection:', event.reason);
});

const backgroundScript = new BackgroundScript();