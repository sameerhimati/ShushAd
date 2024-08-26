let state = {
  settings: {},
  stats: {
    adsHandled: 0,
    cookiesManaged: 0
  }
};

export function initializeState() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['settings', 'stats'], (result) => {
      if (result.settings) {
        state.settings = result.settings;
      }
      if (result.stats) {
        state.stats = result.stats;
      }
      logger.log('State initialized', state);
      resolve();
    });
  });
}

export function updateState(newState) {
  state = { ...state, ...newState };
  return chrome.storage.sync.set(newState);
}

export function getState() {
  return state;
}