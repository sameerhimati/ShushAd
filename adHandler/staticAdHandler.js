import { logger } from '../utils/logger.js';
import { randomizeAction } from '../utils/antiDetection.js';
import { BloomFilter } from '../utils/bloomFilter.js';

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
    this.adUrlFilter = new BloomFilter(1000, 0.01);
    this.initAdUrlFilter();
    this.adPlaceholderTemplate = this.createAdPlaceholderTemplate();
  }

  async initAdUrlFilter() {
    // In a real-world scenario, this list would be much larger and possibly fetched from a server
    const adUrls = ['example.com/ads', 'ads.example.com', 'adserver.example.com'];
    adUrls.forEach(url => this.adUrlFilter.add(url));
  }

  createAdPlaceholderTemplate() {
    const template = document.createElement('div');
    template.style.cssText = 'background-color: #f0f0f0; border: 1px solid #ccc; padding: 10px; text-align: center; font: 14px Arial, sans-serif;';
    template.textContent = 'Advertisement placeholder';
    return template;
  }

  async handle(element, settings) {
    if (!settings.handleStaticAds) return;

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

    logger.log('Set up observers for static ads', { count: staticAds.length });
  }

  isLikelyAd(element) {
    const adKeywords = ['ad', 'sponsor', 'promo', 'banner'];
    const elementString = element.outerHTML.toLowerCase();
    return adKeywords.some(keyword => elementString.includes(keyword)) || this.isAdUrl(element);
  }

  isAdUrl(element) {
    const url = element.src || element.href;
    return url && this.adUrlFilter.test(new URL(url).hostname);
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
    await randomizeAction(() => {
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