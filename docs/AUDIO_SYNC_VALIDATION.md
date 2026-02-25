# Audio Sync Validation Guide

This document provides a deterministic checklist for validating that audio synchronization works correctly after deployment, especially on Railway.

## Prerequisites

- App deployed to Railway with all services configured
- Two devices/browsers for testing (host and guest)
- Audio file ready for testing (MP3 or M4A, 2-5 minutes long)
- Browser dev tools access (for network inspection)

## Test Environment Setup

### Device 1: Host
- Open Chrome/Firefox/Safari
- Open Developer Tools (F12)
- Navigate to Network tab
- Keep Dev Tools open throughout test

### Device 2: Guest
- Use different browser or incognito/private window
- Open Developer Tools (F12)
- Navigate to Network tab
- Keep Dev Tools open throughout test

## Validation Checklist

### Phase 1: System Health Check

#### Step 1.1: Check Server Health
```bash
curl https://your-app.up.railway.app/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "uptime": <number>,
  "redis": { "status": "connected" },
  "database": { "status": "connected" }
}
```

**✅ Pass Criteria:**
- Response status: 200
- `status`: "healthy"
- `redis.status`: "connected"
- `database.status`: "connected"

**❌ Fail:** If any service shows disconnected, fix configuration before proceeding.

---

#### Step 1.2: Check Storage Provider
Look for this in Railway logs:

```
[Storage] Initializing storage provider...
[Storage] Using S3-compatible storage
[S3] Initialized S3 provider
[S3] Bucket: your-bucket-name
```

**✅ Pass Criteria:**
- Storage provider initialized
- No storage errors in logs
- If using S3: Bucket and credentials logged

**❌ Fail:** If "Storage service not available" appears, fix S3 configuration.

---

### Phase 2: Party Creation and Join

#### Step 2.1: Host Creates Party (Device 1)

1. Open app URL: `https://your-app.up.railway.app`
2. Click "Start a Party"
3. Enter DJ name (e.g., "Host")
4. Click "Create Party"

**Expected:**
- Party code appears (e.g., "A5K9")
- URL updates to include code: `?code=A5K9`
- WebSocket connected (check Network tab → WS)

**✅ Pass Criteria:**
- Party code visible on screen
- No "Failed to create party" errors
- Console shows: `[WS] Party created`

**❌ Fail:** If party creation fails, check Redis connection.

---

#### Step 2.2: Guest Joins Party (Device 2)

1. Open app URL: `https://your-app.up.railway.app`
2. Click "Join Party"
3. Enter party code from Step 2.1
4. Enter guest name (e.g., "Guest")
5. Click "Join"

**Expected:**
- Successfully joins party
- Sees "Waiting for host to play music"
- WebSocket connected

**In Host Browser (Device 1):**
- Guest count updates to "1 guest"
- Guest name appears in party

**✅ Pass Criteria:**
- Guest successfully joins
- Host sees guest in party
- Both consoles show: `[WS] Client X joined party`

**❌ Fail:** If "Party not found", check Redis and party state.

---

### Phase 3: Audio Upload and Preparation

#### Step 3.1: Host Selects Audio File

**On Device 1 (Host):**
1. Click "Choose File" or file input
2. Select audio file (MP3/M4A, 2-5MB)
3. Wait for upload

**Monitor in Network Tab:**
- Look for `POST /api/upload-track` request
- Should complete successfully (200 status)

**Expected Response:**
```json
{
  "ok": true,
  "trackId": "ABC123...",
  "trackUrl": "https://your-app.up.railway.app/api/track/ABC123...",
  "title": "filename.mp3",
  "sizeBytes": 2048576,
  "contentType": "audio/mpeg"
}
```

**✅ Pass Criteria:**
- Upload completes with 200 status
- `trackUrl` starts with `https://` (not `http://`)
- `trackUrl` includes your Railway domain
- trackId is present
- Console shows: `Track uploaded: ABC123...`

**❌ Fail Scenarios:**

| Error | Cause | Fix |
|-------|-------|-----|
| "Storage service not available" | S3 not configured | Check S3 environment variables |
| trackUrl starts with `http://` | PUBLIC_BASE_URL not set | Set PUBLIC_BASE_URL=https://your-domain |
| 503 error | Storage initialization failed | Check Railway logs |

---

#### Step 3.2: Verify Upload Status

**On Device 1 (Host):**
- Wait for upload to complete
- Status should show "Ready" or similar
- Play button should be enabled

**Check Console:**
```
[HTTP] Track uploaded: ABC123..., file: test.mp3, size: 2048576 bytes
[Storage] Uploaded track ABC123... to <storage-key>
```

**✅ Pass Criteria:**
- Upload status: "Ready"
- No errors in console
- Play button is clickable (not disabled)

**❌ Fail:** If play button stays disabled, check client-side upload status logic.

