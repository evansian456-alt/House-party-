# House Party - Ultra-Precise Multi-Device Sync System Testing Guide

## Overview

This guide provides step-by-step instructions for testing the House Party ultra-precise multi-device audio/video synchronization system. The system surpasses AmpSync with <20ms precision, advanced drift correction, network jitter simulation, and comprehensive monitoring.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Multiple devices or browser windows for multi-device testing (optional but recommended)

## Installation

```bash
# Clone the repository
git clone https://github.com/evansian456-alt/syncspeaker-prototype.git
cd syncspeaker-prototype

# Install dependencies
npm install

# Set up environment (if needed)
cp .env.example .env
# Edit .env with your configuration

# Start the server
npm start
```

The server should start on `http://localhost:8080` (or the port specified in your .env file).

## Testing Levels

### 1. Unit Tests

Unit tests verify individual components of the sync system in isolation.

```bash
# Run all unit tests
npm test

# Run sync-specific tests
npm test sync-engine.test.js

# Run stress tests
npm test sync-stress.test.js

# Run with coverage
npm test:coverage
```

**Expected Results:**
- All tests should pass (green checkmarks)
- Code coverage should be >80% for sync components
- No failed assertions or errors

**Key Test Suites:**
- `sync-engine.test.js`: Core synchronization logic (38 tests)
- `sync-stress.test.js`: Network jitter and stress scenarios (30+ tests)
- `sync-feedback.test.js`: Feedback loop mechanisms

### 2. Integration Tests

Integration tests verify that components work together correctly.

**Manual Integration Testing:**

1. **Start the Server:**
   ```bash
   npm start
   ```

2. **Open Main Application:**
   - Navigate to `http://localhost:8080`
   - Create or join a party
   - Upload and play a track

3. **Open Sync Dashboard:**
   - In a new tab, navigate to `http://localhost:8080/sync-dashboard.html?code=PARTY_CODE`
   - Replace `PARTY_CODE` with your actual party code
   - Click "Connect"

4. **Verify Dashboard Shows:**
   - Connection status (green dot)
   - Total clients connected
   - Average latency metrics
   - Client list with individual stats

### 3. End-to-End Multi-Device Tests

E2E tests simulate real-world multi-device scenarios.

#### Test Scenario 1: Two-Device Sync

**Setup:**
- Device A: Host (DJ)
- Device B: Guest

**Steps:**

1. **Device A - Create Party:**
   - Open `http://localhost:8080`
   - Sign in or use dev mode: `http://localhost:8080/?devmode=true`
   - Create a new party
   - Note the party code

2. **Device B - Join Party:**
   - Open `http://localhost:8080`
   - Join the party using the code from Device A

3. **Device A - Start Playback:**
   - Upload a music file
   - Click "Play" to start synchronization

4. **Verify Synchronization:**
   - Both devices should play audio simultaneously
   - Drift should be <50ms (monitor in dashboard)
   - No audio glitches or stuttering

5. **Test Drift Correction:**
   - Monitor the sync dashboard
   - Observe playback rate adjustments (should be 0.95-1.05x)
   - Drift should auto-correct within 2 seconds

**Expected Results:**
- Sync accuracy: <20ms average drift
- Playback rate adjustments: smooth and inaudible
- No audio artifacts during correction

#### Test Scenario 2: Five-Device Stress Test

**Setup:**
- 1 Host device
- 4 Guest devices (can be browser tabs/windows)

**Steps:**

1. Create party on host device
2. Join from 4 different browser tabs/windows
3. Start playback
4. Monitor all clients in sync dashboard

**Expected Results:**
- All 5 devices show in dashboard
- Average latency <100ms
- All clients maintain sync <50ms drift
- No performance degradation

#### Test Scenario 3: Network Jitter Simulation

**Steps:**

1. Open sync dashboard: `http://localhost:8080/sync-dashboard.html`
2. Connect to a party with active playback
3. Enable jitter simulation:
   - Check "Enable Jitter"
   - Select "Medium (±50ms)"
   - Set packet loss to "5%"

4. Click "Simulate Network Spike"
5. Observe client behavior during spike

