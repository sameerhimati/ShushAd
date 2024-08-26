import { logger } from './utils/logger.js';
import { initializeState, updateState, getState } from './utils/state.js';

class BackgroundManager {
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
          case 'adBlocked':
            await this.handleAdBlocked();
            break;
          case 'cookieManaged':
            await this.handleCookieManaged();
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

  async incrementStat(statName) {
    const result = await chrome.storage.sync.get('stats');
    const stats = result.stats || { adsHandled: 0, cookiesManaged: 0 };
    stats[statName]++;
    await chrome.storage.sync.set({ stats });
  }
  
  async handleAdBlocked() {
    await this.incrementStat('adsHandled');
  }
  
  async handleCookieManaged() {
    await this.incrementStat('cookiesManaged');
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
      removeRuleIds: [1, 2],
      addRules: [
        {
          id: 1,
          priority: 1,
          action: { type: 'block' },
          condition: {
            urlFilter: '||example.com/ads/*',
            resourceTypes: ['script', 'image']
          }
        },
        {
          id: 2,
          priority: 1,
          action: { type: 'redirect', redirect: { extensionPath: '/resources/1x1.png' } },
          condition: {
            urlFilter: '||example.com/tracking/*',
            resourceTypes: ['image']
          }
        }
      ]
    });
    logger.log('Declarative Net Request rules updated');
  }

  async muteTab(tabId, mute) {
    await chrome.tabs.update(tabId, { muted: mute });
    logger.log(`Tab ${tabId} ${mute ? 'muted' : 'unmuted'}`);
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'muteTab') {
        this.muteTab(sender.tab.id, request.mute);
      }
      // ... other message handling ...
    });
  }
}

async function updateAdDetectionModel() {
  // Fetch the latest model from your server
  const response = await fetch('https://your-server.com/latest-ad-model.json');
  const modelData = await response.json();
  
  // Save the model to the extension's storage
  await chrome.storage.local.set({ adDetectionModel: modelData });
  
  logger.log('Ad detection model updated');
}

// Call this function periodically, e.g., once a day
setInterval(updateAdDetectionModel, 24 * 60 * 60 * 1000);

const backgroundManager = new BackgroundManager();
