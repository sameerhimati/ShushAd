import { logger } from './logger.js';

class OptionsManager {
  constructor() {
    this.defaultSettings = {
      handleYouTubeAds: true,
      muteYouTubeAds: true,
      attemptSkipYouTubeAds: true,
      hideYouTubeOverlayAds: true,
      handleFacebookAds: true,
      handleVideoAds: true,
      handleStaticAds: true,
      handleCookieConsent: true,
      automaticallyHandleConsent: false,
      clearNonEssentialCookies: false,
      enableLogging: false,
      logLevel: 'INFO'
    };
    this.settingsCache = null;
    this.init();
  }

  init() {
    this.restoreOptions();
    this.setupEventListeners();
    this.setupSearch();
  }

  async saveOptions() {
    const settings = {};
    for (const [key, defaultValue] of Object.entries(this.defaultSettings)) {
      const element = document.getElementById(key);
      settings[key] = element.type === 'checkbox' ? element.checked : element.value;
    }

    try {
      await browser.storage.sync.set({ settings });
      this.settingsCache = settings;
      this.showStatus('Options saved.', 'success');
      this.notifyContentScripts(settings);
    } catch (error) {
      this.showStatus('Error saving options: ' + error, 'error');
    }
  }

  async restoreOptions() {
    try {
      const res = await browser.storage.sync.get('settings');
      const currentSettings = res.settings || this.defaultSettings;
      this.settingsCache = currentSettings;

      for (const [key, value] of Object.entries(currentSettings)) {
        const element = document.getElementById(key);
        if (element) {
          if (element.type === 'checkbox') {
            element.checked = value;
          } else {
            element.value = value;
          }
        }
      }
    } catch (error) {
      logger.error('Error loading settings:', error);
    }
  }

  setupEventListeners() {
    document.getElementById('save').addEventListener('click', () => this.saveOptions());
    
    for (const key of Object.keys(this.defaultSettings)) {
      const element = document.getElementById(key);
      if (element) {
        element.addEventListener('change', () => this.saveOptions());
      }
    }
  }

  setupSearch() {
    const searchInput = document.getElementById('settingsSearch');
    const settingsElements = document.querySelectorAll('.setting');

    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      settingsElements.forEach(element => {
        const settingName = element.querySelector('label').textContent.toLowerCase();
        if (settingName.includes(searchTerm)) {
          element.style.display = 'block';
        } else {
          element.style.display = 'none';
        }
      });
    });
  }

  showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = type;
    setTimeout(() => {
      status.textContent = '';
      status.className = '';
    }, 3000);
  }

  async notifyContentScripts(settings) {
    try {
      const tabs = await browser.tabs.query({});
      tabs.forEach((tab) => {
        browser.tabs.sendMessage(tab.id, { action: 'updateSettings', settings });
      });
    } catch (error) {
      logger.error('Error notifying tabs:', error);
    }
  }
}

const optionsManager = new OptionsManager();