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
    return {
      'has_reject_all': {
        true: 'reject_all',
        false: {
          'has_manage_preferences': {
            true: 'manage_preferences',
            false: {
              'has_reject': {
                true: 'reject',
                false: 'do_nothing'
              }
            }
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
    const form = button.closest('form') || button.closest('[role="dialog"]') || document;
    const hasRejectAll = !!form.querySelector('button:contains("Reject All")');
    const hasManagePreferences = !!form.querySelector('button:contains("Manage"), button:contains("Preferences")');
    const hasReject = !!form.querySelector('button:contains("Reject")');

    let currentNode = this.decisionTree;
    while (typeof currentNode !== 'string') {
      const condition = Object.keys(currentNode)[0];
      currentNode = currentNode[condition][eval(condition)];
    }

    return currentNode;
  }

  async executeDecision(decision, button) {
    const form = button.closest('form') || button.closest('[role="dialog"]') || document;
    switch (decision) {
      case 'reject_all':
        const rejectAllButton = form.querySelector('button:contains("Reject All")');
        if (rejectAllButton) {
          await this.clickConsentButton(rejectAllButton);
        }
        break;
      case 'manage_preferences':
        const manageButton = form.querySelector('button:contains("Manage"), button:contains("Preferences")');
        if (manageButton) {
          await this.clickConsentButton(manageButton);
          await this.handlePreferencesPage(form);
        }
        break;
      case 'reject':
        const rejectButton = form.querySelector('button:contains("Reject")');
        if (rejectButton) {
          await this.clickConsentButton(rejectButton);
        }
        break;
      case 'do_nothing':
        logger.log('No clear consent decision, doing nothing');
        break;
    }
  }

  async handlePreferencesPage(form) {
    // Wait for preferences to load
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Uncheck all non-essential checkboxes
    const checkboxes = form.querySelectorAll('input[type="checkbox"]');
    for (const checkbox of checkboxes) {
      const label = checkbox.closest('label') || document.querySelector(`label[for="${checkbox.id}"]`);
      if (label && !this.isEssentialCookie(label.textContent)) {
        if (checkbox.checked) {
          await this.clickConsentButton(checkbox);
        }
      }
    }

    // Find and click the save/confirm button
    const saveButton = form.querySelector('button:contains("Save"), button:contains("Confirm")');
    if (saveButton) {
      await this.clickConsentButton(saveButton);
    }
  }

  isEssentialCookie(text) {
    const essentialKeywords = ['necessary', 'essential', 'required', 'functional'];
    return essentialKeywords.some(keyword => text.toLowerCase().includes(keyword));
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
