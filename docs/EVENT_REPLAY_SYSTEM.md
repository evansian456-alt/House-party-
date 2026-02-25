# Event Replay System - Architecture Documentation

## Overview

The Event Replay System provides reliable message delivery over WebSocket connections with automatic acknowledgment tracking and retry mechanisms. It ensures critical messages (sync commands, playback controls, reactions) are delivered to all clients even in the presence of network issues or temporary disconnections.

## Key Features

- **Acknowledgment Tracking**: Tracks which clients have received each message
- **Automatic Retry**: Resends unacknowledged messages up to configurable max attempts
- **Priority Levels**: Different delivery guarantees based on message importance
- **Smart Cleanup**: Removes old and fully-acknowledged messages automatically
- **Statistics**: Real-time metrics on message delivery and retry performance
- **Batch Processing**: Limits retry load to prevent system overload

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Event Replay Manager                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Message Queue │  │ Client       │  │ Party Membership │   │
│  │               │  │ Registry     │  │ Tracker          │   │
│  │ - MessageID   │  │ - ClientID   │  │ - PartyCode      │   │
│  │ - Timestamp   │  │ - WebSocket  │  │ - Set<ClientID>  │   │
│  │ - Priority    │  │ - PartyCode  │  │                  │   │
│  │ - Attempts    │  │ - LastSeen   │  │                  │   │
│  │ - AckSet      │  │              │  │                  │   │
│  └───────────────┘  └──────────────┘  └──────────────────┘   │
│                                                                 │
│  ┌───────────────┐  ┌──────────────┐                          │
│  │ Retry Timer   │  │ Cleanup      │                          │
│  │ (2s interval) │  │ Timer        │                          │
│  │               │  │ (10s)        │                          │
│  └───────────────┘  └──────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

           ↓ Broadcasts                 ↑ Acknowledgments
           
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Client 1   │  │   Client 2   │  │   Client 3   │
│              │  │              │  │              │
│  - Receives  │  │  - Receives  │  │  - Receives  │
│  - Sends ACK │  │  - Sends ACK │  │  - Sends ACK │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Message Priority Levels

#### 1. CRITICAL (`MessagePriority.CRITICAL`)
- **Use for**: Playback sync, party state changes, essential commands
- **Behavior**: 
  - Requires acknowledgment from all recipients
  - Automatic retry up to 5 attempts (configurable)
  - 2-second retry interval
  - 30-second timeout before giving up
- **Examples**: PLAY_AT, PAUSE, SYNC_STATE, TRACK_CHANGED

#### 2. HIGH (`MessagePriority.HIGH`)
- **Use for**: Reactions, chat messages, important notifications
- **Behavior**:
  - Requires acknowledgment from all recipients
  - Same retry logic as CRITICAL
  - Balances reliability with system load
- **Examples**: GUEST_MESSAGE, DJ_EMOJI, FEED_EVENT

#### 3. NORMAL (`MessagePriority.NORMAL`)
- **Use for**: UI updates, non-critical information
- **Behavior**:
  - Best-effort delivery (no acknowledgment tracking)
  - No retry logic
  - Minimal overhead
- **Examples**: ROOM_STATE, PRESENCE_UPDATE

## Message Flow

### Sending a Message

```javascript
// Server-side (server.js)
const { messageId, sentCount, requiresAck } = broadcastToPartyWithAck(
  partyCode,
  { t: 'PLAY_AT', trackId: 'abc123', startTimeMs: 1234567890 },
  MessagePriority.CRITICAL
);

console.log(`Sent message ${messageId} to ${sentCount} clients, requires ack: ${requiresAck}`);
```

### Receiving and Acknowledging

```javascript
// Client-side (app.js)
function handleServer(msg) {
  // Automatic acknowledgment for messages that require it
  if (msg._requiresAck && msg._msgId) {
    sendMessageAck(msg._msgId);
  }
  
  // Process message normally
  switch (msg.t) {
    case 'PLAY_AT':
      handlePlayAt(msg);
      break;
    // ... other handlers
  }
}

function sendMessageAck(messageId) {
  send({ t: "MESSAGE_ACK", messageId });
}
```

### Server Acknowledgment Handler

