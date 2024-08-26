const { logger, utils } = window.extensionAPI;

class FacebookHandler {
  constructor() {
    this.sponsoredSelectors = [
      '[data-pagelet="FeedUnit_1"]',
      '[data-testid="fbfeed_story"]:has([aria-label="Sponsored"])',
      '[role="article"]:has([aria-label="Sponsored"])'
    ];
    this.cachedAds = new Set();
    this.virtualScroller = null;
  }

  async handle(element, settings) {
    if (!settings.handleFacebookAds) return;

    this.initVirtualScroller(element);
    await this.handleVisibleSponsored(element, settings);
    
    logger.log('Handled Facebook ads');
    chrome.runtime.sendMessage({ action: 'adBlocked' });
  }

  initVirtualScroller(element) {
    if (!this.virtualScroller) {
      this.virtualScroller = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.handleSponsoredPost(entry.target, this.settings);
          }
        });
      }, { threshold: 0.1 });
    }
  }

  async handleVisibleSponsored(element, settings) {
    const sponsoredPosts = element.querySelectorAll(this.sponsoredSelectors.join(', '));
    
    for (const post of sponsoredPosts) {
      if (!this.cachedAds.has(post)) {
        this.virtualScroller.observe(post);
        this.cachedAds.add(post);
      }
    }
  }

  async handleSponsoredPost(post, settings) {
    if (settings.hideFacebookAds) {
      await this.hideSponsored(post);
    } else {
      await this.muteSponsored(post);
    }
  }

  async hideSponsored(post) {
    await randomizeAction(() => {
      const shadowRoot = post.attachShadow({ mode: 'closed' });
      shadowRoot.innerHTML = `
        <style>
          :host { display: none !important; }
        </style>
      `;
    });
    logger.log('Hid sponsored post', { element: post });
  }

  async muteSponsored(post) {
    const videoElement = post.querySelector('video');
    if (videoElement) {
      await mediaController.muteElement(videoElement);
      logger.log('Muted sponsored video', { element: videoElement });
    }
  }

  updateSettings(settings) {
    this.settings = settings;
  }

  disconnect() {
    if (this.virtualScroller) {
      this.virtualScroller.disconnect();
      this.virtualScroller = null;
      logger.log('Facebook virtual scroller disconnected');
    }
  }
}

export const facebookHandler = new FacebookHandler();