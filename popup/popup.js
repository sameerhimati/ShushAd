import { logger } from '../utils/logger.js';

class PopupManager {
  constructor() {
    this.extensionToggle = document.getElementById('extensionToggle');
    this.adsHandledSpan = document.getElementById('adsHandled');
    this.cookiesManagedSpan = document.getElementById('cookiesManaged');
    this.openOptionsButton = document.getElementById('openOptions');
    this.quickSettingsContainer = document.getElementById('quickSettings');
    this.stats = { adsHandled: 0, cookiesManaged: 0 };
    this.settings = {};
  }

  async init() {
    await this.loadInitialState();
    this.setupEventListeners();
    this.renderQuickSettings();
    this.startStatsUpdater();
  }

  async loadInitialState() {
    try {
      const result = await chrome.storage.sync.get(['enabled', 'stats', 'settings']);
      this.extensionToggle.checked = result.enabled !== false; // Default to true if not set
      this.updateStats(result.stats || this.stats);
      this.settings = result.settings || {};
    } catch (error) {
      logger.error('Error loading initial state:', error);
    }
  }

  setupEventListeners() {
    this.extensionToggle.addEventListener('change', () => this.toggleExtension());
    this.openOptionsButton.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'updateStats') {
        this.updateStats(request.stats);
      }
    });
  }

  async toggleExtension() {
    try {
      await chrome.storage.sync.set({ enabled: this.extensionToggle.checked });
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, { 
            action: 'toggleExtension', 
            enabled: this.extensionToggle.checked 
          });
        });
      });
    } catch (error) {
      logger.error('Error toggling extension:', error);
    }
  }

  updateStats(stats) {
    this.stats = stats;
    this.adsHandledSpan.textContent = stats.adsHandled.toLocaleString();
    this.cookiesManagedSpan.textContent = stats.cookiesManaged.toLocaleString();
  }

  renderQuickSettings() {
    const quickSettingsKeys = ['muteYouTubeAds', 'handleCookieConsent', 'handleStaticAds'];
    quickSettingsKeys.forEach(key => {
      const setting = this.createQuickSettingElement(key);
      this.quickSettingsContainer.appendChild(setting);
    });
  }

  createQuickSettingElement(key) {
    const container = document.createElement('div');
    container.className = 'quick-setting';

    const label = document.createElement('label');
    label.textContent = this.getSettingLabel(key);

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = this.settings[key] || false;
    toggle.addEventListener('change', () => this.updateQuickSetting(key, toggle.checked));

    container.appendChild(label);
    container.appendChild(toggle);
    return container;
  }

  getSettingLabel(key) {
    const labels = {
      muteYouTubeAds: 'Mute YouTube Ads',
      handleCookieConsent: 'Handle Cookie Consent',
      handleStaticAds: 'Handle Static Ads'
    };
    return labels[key] || key;
  }

  async updateQuickSetting(key, value) {
    try {
      this.settings[key] = value;
      await chrome.storage.sync.set({ settings: this.settings });
      const tabs = await chrome.tabs.query({});
      const updatePromises = tabs.map(tab => 
        chrome.tabs.sendMessage(tab.id, { 
          action: 'updateSettings', 
          settings: { [key]: value } 
        }).catch(error => {
          // Ignore errors for inactive tabs
          if (error.message !== "Could not establish connection. Receiving end does not exist.") {
            throw error;
          }
        })
      );
      await Promise.all(updatePromises);
      logger.info(`Quick setting updated: ${key} = ${value}`);
    } catch (error) {
      logger.error('Error updating quick setting:', error);
    }
  }

  startStatsUpdater() {
    setInterval(async () => {
      try {
        const result = await chrome.storage.sync.get('stats');
        this.updateStats(result.stats || this.stats);
      } catch (error) {
        logger.error('Error updating stats:', error);
      }
    }, 1000); // Update every second
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const popupManager = new PopupManager();
  popupManager.init();
});
