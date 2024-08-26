const { logger, utils, mediaController } = window.extensionAPI;

class GenericVideoHandler {
  constructor() {
    this.videoAdSelectors = [
      'video',
      'iframe[src*="youtube"]',
      'iframe[src*="vimeo"]',
      'iframe[src*="dailymotion"]',
      '[id*="player"][class*="ad"]',
      '.video-ads',
      '.videoAdUi'
    ];
    this.skipAdButtonSelectors = [
      '.videoAdUiSkipButton',
      '[class*="skip"]',
      '[class*="skipButton"]'
    ];
    this.observedVideos = new WeakSet();
  }

  async handle(element, settings) {
    if (!settings.handleVideoAds) return;

    const videoAds = element.querySelectorAll(this.videoAdSelectors.join(', '));
    
    for (const ad of videoAds) {
      if (this.isLikelyAd(ad) && !this.observedVideos.has(ad)) {
        this.observedVideos.add(ad);
        await this.handleVideoAd(ad, settings);
      }
    }

    logger.log('Handled generic video ads', { count: videoAds.length });
    chrome.runtime.sendMessage({ action: 'adBlocked' });
  }

  isLikelyAd(element) {
    const adKeywords = ['ad', 'sponsor', 'promo', 'commercial'];
    const elementString = element.outerHTML.toLowerCase();
    return adKeywords.some(keyword => elementString.includes(keyword));
  }

  async handleVideoAd(ad, settings) {
    if (settings.muteAds) {
      await this.muteVideoAd(ad);
      chrome.runtime.sendMessage({ action: 'muteTab', mute: true });
    }
    if (settings.attemptSkipAds) {
      await this.attemptSkipAd(ad);
    }
    if (settings.hideVideoAds) {
      await this.hideVideoAd(ad);
    }

    this.observeAdChanges(ad, settings);
    this.observeAdEnd(ad, settings);
  }

  async muteVideoAd(ad) {
    if (ad.tagName === 'IFRAME') {
      await mediaController.muteFrame(ad);
    } else if (ad.tagName === 'VIDEO') {
      await mediaController.muteElement(ad);
    }
    logger.log('Muted video ad', { element: ad });
  }

  async attemptSkipAd(ad) {
    const skipButton = ad.querySelector(this.skipAdButtonSelectors.join(', '));
    if (skipButton) {
      await randomizeAction(() => skipButton.click());
      logger.log('Attempted to skip video ad', { success: true });
    } else {
      logger.log('Attempted to skip video ad', { success: false, reason: 'No skip button found' });
    }
  }

  async hideVideoAd(ad) {
    await randomizeAction(() => {
      ad.style.opacity = '0';
      ad.style.pointerEvents = 'none';
    });
    logger.log('Hid video ad', { element: ad });
  }

  observeAdChanges(ad, settings) {
    const observer = new MutationObserver(async (mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          await this.handleVideoAd(ad, settings);
          break;
        }
      }
    });

    observer.observe(ad, { childList: true, subtree: true });
  }

  observeAdEnd(ad, settings) {
    const observer = new MutationObserver(async (mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
          if (!ad.isConnected) {
            chrome.runtime.sendMessage({ action: 'muteTab', mute: false });
            observer.disconnect();
            break;
          }
        }
      }
    });

    observer.observe(ad.parentNode, { childList: true });
  }
}

export const genericVideoHandler = new GenericVideoHandler();