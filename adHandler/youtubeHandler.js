const { logger, utils, mediaController } = window.extensionAPI;

class YouTubeHandler {
  constructor() {
    this.videoAdSelectors = [
      '.video-ads .ytp-ad-module',
      '.ytp-ad-overlay-container',
      '.ytp-ad-text-overlay'
    ];
    this.skipAdButtonSelectors = [
      '.ytp-ad-skip-button',
      '.videoAdUiSkipButton'
    ];
    this.muteButtonSelector = '.ytp-mute-button';
    this.adObserver = null;
    this.state = {
      isMuted: false,
      isSkipped: false,
      adType: null
    };
  }

  async handle(element, settings) {
    if (!settings.handleYouTubeAds) return;

    this.setupAdObserver(element, settings);
    await this.handleExistingAds(element, settings);

    logger.log('YouTube ad handler initialized');
  }

  setupAdObserver(element, settings) {
    const config = { childList: true, subtree: true };
    this.adObserver = new MutationObserver(this.debouncedHandleMutations(settings));
    this.adObserver.observe(element, config);
  }

  debouncedHandleMutations(settings) {
    let timeout;
    return (mutations) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const addedNodes = mutations.flatMap(m => Array.from(m.addedNodes));
        const relevantNodes = addedNodes.filter(node => node.nodeType === Node.ELEMENT_NODE);
        relevantNodes.forEach(node => this.handleAdNode(node, settings));
      }, 100);
    };
  }

  async handleExistingAds(element, settings) {
    const adElements = element.querySelectorAll(this.videoAdSelectors.join(', '));
    for (const adElement of adElements) {
      await this.handleAdElement(adElement, settings);
    }
  }

  async handleAdNode(node, settings) {
    if (this.isAdElement(node)) {
      await this.handleAdElement(node, settings);
    } else {
      const adElements = node.querySelectorAll(this.videoAdSelectors.join(', '));
      for (const adElement of adElements) {
        await this.handleAdElement(adElement, settings);
      }
    }
  }

  isAdElement(element) {
    return this.videoAdSelectors.some(selector => element.matches(selector));
  }

  async handleAdElement(adElement, settings) {
    this.updateState(adElement);

    if (settings.muteYouTubeAds && !this.state.isMuted) {
      await this.muteAd(adElement);
    }
    if (settings.attemptSkipYouTubeAds && !this.state.isSkipped) {
      await this.attemptSkipAd(adElement);
    }
    if (settings.hideYouTubeOverlayAds && this.state.adType === 'overlay') {
      await this.hideOverlayAd(adElement);
    }
  }

  updateState(adElement) {
    this.state.adType = this.getAdType(adElement);
    this.state.isMuted = adElement.querySelector(this.muteButtonSelector)?.getAttribute('aria-label')?.includes('Unmute') ?? false;
    this.state.isSkipped = !adElement.querySelector(this.skipAdButtonSelectors.join(', '));
  }

  getAdType(adElement) {
    if (adElement.matches('.ytp-ad-overlay-container') || adElement.matches('.ytp-ad-text-overlay')) {
      return 'overlay';
    }
    return 'video';
  }

  async muteAd(adElement) {
    const videoElement = document.querySelector('video');
    if (videoElement) {
      await mediaController.muteElement(videoElement);
      this.state.isMuted = true;
      logger.log('Muted YouTube ad', { element: adElement });
    } else {
      const muteButton = adElement.querySelector(this.muteButtonSelector);
      if (muteButton && !muteButton.getAttribute('aria-label').includes('Unmute')) {
        await randomizeAction(() => muteButton.click());
        this.state.isMuted = true;
        logger.log('Clicked mute button for YouTube ad');
        chrome.runtime.sendMessage({ action: 'adBlocked' });
      }
    }
  }

  async attemptSkipAd(adElement) {
    const skipButton = adElement.querySelector(this.skipAdButtonSelectors.join(', '));
    if (skipButton) {
      await this.clickWithRandomDelay(skipButton);
      this.state.isSkipped = true;
      logger.log('Attempted to skip YouTube ad', { success: true });
    } else {
      logger.log('Attempted to skip YouTube ad', { success: false, reason: 'No skip button found' });
    }
  }

  async hideOverlayAd(adElement) {
    await randomizeAction(() => {
      adElement.style.display = 'none';
    });
    logger.log('Hid YouTube overlay ad', { element: adElement });
  }

  async clickWithRandomDelay(element) {
    const minDelay = 1000; // 1 second
    const maxDelay = 3000; // 3 seconds
    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    
    await new Promise(resolve => setTimeout(resolve, delay));
    await randomizeAction(() => {
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(clickEvent);
    });
  }

  disconnect() {
    if (this.adObserver) {
      this.adObserver.disconnect();
      this.adObserver = null;
      logger.log('YouTube ad observer disconnected');
    }
  }
}


export const youtubeHandler = new YouTubeHandler();