```javascript
// Server-side (server.js)
function handleMessageAck(ws, msg) {
  const client = clients.get(ws);
  if (!client) return;
  
  eventReplayManager.handleAcknowledgment(client.id, msg.messageId);
}
```

## Retry Logic

### Retry Process

1. **Initial Send**: Message broadcast to all party members
2. **Queue Storage**: If acknowledgment required, message stored in queue
3. **Periodic Check**: Every 2 seconds, scan queue for unacknowledged messages
4. **Selective Retry**: Resend only to clients that haven't acknowledged
5. **Attempt Tracking**: Increment attempt counter for each retry
6. **Max Attempts**: Remove message after 5 failed attempts
7. **Timeout**: Remove message after 30 seconds regardless of status

### Retry Example

```
Time    Event
----    -----
0.0s    Message sent to 3 clients (A, B, C)
0.1s    Client A acknowledges
0.2s    Client B acknowledges
2.0s    Retry check: Client C hasn't acknowledged (attempt 2)
2.0s    Resend to Client C only
2.1s    Client C acknowledges
2.0s    All acknowledged - message removed from queue
```

## Configuration

### Default Settings

```javascript
const config = {
  retryIntervalMs: 2000,        // Check for retries every 2 seconds
  maxRetryAttempts: 5,          // Maximum 5 retry attempts
  messageTimeoutMs: 30000,      // Remove messages after 30 seconds
  cleanupIntervalMs: 10000,     // Clean up old messages every 10 seconds
  batchSize: 50,                // Maximum 50 messages to retry per interval
  enableLogging: true           // Enable console logging
};
```

### Customizing Configuration

```javascript
const eventReplayManager = new EventReplayManager({
  retryIntervalMs: 3000,        // More relaxed retry interval
  maxRetryAttempts: 3,          // Fewer retry attempts
  messageTimeoutMs: 20000,      // Shorter timeout
  enableLogging: false          // Disable logging for production
});
```

## API Reference

### EventReplayManager

#### Constructor
```javascript
new EventReplayManager(config)
```
- **config**: Optional configuration object (see Configuration section)

#### Methods

##### `start()`
Start the event replay system (retry and cleanup timers).

```javascript
eventReplayManager.start();
```

##### `stop()`
Stop the event replay system and clear all timers.

```javascript
eventReplayManager.stop();
```

##### `registerClient(clientId, ws, partyCode)`
Register a client for acknowledgment tracking.

```javascript
eventReplayManager.registerClient('client-123', websocket, 'PARTY1');
```

##### `unregisterClient(clientId)`
Unregister a client and clean up tracking data.

```javascript
eventReplayManager.unregisterClient('client-123');
```

##### `sendCommandToParty(partyCode, command, priority, excludeClients)`
Send a message to all party members with optional acknowledgment tracking.

```javascript
const result = eventReplayManager.sendCommandToParty(
  'PARTY1',
  { t: 'SYNC', position: 1234 },
  MessagePriority.CRITICAL,
  new Set(['client-host']) // Optional: exclude host
);

console.log(result);
// { messageId: 'abc123def456', sentCount: 3, requiresAck: true }
```

##### `handleAcknowledgment(clientId, messageId)`
Process an acknowledgment from a client.

```javascript
eventReplayManager.handleAcknowledgment('client-123', 'abc123def456');
```

##### `getStats()`
Get current statistics.

```javascript
const stats = eventReplayManager.getStats();
console.log(stats);
// {
//   messagesSent: 150,
//   messagesAcknowledged: 145,
//   messagesRetried: 8,
//   messagesFailed: 2,
//   messagesTimedOut: 0,
//   queueSize: 3,
//   activeClients: 5,
//   activeParties: 1
// }
```

##### `resetStats()`
Reset all statistics counters.

```javascript
eventReplayManager.resetStats();
```

## Integration Guide

### Server-Side Integration

#### 1. Import and Initialize

```javascript
// server.js
const { EventReplayManager, MessagePriority } = require('./event-replay');

const eventReplayManager = new EventReplayManager({
  retryIntervalMs: 2000,
  maxRetryAttempts: 5,
  messageTimeoutMs: 30000
});
```

