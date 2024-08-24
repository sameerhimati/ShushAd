class Logger {
    constructor() {
      this.enabled = false;
      this.logQueue = [];
      this.maxQueueSize = 100;
      this.logLevels = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
      };
      this.currentLogLevel = this.logLevels.INFO;
    }
  
    setEnabled(enabled) {
      this.enabled = enabled;
      if (enabled) {
        this.flushQueue();
      }
    }
  
    setLogLevel(level) {
      if (this.logLevels.hasOwnProperty(level)) {
        this.currentLogLevel = this.logLevels[level];
      }
    }
  
    log(message, data = {}, level = 'INFO') {
      if (this.logLevels[level] >= this.currentLogLevel) {
        this.addLogEntry(level, message, data);
      }
    }
  
    debug(message, data = {}) {
      this.log(message, data, 'DEBUG');
    }
  
    info(message, data = {}) {
      this.log(message, data, 'INFO');
    }
  
    warn(message, data = {}) {
      this.log(message, data, 'WARN');
    }
  
    error(message, error = {}) {
      this.addLogEntry('ERROR', message, {
        error: error.toString(),
        stack: error.stack
      });
    }
  
    addLogEntry(level, message, data) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        data
      };
  
      if (this.enabled) {
        console[level.toLowerCase()]('Smart Ad Handler:', logEntry);
        this.sendLogToBackground(logEntry);
      } else {
        this.queueLog(logEntry);
      }
    }
  
    queueLog(logEntry) {
      this.logQueue.push(logEntry);
      if (this.logQueue.length > this.maxQueueSize) {
        this.logQueue.shift();
      }
    }
  
    flushQueue() {
      const batchSize = 10;
      while (this.logQueue.length > 0) {
        const batch = this.logQueue.splice(0, batchSize);
        batch.forEach(logEntry => {
          console[logEntry.level.toLowerCase()]('Smart Ad Handler (Queued):', logEntry);
          this.sendLogToBackground(logEntry);
        });
      }
    }
  
    sendLogToBackground(logEntry) {
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(logEntry)], { type: 'application/json' });
        navigator.sendBeacon(chrome.runtime.getURL('log'), blob);
      } else {
        chrome.runtime.sendMessage({
          action: 'addLog',
          log: logEntry
        }).catch(error => console.error('Error sending log to background:', error));
      }
    }
  }
  
  export const logger = new Logger();
  
  // Initialize logger state
  chrome.storage.sync.get('settings').then(result => {
    logger.setEnabled(result.settings?.enableLogging || false);
    logger.setLogLevel(result.settings?.logLevel || 'INFO');
  });
  
  // Listen for setting changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.settings?.newValue) {
      logger.setEnabled(changes.settings.newValue.enableLogging || false);
      logger.setLogLevel(changes.settings.newValue.logLevel || 'INFO');
    }
  });