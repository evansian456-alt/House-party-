# Background Audio Feature - Manual Testing Guide

## Test Environment Setup

### Prerequisites
- Modern browser with Media Session API support (Chrome 73+, Safari 13.4+, Firefox 71+)
- Test on both desktop and mobile devices
- Audio file for testing (MP3, M4A, etc.)

### Test Scenarios

## 1. Host Background Audio Test (Desktop)

### Steps:
1. Open Phone Party in browser
2. Start a party as host
3. Upload and play an audio track
4. **Switch to another browser tab**
5. Lock screen controls should appear
6. Check lock screen notification shows:
   - Track title (cleaned, without extension)
   - Artist: "Phone Party DJ"
   - Album: "Party [CODE]"

### Expected Results:
- ✅ Audio continues playing in background
- ✅ Lock screen shows track info
- ✅ Play/pause controls work
- ✅ Skip button works
- ✅ Seek controls work
- ✅ Returning to tab maintains playback

## 2. Host Background Audio Test (Mobile)

### Steps:
1. Open Phone Party in mobile browser
2. Start a party as host
3. Upload and play an audio track
4. **Lock the device screen**
5. Check lock screen controls

### Expected Results:
- ✅ Audio plays (may stop after 30s on iOS Safari)
- ✅ Lock screen shows controls
- ✅ Play/pause works from lock screen
- ✅ Unlocking device and returning shows correct playback state

### Known Issue:
- iOS Safari: Audio may stop after ~30 seconds when screen locked (iOS limitation)
- Solution: Use iOS 15+ or add to home screen for PWA mode

## 3. Guest Background Audio Test

### Steps:
1. Device A: Start party as host, play track
2. Device B: Join party as guest
3. On Device B: Tap to sync audio
4. **Switch Device B to another tab or lock screen**
5. Check lock screen controls

### Expected Results:
- ✅ Guest audio continues playing
- ✅ Lock screen shows track title
- ✅ Artist: "Phone Party"
- ✅ Album: "Party [CODE]"
- ✅ Play/pause controls work
- ✅ Audio stays in sync (within 200ms)

## 4. Track Title Cleaning Test

### Test Files:
- `my_awesome_song.mp3`
- `favorite-track-2024.m4a`
- `PARTY_MIX_01.wav`

### Expected Display:
- "My Awesome Song"
- "Favorite Track 2024"
- "Party Mix 01"

### Steps:
1. Play each file
2. Check lock screen notification
3. Verify titles are cleaned up (no extensions, capitalized, spaces instead of underscores/hyphens)

## 5. Media Controls Test

### Play/Pause:
1. Play track
2. Go to lock screen
3. Press pause
4. **Expected**: Audio pauses
5. Press play
6. **Expected**: Audio resumes

### Skip (Host Only):
1. Queue a second track
2. Play first track
3. Go to lock screen
4. Press next/skip
5. **Expected**: Second track starts playing

### Seek Forward/Backward:
1. Play track for 30 seconds
2. Go to lock screen
3. Use seek backward control
4. **Expected**: Position moves backward ~10 seconds
5. Use seek forward control
6. **Expected**: Position moves forward ~10 seconds

### Scrubbing:
1. Play track
2. Go to lock screen
3. Drag timeline scrubber
4. **Expected**: Position updates in real-time

## 6. Position State Test

### Steps:
1. Play track
2. Go to lock screen
3. Verify position updates every second
4. Return to app
5. Verify position matches lock screen

### Expected Results:
- ✅ Position state syncs with actual playback
- ✅ Duration shows total track length
- ✅ Playback rate reflects any drift correction (guests)

## 7. Artwork Test

### Steps:
1. Play track (no custom artwork)
2. Check lock screen
3. **Expected**: Browser's generic music icon appears

### Note:
- Custom artwork is not implemented yet
- Browsers will show their default music icon
- This is correct behavior per Media Session spec

## 8. Browser Compatibility Test

### Chrome Desktop:
- [ ] Background playback works
- [ ] Lock screen controls work
- [ ] Hardware media keys work

### Chrome Mobile:
- [ ] Background playback works
- [ ] Lock screen controls work
- [ ] Notification controls work

### Safari Desktop (macOS):
- [ ] Background playback works
- [ ] Lock screen controls work
- [ ] Touch bar controls work (if available)

### Safari Mobile (iOS):
- [ ] Background playback works (note 30s limit)
- [ ] Lock screen controls work
- [ ] Control center controls work

### Firefox:
- [ ] Background playback works
- [ ] Lock screen controls work

## 9. Graceful Degradation Test

### Old Browser Test:
1. Open in browser without Media Session API (IE, old Chrome)
2. Play track
3. **Expected**: Audio works normally, no errors
4. No lock screen controls (expected)

## 10. Party Sync with Background Audio

### Multi-Device Test:
1. Device A (Host): Start party, play track
2. Device B (Guest 1): Join, sync audio
3. Device C (Guest 2): Join, sync audio
4. **All devices**: Lock screens
5. **All devices**: Audio should continue
6. Device A (Host): Skip to next track
7. **Expected**: All guests sync to new track (may need to unlock to resync)

### Sync Recovery Test:
1. Guest: Join party, sync audio
2. Guest: Lock device for 5+ minutes
3. Guest: Unlock device
4. **Expected**: 
   - Visibility change handler triggers
   - Auto-resync to current track position
   - Or "Tap to Resync" button appears

## Test Results Template

```
Date: ___________
Tester: ___________

Desktop Tests:
- [ ] Chrome: ___/10 passed
- [ ] Safari: ___/10 passed
- [ ] Firefox: ___/10 passed

Mobile Tests:
- [ ] Chrome Android: ___/10 passed
- [ ] Safari iOS: ___/10 passed

Issues Found:
1. _______________________________
2. _______________________________
3. _______________________________

Notes:
_________________________________
_________________________________
```

## Common Issues and Solutions

### Issue: Audio stops immediately when backgrounded
**Solution**: Check browser version, update to latest

### Issue: Lock screen controls don't appear
**Solution**: 
- Ensure audio is playing before backgrounding
- Check browser supports Media Session API
- Try in normal mode (not incognito)

### Issue: Position state not updating
**Solution**: Check console for errors, ensure timeupdate events are firing

### Issue: Skip button doesn't work for guests
**Solution**: This is expected - only hosts can skip tracks

### Issue: Sync drift after backgrounding
**Solution**: This is normal - visibility change handler will resync on return

## Performance Metrics to Monitor

- Battery drain during background playback
- Memory usage over time
- CPU usage during background playback
- Sync accuracy after returning from background
- Time to resync after visibility change

## Security Checks

- [ ] No additional permissions required
- [ ] No data sent to third parties
- [ ] No sensitive info in lock screen metadata
- [ ] Safe volume levels maintained
- [ ] No XSS vulnerabilities in track titles
