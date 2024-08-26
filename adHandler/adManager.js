const { logger, handlers, utils, GenericVideoHandler, StaticAdHandler } = window.extensionAPI;

export class AdManager {
  constructor(settings) {
    this.currentDomain = window.location.hostname;
    this.handlers = new Map([
      ['www.youtube.com', new handlers.YouTubeHandler()],
      ['www.facebook.com', new handlers.FacebookHandler()]
    ]);
    this.settings = settings;
    this.cache = new Map();
  }

  async handleAds(element) {
    if (!this.settings.handleAds) return;

    const handler = this.getHandler();
    if (handler) {
      await handler.handle(element, this.settings);
    } else {
      await this.handleGenericSite(element);
    }
  }

  getHandler() {
    return this.handlers.get(this.currentDomain);
  }

  async handleGenericSite(element) {
    const genericVideoHandler = new GenericVideoHandler();
    const staticAdHandler = new StaticAdHandler();
    await genericVideoHandler.handle(element, this.settings);
    await staticAdHandler.handle(element, this.settings);
  }

  async attemptToCloseAd(adElement) {
    const closeButton = this.findCloseButton(adElement);
    if (closeButton) {
      await randomizeAction(() => closeButton.click());
      logger.log('Attempted to close ad', { success: true });
    } else {
      logger.log('Attempted to close ad', { success: false, reason: 'No close button found' });
    }
  }

  findCloseButton(adElement) {
    const selectors = ['.ad-close-button', '.close-ad', '[aria-label="Close ad"]'];
    for (const selector of selectors) {
      const button = adElement.querySelector(selector);
      if (button) return button;
    }
    return null;
  }

  hideAd(adElement) {
    if (this.cache.has(adElement)) return;

    const style = {
      display: adElement.style.display,
      visibility: adElement.style.visibility,
      height: adElement.offsetHeight + 'px'
    };

    this.cache.set(adElement, style);

    adElement.style.opacity = '0';
    adElement.style.pointerEvents = 'none';
    adElement.style.height = style.height;

    logger.log('Ad hidden', { element: adElement });
  }

  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.handlers.forEach(handler => handler.updateSettings(this.settings));
    logger.log('Ad manager settings updated', this.settings);
  }

  getDebugInfo() {
    return {
      currentDomain: this.currentDomain,
      settings: this.settings,
      handlerTypes: Array.from(this.handlers.keys()),
      cacheSize: this.cache.size
    };
  }
}

export const adManager = new AdManager();