export const adSelectors = {
    general: [
      '[id*="ad"], [class*="ad"]',
      '[id*="sponsor"], [class*="sponsor"]',
      '[id*="banner"], [class*="banner"]',
      '[id*="promo"], [class*="promo"]',
      '[data-ad], [data-ad-slot]',
      'ins.adsbygoogle',
      'a[href*="/adclick"]',
      'img[src*="ad"], img[src*="banner"]'
    ],
  
    video: [
      '.video-ads',
      '.videoAdUi',
      '[class*="video-ad-overlay"]',
      '[id*="player"][class*="ad"]'
    ],
  
    youtube: [
      '.ytp-ad-module',
      '.ytp-ad-overlay-container',
      '.ytd-promoted-video-renderer',
      '[id^="player-ads"]',
      '.ytd-display-ad-renderer',
      '#player-ads'
    ],
  
    facebook: [
      '[data-pagelet="FeedUnit_1"]',
      '[data-testid="fbfeed_story"]:has([aria-label="Sponsored"])',
      '[role="article"]:has([aria-label="Sponsored"])'
    ],
  
    twitter: [
      '[data-testid="tweet"]:has([data-testid="promotedIndicator"])',
      '[data-testid="placementTracking"]'
    ],
  
    reddit: [
      '.promotedlink',
      '.promoted',
      '.sponsorshipbox'
    ],
  
    genericPopup: [
      '[id*="popup"], [class*="popup"]',
      '[id*="overlay"], [class*="overlay"]',
      '[id*="modal"], [class*="modal"]'
    ]
  };
  
  export function getAdSelector(type = 'all') {
    if (type === 'all') {
      return Object.values(adSelectors).flat().join(', ');
    }
    return adSelectors[type]?.join(', ') || '';
  }
  
  export function isLikelyAd(element) {
    const adKeywords = ['ad', 'sponsor', 'promo', 'banner', 'advertisement'];
    const elementString = element.outerHTML.toLowerCase();
    return adKeywords.some(keyword => elementString.includes(keyword));
  }