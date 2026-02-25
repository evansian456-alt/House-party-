# Event Replay System - Testing Guide

## Overview

This guide covers testing strategies for the Event Replay System, including unit tests, integration tests, and end-to-end testing scenarios.

## Unit Tests

### Running Unit Tests

```bash
npm test event-replay.test.js
```

### Test Coverage

The unit test suite (`event-replay.test.js`) includes 28 tests covering:

#### 1. Initialization (3 tests)
- ✅ Manager creation with default config
- ✅ Manager creation with custom config
- ✅ Start and stop functionality

#### 2. Client Management (3 tests)
- ✅ Client registration
- ✅ Client unregistration
- ✅ Multiple party tracking

#### 3. Message Sending (7 tests)
- ✅ NORMAL priority messages (no acknowledgment)
- ✅ CRITICAL priority messages (with acknowledgment)
- ✅ HIGH priority messages (with acknowledgment)
- ✅ Broadcasting to multiple clients
- ✅ Client exclusion from broadcasts
- ✅ Closed WebSocket handling
- ✅ Message ID generation

#### 4. Acknowledgment Handling (3 tests)
- ✅ Single client acknowledgment
- ✅ Multi-client acknowledgment wait
- ✅ Non-existent message ACK handling

#### 5. Message Retry (5 tests)
- ✅ Automatic retry of unacknowledged messages
- ✅ Stop retrying after acknowledgment
- ✅ Max retry attempts enforcement
- ✅ Message timeout removal
- ✅ Selective retry (only unacknowledged clients)

#### 6. Statistics (2 tests)
- ✅ Statistics tracking
- ✅ Statistics reset

#### 7. Cleanup (1 test)
- ✅ Periodic cleanup of old messages

#### 8. Edge Cases (4 tests)
- ✅ Empty party handling
- ✅ Null WebSocket handling
- ✅ WebSocket send error handling
- ✅ Rapid registration/unregistration

#### 9. Batch Processing (1 test)
- ✅ Batch size limit during retry

### Test Results

```
Test Suites: 1 passed, 1 total
Tests:       28 passed, 28 total
Time:        4.314 s
```

All unit tests pass successfully!

## Integration Tests

### Setup

Integration tests require a running server instance and WebSocket clients. Due to the complexity of server setup in test environment, integration tests are optional.

### Manual Integration Testing

You can manually test the Event Replay System using the following steps:

#### 1. Start the Server

```bash
npm start
```

#### 2. Open Browser Console

Open the browser console in two different tabs/browsers to simulate DJ and Guest.

#### 3. Test Critical Message Flow

**DJ Tab:**
```javascript
// Create party
createParty('DJ Name');

// Monitor messages
let receivedMessages = [];
const originalHandleServer = handleServer;
handleServer = function(msg) {
  receivedMessages.push(msg);
  if (msg._requiresAck) {
    console.log('Received message requiring ACK:', msg._msgId);
  }
  return originalHandleServer(msg);
};
```

**Guest Tab:**
```javascript
// Join party
joinParty('PARTY-CODE', 'Guest Name');

// Monitor ACKs sent
let acksSent = [];
const originalSend = send;
send = function(obj) {
  if (obj.t === 'MESSAGE_ACK') {
    acksSent.push(obj.messageId);
    console.log('Sent ACK for:', obj.messageId);
  }
  return originalSend(obj);
};
```

#### 4. Trigger Critical Messages

**DJ Tab:**
```javascript
// Send DJ emoji (HIGH priority)
sendDjEmoji('🎉');

// Play track (CRITICAL priority)
handleHostPlay();
```

**Guest Tab:**
```javascript
// Check ACKs sent
console.log(`Total ACKs sent: ${acksSent.length}`);
console.log('ACK IDs:', acksSent);
```

## End-to-End Testing

### Network Failure Scenarios

#### Scenario 1: Client Disconnects Before ACK