#### 2. Start on Server Boot

```javascript
async function startServer() {
  // ... other startup code
  
  eventReplayManager.start();
  console.log('[Server] Event Replay System started');
}
```

#### 3. Register Clients on Join

```javascript
async function handleJoin(ws, msg) {
  // ... join logic
  
  eventReplayManager.registerClient(client.id, ws, code);
}
```

#### 4. Unregister on Disconnect

```javascript
function handleDisconnect(ws) {
  const client = clients.get(ws);
  if (client) {
    eventReplayManager.unregisterClient(client.id);
  }
  
  // ... other disconnect logic
}
```

#### 5. Use for Critical Broadcasts

```javascript
// For critical messages - use broadcastToPartyWithAck
function handleHostPlay(ws, msg) {
  const partyCode = getPartyCode(ws);
  
  broadcastToPartyWithAck(
    partyCode,
    { t: 'PLAY_AT', startTimeMs: Date.now() + 1000 },
    MessagePriority.CRITICAL
  );
}

// For non-critical messages - use regular broadcast
function updateRoomState(partyCode) {
  broadcastToParty(partyCode, { t: 'ROOM_STATE', members: [...] });
}
```

### Client-Side Integration

#### 1. Acknowledge Critical Messages

```javascript
// app.js
function handleServer(msg) {
  // Automatic acknowledgment
  if (msg._requiresAck && msg._msgId) {
    sendMessageAck(msg._msgId);
  }
  
  // Process message
  processMessage(msg);
}
```

#### 2. Implement ACK Sender

```javascript
function sendMessageAck(messageId) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    return;
  }
  
  send({ t: "MESSAGE_ACK", messageId });
}
```

## Performance Considerations

### Memory Usage

- **Queue Size**: Grows with unacknowledged messages
- **Mitigation**: 
  - 30-second timeout removes old messages
  - Batch size limits retry processing
  - Cleanup timer runs every 10 seconds

### Network Overhead

- **ACK Messages**: 1 ACK per client per critical message
- **Retry Messages**: Only sent to clients that haven't acknowledged
- **Typical overhead**: ~100 bytes per ACK, minimal impact

### CPU Usage

- **Retry Timer**: Runs every 2 seconds, processes up to 50 messages
- **Cleanup Timer**: Runs every 10 seconds
- **Optimization**: Early exits when queue is empty

## Monitoring and Debugging

### Statistics Dashboard

```javascript
// Get real-time statistics
const stats = eventReplayManager.getStats();

console.log('Event Replay Statistics:');
console.log(`  Messages Sent: ${stats.messagesSent}`);
console.log(`  Acknowledged: ${stats.messagesAcknowledged}`);
console.log(`  Retried: ${stats.messagesRetried}`);
console.log(`  Failed: ${stats.messagesFailed}`);
console.log(`  Timed Out: ${stats.messagesTimedOut}`);
console.log(`  Queue Size: ${stats.queueSize}`);
console.log(`  Active Clients: ${stats.activeClients}`);
console.log(`  Active Parties: ${stats.activeParties}`);
```

### Logging

Enable detailed logging for troubleshooting:

```javascript
const eventReplayManager = new EventReplayManager({
  enableLogging: true  // Console logs all operations
});
```

Example logs:
```
[EventReplay] Client registered: client-123 in party PARTY1
[EventReplay] Sent message abc123def456 to 3 clients in party PARTY1 (priority: critical, requiresAck: true)
[EventReplay] Client client-123 acknowledged message abc123def456 (1/3)
[EventReplay] Retried message abc123def456 to 1 clients (attempt 2/5)
[EventReplay] Message abc123def456 fully acknowledged, removed from queue
```

## Best Practices

### When to Use Event Replay

✅ **Use for**:
- Playback synchronization (PLAY_AT, PAUSE, STOP)
- Party state changes (TRACK_CHANGED, QUEUE_UPDATED)
- Critical reactions and chat (GUEST_MESSAGE, DJ_EMOJI)
- Important notifications (PARTY_ENDING, CAPACITY_REACHED)

❌ **Don't use for**:
- Frequent UI updates (position updates, progress bars)
- Heartbeat/ping messages
- Debug/diagnostic messages
- Non-critical status updates

