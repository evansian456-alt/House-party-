# Background Audio Feature Documentation

## Overview

Phone Party now supports **background audio playback** using the Media Session API. This feature allows audio to continue playing when:
- The browser tab is in the background
- The device screen is locked
- The user switches to another app (on mobile)

## Features

### 🎵 Continuous Playback
- Audio continues playing even when the browser tab is not visible
- Maintains sync across all devices when backgrounded
- Automatic resync when returning to foreground

### 🎮 Lock Screen Controls
- Track title, artist, and artwork displayed on lock screen
- Play/pause controls
- Skip track (for hosts)
- Seek forward/backward
- Scrubbing timeline support

### ⌨️ Hardware Media Keys
- Works with keyboard media keys
- Bluetooth headset controls
- Car stereo controls
- Any standard media control hardware

## Browser Support

The Media Session API is supported in:

| Browser | Support | Notes |
|---------|---------|-------|
| **Chrome (Android)** | ✅ Full | Best experience |
| **Chrome (Desktop)** | ✅ Full | Works great |
| **Safari (iOS)** | ✅ Full | iOS 13.4+ |
| **Safari (macOS)** | ✅ Full | macOS Big Sur+ |
| **Firefox** | ✅ Full | Desktop and Android |
| **Edge** | ✅ Full | Chromium-based |

## How It Works

### For Hosts (DJs)

1. **Select and play a track** as normal
2. **Switch to another tab** or lock your device
3. **Control playback** from:
   - Lock screen
   - Notification center
   - Hardware media keys
   - Bluetooth controls

The track title and party code are displayed on the lock screen notification.

### For Guests

1. **Join a party** and sync to the host's music
2. **Switch to another tab** or lock your device
3. **View now playing** on lock screen
4. **Control your volume** using device controls

Guest audio stays synchronized even when backgrounded.

## Technical Implementation

### Media Session API Integration

Phone Party uses the standard [Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API) which provides:

1. **Metadata Display**
   - Track title
   - Artist name (shown as "Phone Party DJ" for hosts)
   - Album/Party code
   - Artwork (default Phone Party icon)

2. **Action Handlers**
   - `play` - Resume playback
   - `pause` - Pause playback
   - `nexttrack` - Skip to next track (host only)
   - `seekforward` - Jump forward 10 seconds
   - `seekbackward` - Jump backward 10 seconds
   - `seekto` - Scrub to specific position

3. **Position State**
   - Current playback position
   - Total track duration
   - Playback rate (for drift correction)

### Automatic Position Updates

The position state is automatically updated:
- Every `timeupdate` event (multiple times per second)
- When playback starts
- When seeking
- During drift correction (for guests)

### Graceful Degradation

On browsers without Media Session API support:
- Audio still works normally
- Background playback may be limited by browser
- No lock screen controls
- No errors or warnings to users

## Privacy & Security

### No Additional Permissions Required
- Media Session API doesn't require microphone/camera access
- No location tracking
- No background data collection

### User Control
- Users can pause via lock screen at any time
- Closing the browser tab stops playback
- Standard browser privacy controls apply

## Comparison with AmpMe

| Feature | Phone Party | AmpMe |
|---------|-------------|-------|
| Background Playback | ✅ Via Media Session API | ✅ Native app background |
| Lock Screen Controls | ✅ Full controls | ✅ Full controls |
| Artwork Display | ✅ Default icon | ✅ Album artwork |
| Hardware Keys | ✅ Supported | ✅ Supported |
| Implementation | Web standard | Native code |
| Installation | None needed | App download required |

## Known Limitations

### Browser Limitations
- **iOS Safari**: Background audio may stop after ~30 seconds when screen is off (iOS limitation, not Phone Party)
- **Mobile Chrome**: Works best in PWA mode
- **Desktop Browsers**: No known limitations

### Feature Limitations
- Album artwork uses default Phone Party icon (no custom artwork yet)
- Previous track navigation not implemented (single-direction queue)
- Battery usage may be higher during background playback

## Future Enhancements

Planned improvements:
- [ ] Custom album artwork from audio file metadata
- [ ] Support for uploaded artwork/logos
- [ ] Playlist navigation controls
- [ ] Better PWA integration for longer background playback
- [ ] Lyrics display on lock screen (Media Session v2)

## Troubleshooting

### Audio stops when screen locks (iOS)
**Issue**: iOS Safari may pause audio after ~30 seconds when screen is locked.

**Solutions**:
- Keep screen on during playback
- Add to home screen for better PWA experience
- Use iOS 15+ for improved background audio

### Lock screen controls not appearing
**Possible causes**:
1. Browser doesn't support Media Session API (check browser version)
2. Audio hasn't started playing yet
3. Page was loaded in incognito mode (some browsers limit Media Session)

**Solutions**:
- Update browser to latest version
- Start playing audio first, then lock screen
- Use normal browsing mode (not incognito)

### Controls work but audio is out of sync
**Issue**: Normal drift correction behavior.

**Solution**:
- Return to app to resync
- Use the "Resync" button if it appears
- Automatic resync happens when tab becomes visible again

## Developer Notes

### Files Modified
- `media-session.js` - Core Media Session API integration
- `app.js` - Integration with host and guest audio players
- `index.html` - Script tag for media-session.js

### API Usage
```javascript
// Initialize (called once on app load)
initMediaSession();

// Update metadata when track starts
updateMediaSessionMetadata({
  title: 'Song Title',
  artist: 'Artist Name',
  album: 'Album or Party Code'
});

// Update position during playback
updateMediaSessionPosition(
  duration,    // Total track length in seconds
  position,    // Current position in seconds
  playbackRate // Current playback rate (1.0 = normal)
);

// Clear metadata when track ends
clearMediaSessionMetadata();
```

### Testing
- Run unit tests: `npm test media-session.test.js`
- Manual testing on real devices recommended
- Test on both mobile and desktop browsers
- Test with different media control hardware

## References

- [MDN: Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API)
- [W3C Media Session Specification](https://www.w3.org/TR/mediasession/)
- [Google: Media Session Best Practices](https://web.dev/media-session/)

---

**Last Updated**: February 2026  
**Feature Version**: 1.0  
**Minimum Browser Requirements**: Chrome 73+, Safari 13.4+, Firefox 71+