---

### Phase 4: Playback Synchronization Test

#### Step 4.1: Host Initiates Playback

**On Device 1 (Host):**
1. Click "Play" button
2. Observe host audio starts playing
3. Watch console for WebSocket messages

**Expected Console Output (Host):**
```
[Music] Playback started
[WS] Client X sent type: HOST_PLAY, size: ...
[Party] Track scheduled: test.mp3, position: 0s, start in 1200ms
[Party] Track playing: test.mp3
```

**Expected Network Activity (Host):**
- WebSocket messages sent: `HOST_PLAY`
- No HTTP errors

**✅ Pass Criteria:**
- Audio plays on host device
- No "Upload in progress" warning
- Console shows playback started

**❌ Fail Scenarios:**

| Error | Cause | Fix |
|-------|-------|-----|
| "Upload in progress - please wait" | trackUrl not ready | Check upload status |
| "Cannot start synced playback without track URL" | Server guard triggered | Check server logs |
| Play button does nothing | Client guard blocked | Check musicState.currentTrack |

---

#### Step 4.2: Guest Receives and Plays Audio

**On Device 2 (Guest):**

**Monitor Console:**
```
[WS] Received PREPARE_PLAY
[WS] Received PLAY_AT
[Guest] Loading audio: https://your-app.up.railway.app/api/track/ABC123...
[Guest] Audio ready, scheduled to play at <timestamp>
```

**Monitor Network Tab:**
1. Look for `GET /api/track/ABC123...`
2. Should see HTTP 206 (Partial Content) or 200
3. Response headers should include:
   - `Accept-Ranges: bytes`
   - `Content-Type: audio/mpeg` (or appropriate type)
   - `Content-Range: bytes X-Y/Z` (if 206)

**Expected Response Headers:**
```
Status: 206 Partial Content
Accept-Ranges: bytes
Content-Type: audio/mpeg
Content-Range: bytes 0-524287/2048576
Content-Length: 524288
```

**Expected Behavior:**
- Guest audio element loads
- Guest audio starts playing automatically
- Visual indicator shows "Playing"

**✅ Pass Criteria:**
- Network request returns 206 or 200
- `trackUrl` uses `https://`
- Audio loads and plays on guest device
- Guest sees "Playing" status

**❌ Fail Scenarios:**

| Error | Cause | Fix |
|-------|-------|-----|
| "Host is playing locally - no audio sync available" | trackUrl was null | Check Section 1 guards |
| 404 on /api/track/:id | Storage provider can't find track | Check storage logs |
| CORS error | PUBLIC_BASE_URL mismatch | Verify PUBLIC_BASE_URL matches domain |
| Mixed content error | trackUrl uses http:// | Set PUBLIC_BASE_URL with https:// |
| 416 Range Not Satisfiable | Invalid range request | Check storage Range handling |

---

#### Step 4.3: Verify Synchronization Accuracy

**Timing Test:**

1. Use a song with clear beats or time markers
2. Start playback
3. Listen on both devices simultaneously
4. Verify audio is in sync (within 300ms tolerance)

**Manual Verification:**
- Play for 30 seconds
- Both devices should hear the same part of the song
- No noticeable echo or delay

**Console Verification (Guest):**
Look for drift detection logs:
```
[Sync] Current drift: 45ms (acceptable)
```

**✅ Pass Criteria:**
- Audio plays on both devices
- No audible delay/echo between devices
- Drift stays under 300ms (check console)
- No "resync" events triggered

**❌ Fail:** If drift exceeds 5 seconds, check:
- Network latency
- Clock synchronization (TIME_PING/PONG)
- Server timing in PREPARE_PLAY/PLAY_AT messages

---

### Phase 5: Range Request Support (Mobile/Seeking)

#### Step 5.1: Test Seeking (Host)

**On Device 1 (Host):**
1. While audio is playing, drag seek bar to middle of track
2. Verify seeking works

**Monitor Network Tab:**
- Should see new `GET /api/track/ABC123...` requests
- With `Range: bytes=X-Y` headers

**✅ Pass Criteria:**
- Seeking works smoothly
- Network shows Range requests
- Server returns 206 status

**❌ Fail:** If seeking doesn't work:
- Check storage provider Range support
- Verify 206 response with Content-Range header

---

#### Step 5.2: Mobile Device Test (Optional but Recommended)

**On Mobile Device:**
1. Join party as guest
2. Start playback
3. Verify audio plays on mobile

**Common Mobile Issues:**
- iOS requires user interaction before autoplay
- Android Chrome may need gesture first
- Check for HTTPS (required for mobile audio)

**✅ Pass Criteria:**
- Audio loads and plays on mobile
- Sync accuracy maintained
- No mixed content warnings

---

### Phase 6: Error Recovery and Edge Cases

#### Test 6.1: Upload During Active Party