### Message Design

```javascript
// ✅ Good: Self-contained, idempotent messages
{
  t: 'PLAY_AT',
  trackId: 'abc123',
  startTimeMs: 1234567890,
  position: 0
}

// ❌ Bad: Stateful, order-dependent messages
{
  t: 'UPDATE_POSITION',
  delta: 5  // Depends on previous state
}
```

### Error Handling

```javascript
// Always check return values
const result = broadcastToPartyWithAck(partyCode, message, MessagePriority.CRITICAL);

if (result.sentCount === 0) {
  console.error('Failed to send message - no clients in party');
  // Handle failure case
}
```

## Troubleshooting

### High Retry Rate

**Symptoms**: `messagesRetried` counter increasing rapidly

**Possible causes**:
1. Network issues causing packet loss
2. Clients disconnecting without cleanup
3. Client-side ACK implementation missing

**Solutions**:
- Check network quality
- Verify client registration/unregistration
- Ensure clients send ACKs for all `_requiresAck` messages

### Growing Queue Size

**Symptoms**: `queueSize` continuously increasing

**Possible causes**:
1. Clients not sending acknowledgments
2. Timeout/cleanup not working
3. Message timeout too long

**Solutions**:
- Verify client ACK implementation
- Check cleanup timer is running
- Reduce `messageTimeoutMs` if needed

### Messages Not Delivered

**Symptoms**: Clients not receiving critical messages

**Possible causes**:
1. Client not registered with event replay manager
2. WebSocket connection closed
3. Priority set to NORMAL (no retry)

**Solutions**:
- Verify `registerClient()` called on join
- Check WebSocket connection state
- Use CRITICAL or HIGH priority for important messages

## Security Considerations

### Message Validation

All messages should be validated before broadcasting:

```javascript
// Validate message structure
if (!msg.trackId || !msg.startTimeMs) {
  console.error('Invalid PLAY_AT message');
  return;
}

// Validate permissions
if (!isHost(ws)) {
  console.error('Non-host attempted to send PLAY_AT');
  return;
}

// Then broadcast
broadcastToPartyWithAck(partyCode, msg, MessagePriority.CRITICAL);
```

### ACK Spoofing Prevention

The system uses client IDs from the WebSocket session, not from the message payload:

```javascript
function handleMessageAck(ws, msg) {
  const client = clients.get(ws);  // Get client from WebSocket, not message
  eventReplayManager.handleAcknowledgment(client.id, msg.messageId);
}
```

### Rate Limiting

Consider adding rate limits for acknowledgments to prevent abuse:

```javascript
// Limit ACKs per client per second
const ackRateLimit = new Map(); // clientId -> timestamp[]

function handleMessageAck(ws, msg) {
  const client = clients.get(ws);
  const now = Date.now();
  
  if (!ackRateLimit.has(client.id)) {
    ackRateLimit.set(client.id, []);
  }
  
  const acks = ackRateLimit.get(client.id);
  acks.push(now);
  
  // Remove acks older than 1 second
  ackRateLimit.set(client.id, acks.filter(t => now - t < 1000));
  
  // Limit to 100 ACKs per second
  if (acks.length > 100) {
    console.warn(`Client ${client.id} exceeded ACK rate limit`);
    return;
  }
  
  eventReplayManager.handleAcknowledgment(client.id, msg.messageId);
}
```

## Future Enhancements

### Potential Improvements

1. **Persistent Queue**: Store queue in Redis for multi-server support
2. **Priority Queue**: Process CRITICAL messages before HIGH/NORMAL
3. **Adaptive Retry**: Adjust retry interval based on network conditions
4. **Selective Acknowledgment**: Some clients may not need to ACK certain message types
5. **Compression**: Compress large messages before sending
6. **Metrics Export**: Export statistics to monitoring systems (Prometheus, etc.)

## Related Documentation

- [WebSocket Architecture](../docs/WEBSOCKET_ARCHITECTURE.md)
- [Sync Architecture](../docs/SYNC_ARCHITECTURE_EXPLAINED.md)
- [Testing Guide](../docs/TESTING_GUIDE.md)