**Expected Results:**
- Clients detect increased latency
- Network stability score decreases
- Drift correction increases temporarily
- System recovers within 3-5 seconds after spike ends
- Audio playback remains smooth throughout

#### Test Scenario 4: Client Disconnect/Reconnect

**Steps:**

1. Start party with 3+ clients
2. Force disconnect one client (close tab or disable network)
3. Monitor dashboard
4. Reconnect the client
5. Verify re-synchronization

**Expected Results:**
- Dashboard shows client disconnect immediately
- Remaining clients continue playing
- Reconnected client re-syncs within 2 seconds
- No impact on other clients

### 4. Stress Testing

Stress tests verify system behavior under extreme conditions.

#### Test Scenario 5: 50-Client Load Test

**Automated Test:**
```bash
npm test sync-stress.test.js -- -t "should handle 50 concurrent clients"
```

**Manual Test:**
1. Use a load testing tool or script to open 50 WebSocket connections
2. Each connection joins the same party
3. Monitor server CPU and memory usage
4. Start playback and verify all clients receive sync messages

**Expected Results:**
- Server CPU usage <50%
- Memory usage <500MB
- All clients receive messages within 100ms
- No connection drops or timeouts

#### Test Scenario 6: Rapid Connect/Disconnect Churn

**Automated Test:**
```bash
npm test sync-stress.test.js -- -t "should handle rapid client connect/disconnect"
```

**Expected Results:**
- No memory leaks
- No orphaned connections
- Server remains stable
- Existing clients unaffected

### 5. Video Sync Testing (If Applicable)

If using video content:

1. Upload a video file to the party
2. Start playback on 2+ devices
3. Verify:
   - Video frames stay in sync across devices
   - Audio/video alignment is maintained
   - Lip sync is accurate

**Expected Results:**
- Video sync accuracy: <33ms (1 frame at 30fps)
- No audio/video desync
- Smooth playback on all devices

## Monitoring & Debugging

### Sync Dashboard Features

The sync dashboard (`sync-dashboard.html`) provides real-time monitoring:

**Metrics Displayed:**
- **Total Clients**: Number of connected devices
- **Average Latency**: Round-trip time to server
- **Average Drift**: Position error across all clients
- **Network Health**: Overall network stability (0-100%)

**Per-Client Metrics:**
- Latency (ms)
- Drift (ms)
- Playback Rate (0.95-1.05x)
- Network Stability (%)
- Playback Position (seconds)
- Predicted Drift (ms)

**Network Simulation Tools:**
- Enable/disable jitter
- Adjust jitter amount (±10ms to ±200ms)
- Set packet loss rate (0-20%)
- Simulate network spikes
- Simulate disconnects

**Event Log:**
- Timestamped events
- Color-coded severity (info, warning, error)
- Automatic scrolling
- Last 100 events retained

### Browser Console Logs

Enable detailed sync logs in browser console:

**Client-Side:**
```
[Sync] Clock synced - Offset: 12.5ms, Latency: 45.2ms
[Sync] Scheduling playback - Delay: 2950ms
[Sync] Drift correction - Drift: 35ms, Adjustment: -0.0035
[Sync] Playback started successfully
```

**Server-Side:**
```
[Sync] Created sync engine for party ABC123
[Sync] Added client xyz789 to sync engine
[Sync] Cleaned up sync engine for party ABC123
```

### Debug Mode

Enable additional debug output:

```javascript
// In browser console
localStorage.setItem('syncDebug', 'true');
location.reload();
```

## Performance Benchmarks

### Expected Performance Metrics

| Metric | Target | Excellent | Good | Poor |
|--------|--------|-----------|------|------|
| Sync Accuracy | <20ms | <30ms | <50ms | >50ms |
| Latency | <50ms | <100ms | <200ms | >200ms |
| Network Stability | >0.9 | >0.7 | >0.5 | <0.5 |
| Playback Rate | 1.0±0.01 | 1.0±0.03 | 1.0±0.05 | >1.05 |
| Server CPU (100 clients) | <30% | <50% | <70% | >70% |
| Memory (100 clients) | <300MB | <500MB | <700MB | >700MB |

### Measuring Performance