**Test Steps:**
1. Start party with DJ and 2 guests
2. Send CRITICAL message
3. Disconnect Guest 1 immediately
4. Verify Guest 2 receives retry
5. Verify message eventually times out for Guest 1

**Expected Behavior:**
- Message sent to both guests
- Guest 1 doesn't ACK (disconnected)
- Guest 2 receives message and ACKs
- Message retried to Guest 1 up to 5 times
- After timeout, message removed from queue

#### Scenario 2: Network Latency

**Test Steps:**
1. Simulate high latency (throttle network in DevTools)
2. Send CRITICAL message
3. Observe retry behavior

**Expected Behavior:**
- Message sent initially
- ACK delayed due to latency
- Retry may occur before ACK arrives
- Once ACK arrives, retries stop
- No duplicate processing on client

#### Scenario 3: Message Burst

**Test Steps:**
1. Send 50 CRITICAL messages rapidly
2. Verify all messages delivered
3. Check queue doesn't overflow

**Expected Behavior:**
- All messages queued
- Batch processing limits retry load
- All messages eventually acknowledged
- Queue cleaned up after ACKs

### Performance Testing

#### Load Test: Many Clients

```javascript
// Simulate 50 clients in a party
const clients = [];
for (let i = 0; i < 50; i++) {
  const ws = new WebSocket('ws://localhost:8080');
  ws.onopen = () => {
    ws.send(JSON.stringify({ 
      t: 'JOIN', 
      code: 'PARTY1', 
      name: `Guest${i}` 
    }));
  };
  clients.push(ws);
}

// Send CRITICAL message
// Expected: All 50 clients receive and ACK
// Expected: Message removed from queue after all ACKs
```

#### Load Test: High Message Rate

```javascript
// Send 100 messages in 10 seconds
for (let i = 0; i < 100; i++) {
  setTimeout(() => {
    sendCriticalMessage({ id: i, data: 'test' });
  }, i * 100);
}

// Expected: All messages delivered
// Expected: Retry system keeps up
// Expected: Memory doesn't grow unbounded
```

## Monitoring in Production

### Statistics Endpoint

Add an endpoint to expose Event Replay statistics:

```javascript
// server.js
app.get('/api/debug/event-replay-stats', (req, res) => {
  const stats = eventReplayManager.getStats();
  res.json(stats);
});
```

### Accessing Statistics

```bash
curl http://localhost:8080/api/debug/event-replay-stats
```

**Response:**
```json
{
  "messagesSent": 1523,
  "messagesAcknowledged": 1519,
  "messagesRetried": 12,
  "messagesFailed": 3,
  "messagesTimedOut": 1,
  "queueSize": 2,
  "activeClients": 5,
  "activeParties": 1
}
```

### Key Metrics to Monitor

1. **Retry Rate**: `messagesRetried / messagesSent`
   - Normal: < 5%
   - Warning: 5-15%
   - Critical: > 15%

2. **Failure Rate**: `(messagesFailed + messagesTimedOut) / messagesSent`
   - Normal: < 1%
   - Warning: 1-5%
   - Critical: > 5%

3. **Queue Size**: `queueSize`
   - Normal: 0-10
   - Warning: 10-50
   - Critical: > 50

4. **ACK Rate**: `messagesAcknowledged / messagesSent`
   - Normal: > 95%
   - Warning: 90-95%
   - Critical: < 90%

## Debugging

### Enable Detailed Logging

```javascript
const eventReplayManager = new EventReplayManager({
  enableLogging: true
});
```

### Log Analysis

Look for these patterns in logs:

#### Healthy System
```
[EventReplay] Client registered: client-123 in party PARTY1
[EventReplay] Sent message abc123 to 3 clients (priority: critical, requiresAck: true)
[EventReplay] Client client-123 acknowledged message abc123 (1/3)
[EventReplay] Client client-456 acknowledged message abc123 (2/3)
[EventReplay] Client client-789 acknowledged message abc123 (3/3)
[EventReplay] Message abc123 fully acknowledged, removed from queue
```

