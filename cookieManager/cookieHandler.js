import { logger } from '../utils/logger.js';
import { consentManager } from './consentManager.js';

class CookieHandler {
  constructor() {
    this.settings = {};
    this.consentObserver = null;
    this.essentialCookies = new Set(['session', 'auth', 'token', 'csrf', 'security']);
    this.cookieDb = null;
  }

  async init() {
    await this.getSettings();
    await this.initIndexedDB();
    this.handleCookieConsent();
    this.setupConsentObserver();
  }

  async initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CookieStore', 1);
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      request.onsuccess = (event) => {
        this.cookieDb = event.target.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        db.createObjectStore('cookies', { keyPath: 'name' });
      };
    });
  }

  async getSettings() {
    this.settings = await new Promise((resolve) => {
      chrome.storage.sync.get('settings', (data) => resolve(data.settings || {}));
    });
  }

  handleCookieConsent() {
    consentManager.handleConsentPopups(this.settings);
  }

  setupConsentObserver() {
    this.consentObserver = consentManager.setupConsentObserver(this.settings);
  }

  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    logger.log('Cookie handler settings updated', this.settings);
  }

  async clearNonEssentialCookies() {
    if (!this.settings.clearNonEssentialCookies) return;

    const allCookies = await this.getAllCookies();
    const nonEssentialCookies = allCookies.filter(cookie => !this.isEssentialCookie(cookie));

    await this.batchRemoveCookies(nonEssentialCookies);
    logger.log('Cleared non-essential cookies', { count: nonEssentialCookies.length });
  }

  async getAllCookies() {
    return new Promise((resolve) => {
      chrome.cookies.getAll({}, (cookies) => {
        resolve(cookies);
      });
    });
  }

  isEssentialCookie(cookie) {
    return this.essentialCookies.has(cookie.name.toLowerCase()) || this.isStoredEssentialCookie(cookie);
  }

  async isStoredEssentialCookie(cookie) {
    return new Promise((resolve) => {
      const transaction = this.cookieDb.transaction(['cookies'], 'readonly');
      const objectStore = transaction.objectStore('cookies');
      const request = objectStore.get(cookie.name);
      request.onsuccess = (event) => {
        resolve(!!event.target.result);
      };
    });
  }

  async batchRemoveCookies(cookies) {
    const batchSize = 50;
    for (let i = 0; i < cookies.length; i += batchSize) {
      const batch = cookies.slice(i, i + batchSize);
      await Promise.all(batch.map(cookie => this.removeCookie(cookie)));
    }
  }

  async removeCookie(cookie) {
    return new Promise((resolve) => {
      chrome.cookies.remove({
        url: `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`,
        name: cookie.name
      }, (details) => {
        logger.log('Removed cookie', { name: cookie.name, domain: cookie.domain });
        resolve(details);
      });
    });
  }

  disconnectObserver() {
    if (this.consentObserver) {
      this.consentObserver.disconnect();
      this.consentObserver = null;
      logger.log('Consent observer disconnected');
    }
  }
}

export const cookieHandler = new CookieHandler();