**Client-Side:**
```javascript
// Get sync quality
const quality = syncEngine.getSyncQuality();
console.log('Latency:', quality.latency);
console.log('Quality:', quality.quality);
console.log('Playback Rate:', quality.playbackRate);
```

**Server-Side:**
```javascript
// Get sync stats
const stats = syncEngine.getSyncStats();
console.log('Total Clients:', stats.totalClients);
console.log('Clients:', stats.clients);
```

## Troubleshooting

### Issue: High Latency (>200ms)

**Possible Causes:**
- Poor network connection
- Server overload
- Geographic distance

**Solutions:**
1. Check network connection quality
2. Test with wired connection instead of WiFi
3. Reduce server load (fewer concurrent parties)
4. Use a closer server location

### Issue: Frequent Drift Corrections

**Possible Causes:**
- Client CPU overload
- Network jitter
- Interrupted audio playback

**Solutions:**
1. Close resource-heavy applications
2. Check for network jitter in dashboard
3. Verify audio element isn't being paused/interrupted
4. Increase buffer size if necessary

### Issue: Audio Glitches During Correction

**Possible Causes:**
- Drift too large for smooth correction
- Audio buffer underrun
- Playback rate adjustment too aggressive

**Solutions:**
1. Check drift magnitude in dashboard
2. If drift >200ms, trigger hard resync (stop/restart)
3. Verify buffer health is adequate
4. Monitor for network issues

### Issue: Sync Quality Shows "Poor"

**Possible Causes:**
- High latency variance
- Unstable network
- Network congestion

**Solutions:**
1. Check network stability metric
2. Test with wired connection
3. Close other network-heavy applications
4. Enable network simulation to test recovery

## Automated Testing Scripts

### Run Full Test Suite

```bash
# Run all tests (unit + integration)
npm test

# Run tests in watch mode (for development)
npm test:watch

# Generate coverage report
npm test:coverage
```

### Run E2E Tests (if available)

```bash
# Run Playwright E2E tests
npm run test:e2e

# Run in headed mode (visible browser)
npm run test:e2e:headed

# Run in UI mode (interactive)
npm run test:e2e:ui
```

## CI/CD Integration

The sync system integrates with CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
name: Sync System Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test sync-engine.test.js
      - run: npm test sync-stress.test.js
```

## Best Practices

1. **Always test with real network conditions**
   - Use network throttling in Chrome DevTools
   - Test with WiFi, not just wired connections
   - Simulate mobile network conditions

2. **Test edge cases**
   - Client joins mid-playback
   - Network disconnects during playback
   - Multiple rapid playback starts/stops

3. **Monitor performance**
   - Keep sync dashboard open during testing
   - Watch for memory leaks (check DevTools Memory tab)
   - Monitor server resource usage

4. **Use multiple devices when possible**
   - Real device testing is more accurate than tabs
   - Test across different browsers
   - Test on mobile devices (iOS, Android)

5. **Document issues**
   - Save screenshots of dashboard during issues
   - Export console logs for debugging
   - Note network conditions when issues occur

## Additional Suggestions for Improved Sync Precision

### 1. Hardware-Accelerated Audio
- Use Web Audio API for all playback
- Leverage AudioContext scheduling for precision
- Avoid using HTML Audio element directly

### 2. Enhanced Clock Sync
- Implement Cristian's algorithm for better accuracy
- Use multiple sync samples and median filtering
- Adjust sync frequency based on drift patterns

### 3. Predictive Buffering
- Analyze historical network patterns
- Adjust buffer size dynamically
- Pre-fetch audio segments during stable periods

### 4. Adaptive Quality Switching
- Monitor available bandwidth
- Switch audio quality to maintain sync
- Prioritize sync accuracy over audio quality

### 5. Machine Learning Integration
- Train model on drift patterns
- Predict network issues before they occur
- Optimize playback rate adjustments

## Conclusion

This testing guide covers comprehensive testing of the House Party ultra-precise multi-device sync system. Follow the scenarios and monitor the metrics to ensure optimal performance. The system is designed to maintain <20ms sync accuracy across multiple devices even under challenging network conditions.

For issues or questions, refer to the main documentation in `SYNCSPEAKER_AMPSYNC_DOCS.md` or open an issue on the GitHub repository.
