const { logger, utils, mediaController } = window.extensionAPI;

class StaticAdHandler {
  constructor() {
    this.staticAdSelectors = [
      '[id*="ad"], [class*="ad"]',
      '[id*="banner"], [class*="banner"]',
      'ins.adsbygoogle',
      'a[href*="/adclick"]',
      'img[src*="ad"], img[src*="banner"]',
      '[id*="sponsor"], [class*="sponsor"]'
    ];
    this.adPlaceholderTemplate = this.createAdPlaceholderTemplate();
    this.adDetectionModel = null;
  }

  createAdPlaceholderTemplate() {
    const template = document.createElement('div');
    template.style.cssText = 'background-color: #f0f0f0; border: 1px solid #ccc; padding: 10px; text-align: center; font: 14px Arial, sans-serif;';
    template.textContent = 'Advertisement placeholder';
    return template;
  }

  async handle(element, settings) {
    if (!settings.handleStaticAds) return;

    if (!this.adDetectionModel) {
      this.adDetectionModel = await this.loadAdDetectionModel();
    }

    const staticAds = element.querySelectorAll(this.staticAdSelectors.join(', '));
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.handleStaticAd(entry.target, settings);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    staticAds.forEach(ad => {
      if (this.isLikelyAd(ad)) {
        observer.observe(ad);
      }
    });
    chrome.runtime.sendMessage({ action: 'adBlocked' });
    logger.log('Set up observers for static ads', { count: staticAds.length });
  }

  async loadAdDetectionModel() {
    try {
      return await tf.loadLayersModel('chrome-extension://' + chrome.runtime.id + '/models/ad_detection_model.json');
    } catch (error) {
      logger.error('Error loading ad detection model:', error);
      return null;
    }
  }

  isLikelyAd(element) {
    const adKeywords = ['ad', 'sponsor', 'promo', 'banner'];
    const elementString = element.outerHTML.toLowerCase();
    
    // Use machine learning model to predict if the element is an ad
    const features = this.extractFeatures(element);
    const prediction = this.adDetectionModel.predict(features);
    const isAdPrediction = prediction.dataSync()[0] > 0.5;

    // Combine ML prediction with keyword matching and heuristics
    return isAdPrediction || 
           adKeywords.some(keyword => elementString.includes(keyword)) || 
           this.hasAdCharacteristics(element);
  }

  extractFeatures(element) {
    // Extract relevant features from the element for the ML model
    return tf.tensor2d([
      [
        element.offsetWidth,
        element.offsetHeight,
        element.tagName === 'IMG' ? 1 : 0,
        element.tagName === 'IFRAME' ? 1 : 0,
        element.id.toLowerCase().includes('ad') ? 1 : 0,
        element.className.toLowerCase().includes('ad') ? 1 : 0,
        // Add more features as needed
      ]
    ]);
  }

  hasAdCharacteristics(element) {
    // Check for common ad characteristics
    const url = element.src || element.href;
    if (url) {
      const urlObj = new URL(url);
      if (urlObj.searchParams.has('ad') || urlObj.pathname.includes('ad')) {
        return true;
      }
    }

    // Check for common ad sizes
    const commonAdSizes = [[300, 250], [728, 90], [160, 600], [320, 50]];
    if (commonAdSizes.some(([width, height]) => 
        element.offsetWidth === width && element.offsetHeight === height)) {
      return true;
    }

    // Add more heuristics as needed

    return false;
  }

  async handleStaticAd(ad, settings) {
    if (settings.hideStaticAds) {
      await this.hideStaticAd(ad);
    } else if (settings.blurStaticAds) {
      await this.blurStaticAd(ad);
    } else if (settings.replaceStaticAds) {
      await this.replaceStaticAd(ad);
    }
  }

  async hideStaticAd(ad) {
    await utils.randomizeAction(() => {
      ad.style.display = 'none';
    });
    logger.log('Hid static ad', { element: ad });
  }

  async blurStaticAd(ad) {
    await randomizeAction(() => {
      ad.style.filter = 'blur(5px)';
      ad.style.opacity = '0.5';
    });
    logger.log('Blurred static ad', { element: ad });
  }

  async replaceStaticAd(ad) {
    const placeholder = this.adPlaceholderTemplate.cloneNode(true);
    placeholder.style.width = ad.offsetWidth + 'px';
    placeholder.style.height = ad.offsetHeight + 'px';
    
    await randomizeAction(() => {
      ad.parentNode.replaceChild(placeholder, ad);
    });
    logger.log('Replaced static ad with placeholder', { original: ad, placeholder });
  }
}

export const staticAdHandler = new StaticAdHandler();