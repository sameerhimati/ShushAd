import { logger } from './logger.js';
import { randomizeAction } from './antiDetection.js';

class MediaController {
  constructor() {
    this.mutedElements = new WeakMap();
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  async muteElement(element) {
    if (element instanceof HTMLMediaElement) {
      await this.muteMediaElement(element);
    } else if (element instanceof HTMLIFrameElement) {
      await this.muteFrame(element);
    } else {
      logger.warn('Attempted to mute non-media element', { element });
    }
  }

  async muteMediaElement(mediaElement) {
    if (!this.mutedElements.has(mediaElement)) {
      const gainNode = this.audioContext.createGain();
      const source = this.audioContext.createMediaElementSource(mediaElement);
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      await randomizeAction(() => {
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        this.mutedElements.set(mediaElement, { gainNode, originalVolume: mediaElement.volume });
      });
      logger.info('Media element muted', { element: mediaElement });
    }
  }

  async muteFrame(frame) {
    try {
      await randomizeAction(() => {
        frame.contentWindow.postMessage({ action: 'muteMedia' }, '*');
      });
      logger.info('Mute message sent to frame', { frame });
    } catch (error) {
      logger.error('Error muting frame', error);
    }
  }

  async unmuteElement(element) {
    if (element instanceof HTMLMediaElement) {
      await this.unmuteMediaElement(element);
    } else if (element instanceof HTMLIFrameElement) {
      await this.unmuteFrame(element);
    } else {
      logger.warn('Attempted to unmute non-media element', { element });
    }
  }

  async unmuteMediaElement(mediaElement) {
    const mutedData = this.mutedElements.get(mediaElement);
    if (mutedData) {
      await randomizeAction(() => {
        mutedData.gainNode.gain.setValueAtTime(1, this.audioContext.currentTime);
        mediaElement.volume = mutedData.originalVolume;
        this.mutedElements.delete(mediaElement);
      });
      logger.info('Media element unmuted', { element: mediaElement });
    }
  }

  async unmuteFrame(frame) {
    try {
      await randomizeAction(() => {
        frame.contentWindow.postMessage({ action: 'unmuteMedia' }, '*');
      });
      logger.info('Unmute message sent to frame', { frame });
    } catch (error) {
      logger.error('Error unmuting frame', error);
    }
  }

  async pauseElement(element) {
    if (element instanceof HTMLMediaElement) {
      await randomizeAction(() => {
        element.pause();
      });
      logger.info('Media element paused', { element });
    } else {
      logger.warn('Attempted to pause non-media element', { element });
    }
  }

  setupPictureInPicture(videoElement) {
    if (document.pictureInPictureEnabled && !videoElement.disablePictureInPicture) {
      videoElement.addEventListener('enterpictureinpicture', () => {
        logger.info('Video entered picture-in-picture mode');
      });
      videoElement.addEventListener('leavepictureinpicture', () => {
        logger.info('Video left picture-in-picture mode');
      });
    }
  }

  async togglePictureInPicture(videoElement) {
    try {
      if (!document.pictureInPictureElement) {
        await videoElement.requestPictureInPicture();
      } else {
        await document.exitPictureInPicture();
      }
    } catch (error) {
      logger.error('Error toggling picture-in-picture', error);
    }
  }

  listenForFrameMessages() {
    window.addEventListener('message', (event) => {
      if (event.data.action === 'muteMedia') {
        this.muteAllMediaInDocument();
      } else if (event.data.action === 'unmuteMedia') {
        this.unmuteAllMediaInDocument();
      }
    });
  }

  muteAllMediaInDocument() {
    document.querySelectorAll('video, audio').forEach(mediaElement => {
      this.muteMediaElement(mediaElement);
    });
  }

  unmuteAllMediaInDocument() {
    document.querySelectorAll('video, audio').forEach(mediaElement => {
      this.unmuteMediaElement(mediaElement);
    });
  }
}

export const mediaController = new MediaController();
mediaController.listenForFrameMessages();