#### Problem: Client Not Acknowledging
```
[EventReplay] Sent message abc123 to 3 clients (priority: critical, requiresAck: true)
[EventReplay] Client client-123 acknowledged message abc123 (1/3)
[EventReplay] Client client-456 acknowledged message abc123 (2/3)
[EventReplay] Retried message abc123 to 1 clients (attempt 2/5)
[EventReplay] Retried message abc123 to 1 clients (attempt 3/5)
[EventReplay] Retried message abc123 to 1 clients (attempt 4/5)
[EventReplay] Retried message abc123 to 1 clients (attempt 5/5)
[EventReplay] Message abc123 exceeded max retry attempts, removing from queue
```

**Action**: Check client-789's connection and ACK implementation.

#### Problem: High Queue Growth
```
[EventReplay] Queue size: 45 messages
[EventReplay] Queue size: 52 messages
[EventReplay] Queue size: 61 messages
```

**Action**: 
- Check if clients are sending ACKs
- Reduce `messageTimeoutMs`
- Increase cleanup frequency
- Check for memory leaks

### Common Issues and Solutions

#### Issue: ACKs Not Sent

**Symptoms**: Messages continuously retried, high failure rate

**Debug:**
```javascript
// Client-side - check if ACK logic is triggered
function handleServer(msg) {
  console.log('Received:', msg.t, 'RequiresAck:', msg._requiresAck);
  if (msg._requiresAck && msg._msgId) {
    console.log('Sending ACK for:', msg._msgId);
    sendMessageAck(msg._msgId);
  }
}
```

**Solution**: Ensure ACK logic is implemented in all message handlers.

#### Issue: Duplicate Messages

**Symptoms**: Clients receive same message multiple times

**Cause**: Retry system working, but client processing messages multiple times

**Solution**: Implement client-side deduplication:
```javascript
const processedMessages = new Set();

function handleServer(msg) {
  // Send ACK first
  if (msg._requiresAck && msg._msgId) {
    sendMessageAck(msg._msgId);
  }
  
  // Then check if already processed
  if (msg._msgId && processedMessages.has(msg._msgId)) {
    console.log('Ignoring duplicate message:', msg._msgId);
    return;
  }
  
  if (msg._msgId) {
    processedMessages.add(msg._msgId);
    
    // Clean up old IDs (keep last 100)
    if (processedMessages.size > 100) {
      const arr = Array.from(processedMessages);
      processedMessages.clear();
      arr.slice(-100).forEach(id => processedMessages.add(id));
    }
  }
  
  // Process message
  processMessage(msg);
}
```

## Automated Test Scenarios

### Jest Test Template

```javascript
describe('Event Replay - Feature X', () => {
  let manager;
  
  beforeEach(() => {
    manager = new EventReplayManager({
      retryIntervalMs: 100,
      maxRetryAttempts: 3,
      messageTimeoutMs: 1000,
      enableLogging: false
    });
    manager.start();
  });
  
  afterEach(() => {
    manager.stop();
  });
  
  it('should handle scenario Y', async () => {
    // Test implementation
  });
});
```

## Best Practices

### 1. Test Message Priority

Always test with appropriate priority levels:
- Use CRITICAL for sync, playback
- Use HIGH for reactions, chat
- Use NORMAL for UI updates

### 2. Test Network Conditions

Simulate:
- High latency (> 500ms)
- Packet loss (5-10%)
- Client disconnects
- Server restarts

### 3. Test Edge Cases

- Empty parties
- Single client
- Large parties (50+ clients)
- Rapid join/leave
- Message bursts

### 4. Monitor Production

- Set up statistics endpoint
- Alert on high retry/failure rates
- Track queue size
- Monitor memory usage

## Conclusion

The Event Replay System provides robust message delivery with minimal overhead. Proper testing ensures reliability in production environments. Follow this guide to implement comprehensive testing for your deployment.
