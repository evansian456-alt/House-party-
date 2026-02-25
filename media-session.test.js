/**
 * Tests for Media Session API Integration
 */

// Mock navigator.mediaSession
const mockMediaSession = {
  metadata: null,
  playbackState: 'none',
  setActionHandler: jest.fn(),
  setPositionState: jest.fn()
};

// Mock MediaMetadata
global.MediaMetadata = jest.fn((metadata) => metadata);

// Set up navigator mock
global.navigator = {
  mediaSession: mockMediaSession
};

// Import the module
const {
  initMediaSession,
  updateMediaSessionMetadata,
  updateMediaSessionPosition,
  clearMediaSessionMetadata
} = require('./media-session.js');

describe('Media Session API Integration', () => {
  beforeEach(() => {
    // Reset mocks
    mockMediaSession.metadata = null;
    mockMediaSession.setActionHandler.mockClear();
    mockMediaSession.setPositionState.mockClear();
  });

  describe('initMediaSession', () => {
    it('should initialize Media Session API when supported', () => {
      const result = initMediaSession();
      
      expect(result).toBe(true);
      expect(mockMediaSession.setActionHandler).toHaveBeenCalled();
    });

    it('should set up all required action handlers', () => {
      initMediaSession();
      
      const expectedActions = [
        'play',
        'pause',
        'nexttrack',
        'previoustrack',
        'seekbackward',
        'seekforward',
        'seekto'
      ];
      
      expectedActions.forEach(action => {
        expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith(
          action,
          expect.any(Function)
        );
      });
    });
  });

  describe('updateMediaSessionMetadata', () => {
    it('should update metadata with track info (no artwork)', () => {
      const trackInfo = {
        title: 'Test Track',
        artist: 'Test Artist',
        album: 'Test Album'
      };
      
      updateMediaSessionMetadata(trackInfo);
      
      expect(mockMediaSession.metadata).toEqual({
        title: 'Test Track',
        artist: 'Test Artist',
        album: 'Test Album',
        artwork: undefined
      });
    });

    it('should use default values when track info is minimal', () => {
      updateMediaSessionMetadata({});
      
      expect(mockMediaSession.metadata.title).toBe('Unknown Track');
      expect(mockMediaSession.metadata.artist).toBe('Phone Party');
    });

    it('should include artwork when provided', () => {
      updateMediaSessionMetadata({
        title: 'Test',
        artwork: '/test-artwork.png'
      });
      
      expect(mockMediaSession.metadata.artwork).toContainEqual(
        expect.objectContaining({
          src: '/test-artwork.png'
        })
      );
    });

    it('should use no artwork when not provided (browsers show generic icon)', () => {
      updateMediaSessionMetadata({ title: 'Test' });
      
      expect(mockMediaSession.metadata.artwork).toBeUndefined();
    });
  });

  describe('updateMediaSessionPosition', () => {
    it('should update position state', () => {
      updateMediaSessionPosition(300, 150, 1.0);
      
      expect(mockMediaSession.setPositionState).toHaveBeenCalledWith({
        duration: 300,
        position: 150,
        playbackRate: 1.0
      });
    });

    it('should handle default playback rate', () => {
      updateMediaSessionPosition(300, 150);
      
      expect(mockMediaSession.setPositionState).toHaveBeenCalledWith({
        duration: 300,
        position: 150,
        playbackRate: 1.0
      });
    });
  });

  describe('clearMediaSessionMetadata', () => {
    it('should clear metadata', () => {
      mockMediaSession.metadata = { title: 'Test' };
      
      clearMediaSessionMetadata();
      
      expect(mockMediaSession.metadata).toBeNull();
    });
  });

  describe('When Media Session API is not supported', () => {
    beforeEach(() => {
      // Temporarily remove mediaSession
      delete global.navigator.mediaSession;
    });

    afterEach(() => {
      // Restore
      global.navigator.mediaSession = mockMediaSession;
    });

    it('initMediaSession should return false', () => {
      const result = initMediaSession();
      expect(result).toBe(false);
    });

    it('updateMediaSessionMetadata should not throw', () => {
      expect(() => {
        updateMediaSessionMetadata({ title: 'Test' });
      }).not.toThrow();
    });

    it('updateMediaSessionPosition should not throw', () => {
      expect(() => {
        updateMediaSessionPosition(300, 150);
      }).not.toThrow();
    });
  });
});