1. With guest still connected, upload a new track on host
2. Verify new track uploads successfully
3. Play new track
4. Verify guest receives new track URL

**✅ Pass Criteria:**
- Second upload succeeds
- Guest automatically gets new track
- Playback sync maintained

---

#### Test 6.2: Late Joiner

1. Start playback on host with track playing
2. Have new guest join mid-track
3. Verify new guest:
   - Receives current playback state
   - Starts playing from current position
   - Syncs correctly

**Expected Console (New Guest):**
```
[WS] Received REQUEST_SYNC_STATE
[WS] Received current track info
[Guest] Syncing to position: 45.2s
```

**✅ Pass Criteria:**
- Late joiner hears audio from current position
- No "start from beginning" behavior
- Drift stays under 300ms

---

#### Test 6.3: Network Interruption Recovery

1. While playing, briefly disable guest's network (airplane mode 3 seconds)
2. Re-enable network
3. Verify guest automatically resyncs

**Expected Console:**
```
[WS] Connection lost
[WS] Reconnecting...
[WS] Reconnected
[Sync] Requesting current state
[Sync] Resynced to position: 48.7s
```

**✅ Pass Criteria:**
- Guest auto-reconnects
- Audio resumes from correct position
- Drift correction applied if needed

---

## Production Validation Checklist

After deployment, verify all items:

### Configuration
- [ ] `/health` endpoint returns healthy status
- [ ] `PUBLIC_BASE_URL` is set correctly
- [ ] S3 storage configured and working
- [ ] Redis connected
- [ ] PostgreSQL connected

### Upload Flow
- [ ] File upload completes successfully
- [ ] `trackUrl` uses `https://` 
- [ ] `trackUrl` includes correct domain
- [ ] Upload status shows "Ready" before play

### Playback Flow
- [ ] Host can only play when upload ready
- [ ] Server rejects play without trackUrl (multi-member parties)
- [ ] Guest receives `PREPARE_PLAY` message
- [ ] Guest receives `PLAY_AT` message
- [ ] Guest audio loads from `/api/track/:id`
- [ ] Network shows 206 Partial Content
- [ ] Range request headers present

### Synchronization
- [ ] Audio plays on both host and guest
- [ ] No "Host is playing locally" message
- [ ] Sync accuracy under 300ms
- [ ] Drift correction works
- [ ] Late joiners sync to current position

### Edge Cases
- [ ] Multiple uploads work
- [ ] Late joiners sync correctly
- [ ] Network interruption recovery works
- [ ] Seeking works on host
- [ ] Mobile playback works (if testing mobile)

## Troubleshooting Quick Reference

### Symptom: "Host is playing locally - no audio sync available"
**Root Cause:** Guest received PLAY/PLAY_AT with null/empty trackUrl
**Investigation:**
1. Check server logs for "Host play rejected - no trackUrl"
2. Check upload status when play was pressed
3. Verify Section 1 guards are active
**Fix:** Ensure upload completes before playing

### Symptom: 404 on /api/track/:trackId
**Root Cause:** Storage provider can't find track
**Investigation:**
1. Check storage logs: "Track not found"
2. Verify upload succeeded
3. Check storage metadata persistence
**Fix:** Verify S3 credentials and bucket access

### Symptom: Mixed content errors (http/https)
**Root Cause:** `PUBLIC_BASE_URL` not set or incorrect
**Investigation:**
1. Check environment variables
2. Verify `trackUrl` in upload response
3. Check Railway domain matches PUBLIC_BASE_URL
**Fix:** Set `PUBLIC_BASE_URL=https://your-domain`

### Symptom: Guest audio never starts
**Root Cause:** Multiple possible causes
**Investigation:**
1. Check Network tab for /api/track/:id request
2. Check console for errors
3. Verify trackUrl in PLAY_AT message
4. Check audio element ready state
**Fix:** See specific error in console/network

## Success Criteria Summary

✅ **Deployment is production-ready if:**

1. Health check passes (all services connected)
2. Audio uploads complete successfully  
3. trackUrl uses HTTPS and correct domain
4. Host can play only when upload ready
5. Server blocks play without trackUrl (multi-member)
6. Guest receives track via /api/track/:id
7. Guest audio plays automatically
8. Sync accuracy under 300ms
9. Range requests work (206 responses)
10. Late joiners sync to current position

❌ **Do NOT go to production if:**

- trackUrl uses `http://` instead of `https://`
- "Host is playing locally" appears when trackUrl exists
- Guest gets 404 on /api/track/:id
- Storage service unavailable errors
- Redis or database not connected
- Upload completes but play button stays disabled

## Next Steps

- If all tests pass: ✅ Production-ready
- If any test fails: Fix issue and re-run validation
- For ongoing monitoring: Set up Sentry and uptime checks
- For performance: Enable CDN for audio files (optional)
