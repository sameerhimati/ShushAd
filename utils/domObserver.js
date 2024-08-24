import { logger } from './logger.js';

class DOMObserver {
  constructor() {
    this.observer = null;
    this.callbacks = new Set();
    this.queue = [];
    this.isProcessing = false;
  }

  observe(callback) {
    this.callbacks.add(callback);

    if (!this.observer) {
      this.observer = new MutationObserver(this.handleMutations.bind(this));
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });
      logger.log('DOM observer started');
    }
  }

  handleMutations(mutations) {
    this.queue.push(...mutations);
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  async processQueue() {
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const mutations = this.queue.splice(0, 10); // Process in batches of 10
      await this.processMutationBatch(mutations);
      await new Promise(resolve => requestIdleCallback(resolve));
    }
    this.isProcessing = false;
  }

  async processMutationBatch(mutations) {
    const addedNodes = new Set();
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            addedNodes.add(node);
          }
        });
      }
    });

    const promises = Array.from(this.callbacks).map(callback => callback(Array.from(addedNodes)));
    await Promise.all(promises);
  }

  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      this.callbacks.clear();
      this.queue = [];
      this.isProcessing = false;
      logger.log('DOM observer disconnected');
    }
  }

  reconnect() {
    this.disconnect();
    this.observe(Array.from(this.callbacks)[0]); // Reconnect with the first callback
    logger.log('DOM observer reconnected');
  }
}

export const domObserver = new DOMObserver();