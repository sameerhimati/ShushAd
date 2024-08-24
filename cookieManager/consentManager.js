import { logger } from '../utils/logger.js';
import { randomizeAction } from '../utils/antiDetection.js';

class ConsentManager {
  constructor() {
    this.consentButtonSelectors = [
      '[aria-label*="consent"]',
      '[aria-label*="cookie"]',
      'button:contains("Accept")',
      'button:contains("Reject")',
      'button:contains("Manage")',
      'button:contains("Preferences")',
      '[id*="accept-button"]',
      '[id*="reject-button"]',
      '[class*="accept-button"]',
      '[class*="reject-button"]',
      '[id*="cookie-consent"]',
      '[class*="cookie-consent"]'
    ];
    this.preferenceKeywords = ['necessary', 'essential', 'required', 'minimal', 'reject all', 'decline', 'refuse'];
    this.decisionTree = this.buildDecisionTree();
  }

  buildDecisionTree() {
    // This is a simplified decision tree. In a real-world scenario,
    // this would be more complex and based on machine learning models.
    return {
      'has_accept_all': {
        true: 'reject',
        false: {
          'has_reject_all': {
            true: 'reject_all',
            false: 'do_nothing'
          }
        }
      }
    };
  }

  async handleConsentPopups(settings, element = document) {
    if (!settings.handleCookieConsent) return;

    const consentButtons = element.querySelectorAll(this.consentButtonSelectors.join(', '));
    
    for (const button of consentButtons) {
      if (this.isRelevantConsentButton(button)) {
        await this.handleConsentButton(button, settings);
      }
    }

    logger.log('Handled consent popups');
  }

  isRelevantConsentButton(button) {
    const buttonText = button.textContent.toLowerCase();
    return this.preferenceKeywords.some(keyword => buttonText.includes(keyword));
  }

  async handleConsentButton(button, settings) {
    const decision = this.makeDecision(button);
    if (settings.automaticallyHandleConsent) {
      await this.executeDecision(decision, button);
    } else {
      this.highlightConsentButton(button);
    }
  }

  makeDecision(button) {
    const hasAcceptAll = !!button.closest('form').querySelector('button:contains("Accept All")');
    const hasRejectAll = !!button.closest('form').querySelector('button:contains("Reject All")');

    let currentNode = this.decisionTree;
    while (typeof currentNode !== 'string') {
      const condition = Object.keys(currentNode)[0];
      currentNode = currentNode[condition][eval(condition)];
    }

    return currentNode;
  }

  async executeDecision(decision, button) {
    switch (decision) {
      case 'reject':
        await this.clickConsentButton(button);
        break;
      case 'reject_all':
        const rejectAllButton = button.closest('form').querySelector('button:contains("Reject All")');
        if (rejectAllButton) {
          await this.clickConsentButton(rejectAllButton);
        }
        break;
      case 'do_nothing':
        logger.log('No clear consent decision, doing nothing');
        break;
    }
  }

  async clickConsentButton(button) {
    await randomizeAction(() => {
      button.click();
    });
    logger.log('Clicked consent button', { buttonText: button.textContent });
  }

  highlightConsentButton(button) {
    button.style.border = '2px solid red';
    button.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.5)';
    logger.log('Highlighted consent button', { buttonText: button.textContent });
  }

  setupConsentObserver(settings) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.handleConsentPopups(settings, node);
            }
          });
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    logger.log('Consent observer set up');
    return observer;
  }
}

export const consentManager = new ConsentManager();