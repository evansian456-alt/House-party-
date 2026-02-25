/**
 * Media Session API Integration for Background Audio
 * 
 * Enables background playback and lock screen controls for Phone Party
 * This allows audio to continue playing when the browser tab is backgrounded
 * or when the device screen is locked.
 * 
 * Features:
 * - Lock screen media controls
 * - Notification with track info and artwork
 * - Background audio playback (browser permitting)
 * - Hardware media key support
 */

/**
 * Initialize Media Session API
 * Call this once when the app loads
 */
function initMediaSession() {
  if (!('mediaSession' in navigator)) {
    console.warn('[MediaSession] Media Session API not supported');
    return false;
  }
  
  console.log('[MediaSession] Initializing Media Session API');
  
  // Set up action handlers (will be updated when track plays)
  setupMediaSessionHandlers();
  
  return true;
}

/**
 * Update Media Session metadata with current track info
 * @param {Object} trackInfo - Track information
 * @param {string} trackInfo.title - Track title
 * @param {string} trackInfo.artist - Artist name (optional)
 * @param {string} trackInfo.album - Album name (optional)
 * @param {string} trackInfo.artwork - Artwork URL (optional)
 */
function updateMediaSessionMetadata(trackInfo) {
  if (!('mediaSession' in navigator)) {
    return;
  }
  
  const { title = 'Unknown Track', artist = 'Phone Party', album = '', artwork } = trackInfo;
  
  // Build artwork array
  const artworkArray = [];
  if (artwork) {
    artworkArray.push({
      src: artwork,
      sizes: '512x512',
      type: 'image/png'
    });
  }
  // Note: No default artwork if none provided - this is valid per Media Session spec
  // Browsers will show a generic music icon if no artwork is specified
  
  navigator.mediaSession.metadata = new MediaMetadata({
    title: title,
    artist: artist,
    album: album,
    artwork: artworkArray.length > 0 ? artworkArray : undefined
  });
  
  console.log('[MediaSession] Metadata updated:', title);
}

/**
 * Update Media Session position state
 * @param {number} duration - Total track duration in seconds
 * @param {number} position - Current playback position in seconds
 * @param {number} playbackRate - Current playback rate (default 1.0)
 */
function updateMediaSessionPosition(duration, position, playbackRate = 1.0) {
  if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) {
    return;
  }
  
  try {
    navigator.mediaSession.setPositionState({
      duration: duration,
      playbackRate: playbackRate,
      position: position
    });
  } catch (error) {
    console.warn('[MediaSession] Error setting position state:', error);
  }
}

/**
 * Set up Media Session action handlers
 * These handlers connect lock screen controls to app functions
 */
function setupMediaSessionHandlers() {
  if (!('mediaSession' in navigator)) {
    return;
  }
  
  // Play action
  navigator.mediaSession.setActionHandler('play', () => {
    console.log('[MediaSession] Play action triggered');
    
    // For host: trigger play button
    if (state.isHost) {
      const audioEl = musicState.audioElement;
      if (audioEl && audioEl.paused) {
        audioEl.play().catch(err => console.error('[MediaSession] Play failed:', err));
      }
    } 
    // For guest: resume audio
    else {
      if (state.guestAudioElement && state.guestAudioElement.paused) {
        state.guestAudioElement.play().catch(err => console.error('[MediaSession] Play failed:', err));
      }
    }
  });
  
  // Pause action
  navigator.mediaSession.setActionHandler('pause', () => {
    console.log('[MediaSession] Pause action triggered');
    
    // For host: trigger pause button
    if (state.isHost) {
      const audioEl = musicState.audioElement;
      if (audioEl && !audioEl.paused) {
        audioEl.pause();
      }
    }
    // For guest: pause audio (though this might desync)
    else {
      if (state.guestAudioElement && !state.guestAudioElement.paused) {
        state.guestAudioElement.pause();
      }
    }
  });
  
  // Next track action (host only)
  navigator.mediaSession.setActionHandler('nexttrack', () => {
    console.log('[MediaSession] Next track action triggered');
    
    if (state.isHost) {
      // Trigger the skip button
      const skipBtn = document.getElementById('btnSkip');
      if (skipBtn) {
        skipBtn.click();
      }
    }
  });
  
  // Previous track action (not implemented yet, but reserve it)
  navigator.mediaSession.setActionHandler('previoustrack', () => {
    console.log('[MediaSession] Previous track action triggered (not implemented)');
  });
  
  // Seek backward action
  navigator.mediaSession.setActionHandler('seekbackward', (details) => {
    console.log('[MediaSession] Seek backward action triggered');
    
    const skipTime = details.seekOffset || 10; // Default 10 seconds
    
    if (state.isHost) {
      const audioEl = musicState.audioElement;
      if (audioEl) {
        audioEl.currentTime = Math.max(0, audioEl.currentTime - skipTime);
      }
    } else {
      if (state.guestAudioElement) {
        state.guestAudioElement.currentTime = Math.max(0, state.guestAudioElement.currentTime - skipTime);
      }
    }
  });
  
  // Seek forward action
  navigator.mediaSession.setActionHandler('seekforward', (details) => {
    console.log('[MediaSession] Seek forward action triggered');
    
    const skipTime = details.seekOffset || 10; // Default 10 seconds
    
    if (state.isHost) {
      const audioEl = musicState.audioElement;
      if (audioEl) {
        audioEl.currentTime = Math.min(audioEl.duration || 0, audioEl.currentTime + skipTime);
      }
    } else {
      if (state.guestAudioElement) {
        state.guestAudioElement.currentTime = Math.min(
          state.guestAudioElement.duration || 0,
          state.guestAudioElement.currentTime + skipTime
        );
      }
    }
  });
  
  // Seek to action (scrubbing)
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    console.log('[MediaSession] Seek to action triggered:', details.seekTime);
    
    if (state.isHost) {
      const audioEl = musicState.audioElement;
      if (audioEl && details.seekTime !== undefined) {
        audioEl.currentTime = details.seekTime;
      }
    } else {
      if (state.guestAudioElement && details.seekTime !== undefined) {
        state.guestAudioElement.currentTime = details.seekTime;
      }
    }
  });
  
  console.log('[MediaSession] Action handlers configured');
}

/**
 * Clear Media Session metadata
 * Call this when no track is playing
 */
function clearMediaSessionMetadata() {
  if (!('mediaSession' in navigator)) {
    return;
  }
  
  navigator.mediaSession.metadata = null;
  console.log('[MediaSession] Metadata cleared');
}

// Export functions for use in app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initMediaSession,
    updateMediaSessionMetadata,
    updateMediaSessionPosition,
    setupMediaSessionHandlers,
    clearMediaSessionMetadata
  };
}
