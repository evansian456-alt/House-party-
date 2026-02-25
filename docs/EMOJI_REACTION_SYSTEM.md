# Emoji/Reaction System - Role-Based Enforcement

## Overview

The SyncSpeaker emoji/reaction system implements strict role-based enforcement to ensure:
- **Host (DJ) emoji clicks** do NOT trigger guest pop-ups, animations, or crowd energy
- **Guest emoji clicks** DO trigger pop-ups, animations, and crowd energy for all participants
- All events are properly tagged with sender role for client-side filtering

## Architecture

### Role-Based Event Flow

```
DJ Emoji Click:
  Client (DJ) → WebSocket → Server → Broadcast (kind: "dj_emoji") → All Clients
  
  DJ Client:
    - Visual feedback (button animation)
    - Emoji shown on DJ screen (createEmojiReactionEffect)
    - Flash effect (triggerDjFlash)
    - Live reaction box updated
    - Session points awarded (+5)
    - NO crowd energy update
    - NO toast pop-up
  
  Guest Clients:
    - Live reaction box updated
    - NO pop-ups
    - NO animations
    - NO crowd energy update

Guest Emoji Click:
  Client (Guest) → WebSocket → Server → Broadcast (kind: "guest_message") → All Clients
  
  Sending Guest:
    - Confirmation toast: "Sent: 🔥"
    - Button animation feedback
  
  DJ Client:
    - Crowd energy increased (+5)
    - Beat pulse triggered
    - Emoji floating animation
    - Flash effect
    - Live reaction box updated
    - Toast notification shown
  
  Other Guests:
    - Live reaction box updated
    - NO additional pop-ups
```

## Server-Side Implementation

### DJ Emoji Handler (`handleDjEmoji`)

**File:** `server.js:6148-6260`

**Role Check:**
```javascript
// Only host/DJ can send DJ emojis
if (party.host !== ws) {
  console.warn(`[Role Enforcement] Non-host attempted to send DJ emoji`);
  safeSend(ws, JSON.stringify({ t: "ERROR", message: "Only DJ can send emojis" }));
  return;
}
```

**Crowd Energy:**
```javascript
// IMPORTANT: DJ emojis do NOT update crowd energy
// Crowd energy is ONLY from guest reactions
console.log(`[Role Enforcement] DJ emoji - NO crowd energy update`);
```

**Broadcast Message:**
```javascript
{
  t: "FEED_EVENT",
  event: {
    kind: "dj_emoji",    // ← Role tag
    senderId: "dj",       // ← Role identifier
    senderName: "DJ",
    text: emoji,
    isEmoji: true
  }
}
```

### Guest Message Handler (`handleGuestMessage`)

**File:** `server.js:5682-5880`

**Role Check:**
```javascript
// Only guests can send messages (not host)
const member = party.members.find(m => m.ws === ws);
if (!member || member.isHost) {
  console.warn(`[Role Enforcement] Host attempted to send guest message`);
  safeSend(ws, JSON.stringify({ t: "ERROR", message: "Only guests can send messages" }));
  return;
}
```

**Crowd Energy:**
```javascript
// CROWD ENERGY: Track crowd energy from GUEST reactions only
const energyIncrease = isEmoji ? 5 : 8;
const currentEnergy = (party.scoreState.currentCrowdEnergy || 0) + energyIncrease;
const cappedEnergy = Math.min(100, currentEnergy);
party.scoreState.currentCrowdEnergy = cappedEnergy;

console.log(`[Role Enforcement] Guest reaction increased crowd energy by ${energyIncrease}`);
```

**Broadcast Message:**
```javascript
{
  t: "FEED_EVENT",
  event: {
    kind: "guest_message",  // ← Role tag
    senderId: guestId,       // ← Unique guest ID
    senderName: guestName,
    text: message,
    isEmoji: true
  }
}
```

## Client-Side Implementation

### Message Handling (`app.js:1121-1146`)

**GUEST_MESSAGE Handler:**
```javascript
if (msg.t === "GUEST_MESSAGE") {
  if (state.isHost) {
    // DJ receives guest messages and triggers full experience
    handleGuestMessageReceived(msg.message, msg.guestName, msg.guestId, msg.isEmoji);
  } else {
    // Guests receive DJ/guest messages - FEED ONLY, no animations
    console.log('[Role Enforcement] DJ emoji received by guest - adding to feed only');
    addToUnifiedFeed(
      msg.guestName === 'DJ' ? 'DJ' : 'GUEST',
      msg.guestName,
      msg.isEmoji ? 'emoji' : 'message',
      msg.message,
      msg.isEmoji
    );
    // NO pop-ups, NO animations, NO crowd energy for guests
  }
}
```

### FEED_EVENT Handler (`app.js:3709-3752`)

```javascript
function handleFeedEvent(event) {
  // Role enforcement logging for DJ emojis
  if (event.kind === 'dj_emoji' && !state.isHost) {
    console.log('[Role Enforcement] Guest received DJ emoji - feed only, no animations');
  }
  
  // Add to unified feed - NO POP-UPS, NO ANIMATIONS, NO CROWD ENERGY
  addToUnifiedFeed(sender, event.senderName, type, event.text, event.isEmoji, event.id);
}
```

### Guest Message Received Handler (`app.js:3441-3482`)

**DJ-Side Only:**
```javascript
function handleGuestMessageReceived(message, guestName, guestId, isEmoji) {
  // This function is ONLY called when state.isHost === true
  
  // Crowd energy increment (DJ-side only)
  increaseCrowdEnergy(isEmoji ? 5 : 8);
  
  // Trigger animations (DJ screen only)
  if (isEmoji) {
    createEmojiReactionEffect(message);
  }
  
  // Trigger effects
  triggerBeatPulse();
  triggerDjFlash();
  
  // Show toast notification (DJ only)
  if (state.isHost) {
    toast(`${guestName}: ${message}`);
  }
}
```

## Event Tagging

### Message Types

| Event Type | `kind` Value | `senderId` Value | Description |
|------------|--------------|------------------|-------------|
| DJ Emoji | `"dj_emoji"` | `"dj"` | DJ reaction, no crowd energy |
| Guest Emoji | `"guest_message"` | Guest ID | Guest reaction, +5 energy |
| Guest Text | `"guest_message"` | Guest ID | Guest message, +8 energy |
| Host Broadcast | `"host_broadcast"` | `"dj"` | DJ broadcast message |
| DJ Short Message | `"dj_short_message"` | `"dj"` | DJ typed message (Pro only) |

### Role Identification

**Server-Side:**
```javascript
// Check if sender is host/DJ
if (party.host === ws) {
  // This is the DJ
}

// Check if sender is guest
const member = party.members.find(m => m.ws === ws);
if (member && !member.isHost) {
  // This is a guest
}
```

**Client-Side:**
```javascript
// Check event sender role
if (event.kind === 'dj_emoji') {
  // Message from DJ
}

if (event.kind === 'guest_message') {
  // Message from guest
}

// Check client's own role
if (state.isHost) {
  // This client is the DJ
}
```

## Crowd Energy System

### Energy Sources

| Source | Energy Amount | Applied |
|--------|---------------|---------|
| DJ Emoji | **0** (blocked) | ❌ No |
| Guest Emoji | **+5 points** | ✅ Yes |
| Guest Text | **+8 points** | ✅ Yes |

### Energy Calculation

```javascript
// Guest reaction (server-side)
const energyIncrease = isEmoji ? 5 : 8;
const currentEnergy = Math.min(100, (party.scoreState.currentCrowdEnergy || 0) + energyIncrease);
party.scoreState.currentCrowdEnergy = currentEnergy;

// Track peak energy
if (currentEnergy > (party.scoreState.peakCrowdEnergy || 0)) {
  party.scoreState.peakCrowdEnergy = currentEnergy;
}
```

### Energy Display

**DJ Side Only:**
```javascript
// Client-side crowd energy display (app.js:7241-7286)
function updateCrowdEnergyDisplay() {
  // Update crowd energy bar
  const fillEl = el("crowdEnergyFill");
  if (fillEl) fillEl.style.width = `${state.crowdEnergy}%`;
  
  // Update peak indicator
  const peakEl = el("crowdEnergyPeakIndicator");
  if (peakEl) peakEl.style.left = `${state.crowdEnergyPeak}%`;
}
```

**Guest Side:**
- Guests do NOT have their own crowd energy display
- Crowd energy is DJ-side visualization only
- Server tracks crowd energy in `scoreState.currentCrowdEnergy`

## Reaction History

### Structure

```javascript
{
  id: "timestamp-senderId-randomId",
  type: "dj" | "emoji" | "text",
  message: "🔥",
  guestName: "Guest1" | "DJ",
  guestId: "guest-123" | "dj",
  ts: 1234567890
}
```

### Late Joiner Sync

When a guest joins late:
1. Server sends reaction history (last 30 items)
2. Client processes each reaction
3. DJ reactions are displayed in feed only
4. Guest reactions contribute to cumulative crowd energy
5. Animations NOT replayed for historical events

```javascript
// Reaction history includes both DJ and guest reactions
party.reactionHistory = [
  { type: "emoji", guestName: "Guest1", ... },  // Guest reaction
  { type: "dj", guestName: "DJ", ... },         // DJ reaction
  { type: "text", guestName: "Guest2", ... }    // Guest message
];

// Energy calculated from guest reactions only
const guestReactions = reactionHistory.filter(r => r.type !== "dj");
const energyFromGuests = guestReactions.reduce((total, r) => {
  return total + (r.type === "emoji" ? 5 : 8);
}, 0);
```

## Pop-Up Behavior

### DJ Emoji Clicks

**DJ Client:**
- ❌ NO toast pop-up
- ✅ Button animation feedback
- ✅ Visual effect on DJ screen (floating emoji)
- ✅ Flash effect
- ✅ Live reaction box update

**Guest Clients:**
- ❌ NO toast pop-up
- ❌ NO animations
- ✅ Live reaction box update

### Guest Emoji Clicks

**Sending Guest:**
- ✅ Toast pop-up: "Sent: 🔥"
- ✅ Button animation feedback

**DJ Client:**
- ✅ Toast notification: "GuestName: 🔥"
- ✅ Floating emoji animation
- ✅ Flash effect
- ✅ Beat pulse
- ✅ Crowd energy increase

**Other Guests:**
- ❌ NO toast pop-up
- ✅ Live reaction box update

## Deprecated Features

### Manual Sync Buttons

**Status:** Deprecated but present

**Buttons:**
- `btnGuestSync` - Always visible guest sync button
- `btnGuestResync` - Conditional guest resync button (appears on drift >1.5s)

**Purpose:**
- Handle manual sync state requests (`REQUEST_SYNC_STATE`)
- Do NOT affect emoji/reaction system
- Do NOT affect crowd energy
- Separate concern from reactions

**Documentation:**
- Marked as deprecated in `docs/SYNC_ARCHITECTURE_EXPLAINED.md`
- E2E tests confirm no interference with emoji system
- Can safely coexist with emoji reactions

## Security & Validation

### Server-Side Checks

1. **Role Enforcement:**
   ```javascript
   // DJ emoji: only host can send
   if (party.host !== ws) { return ERROR; }
   
   // Guest message: only guests can send
   if (member.isHost) { return ERROR; }
   ```

2. **Party Pass Gating:**
   ```javascript
   if (!isPartyPassActive(partyData)) {
     return ERROR("Party Pass required");
   }
   ```

3. **Rate Limiting:**
   ```javascript
   const rateLimitCheck = checkRateLimit(party, memberId, isHost);
   if (!rateLimitCheck.allowed) { return ERROR; }
   ```

4. **Message Sanitization:**
   ```javascript
   messageText = sanitizeText(messageText);
   ```

### Client-Side Checks

1. **Cooldown Prevention:**
   ```javascript
   const emojiCooldownMs = 1000;
   if (now - state.lastMessageTimestamp < emojiCooldownMs) {
     return; // Block send
   }
   ```

2. **Chat Mode Enforcement:**
   ```javascript
   if (state.chatMode === "LOCKED") {
     toast("Chat is locked by DJ");
     return;
   }
   ```

3. **Tier Validation:**
   ```javascript
   if (!hasPartyPassEntitlement()) {
     console.warn("Party Pass required");
     return;
   }
   ```

### Logging

**Role Violations:**
```javascript
// Server logs when role check fails
console.warn(`[Role Enforcement] Non-host attempted to send DJ emoji`);
console.warn(`[Role Enforcement] Host attempted to send guest message`);

// Client logs DJ emojis received by guests
console.log('[Role Enforcement] DJ emoji received by guest - feed only');
```

**Crowd Energy Updates:**
```javascript
// Server logs energy changes
console.log(`[Role Enforcement] Guest reaction increased crowd energy by ${energyIncrease}`);
console.log(`[Role Enforcement] DJ emoji - NO crowd energy update`);
```

## Testing

### E2E Test Suite

**File:** `e2e-tests/15-emoji-role-enforcement.spec.js`

**Tests:**
1. `EMOJI-01`: DJ emoji clicks do not increase crowd energy
2. `EMOJI-02`: Guest emoji clicks increase crowd energy
3. `EMOJI-03`: DJ emojis do not show pop-ups to guests
4. `EMOJI-04`: WebSocket messages include role tags
5. `EMOJI-05`: Crowd energy accumulates from guest reactions only
6. `EMOJI-06`: Late joiners sync reaction history correctly
7. `EMOJI-07`: Guest clients filter DJ emoji events correctly
8. `EMOJI-08`: Server enforces role-based emoji permissions
9. `EMOJI-09`: Guest reactions trigger all expected animations
10. `EMOJI-10`: Deprecated sync buttons do not interfere

### Unit Tests

**File:** `dj-emoji-tests.test.js`

- scoreState initialization
- Guest emoji reactions increase crowd energy
- DJ emoji reactions do NOT increase crowd energy
- Leaderboard excludes DJ
- Reaction history structure
- Energy cap at 100

## Troubleshooting

### Issue: DJ emoji triggering guest animations

**Check:**
1. Verify `handleFeedEvent` does not call animation functions
2. Confirm `event.kind === "dj_emoji"` check in client code
3. Check `state.isHost` value on guest clients
4. Review console logs for role enforcement messages

**Fix:**
- Guest clients should only call `addToUnifiedFeed()`
- No calls to `increaseCrowdEnergy()`, `createEmojiReactionEffect()`, etc.

### Issue: Crowd energy not updating for guest reactions

**Check:**
1. Verify server broadcasts `FEED_EVENT` with `kind: "guest_message"`
2. Confirm `handleGuestMessage` updates `party.scoreState.currentCrowdEnergy`
3. Check DJ client receives messages (WebSocket connection)
4. Verify `handleGuestMessageReceived` is called on DJ side

**Fix:**
- Ensure `state.isHost === true` on DJ client
- Check server logs for energy update messages
- Verify Party Pass is active

### Issue: Multiple pop-ups showing

**Check:**
1. Verify sender only sees own confirmation toast
2. Confirm other guests do NOT see toast for peer reactions
3. Check DJ sees toast for guest reactions
4. Verify no duplicate message handlers

**Fix:**
- Only sending client should show confirmation
- DJ should show notification for guest messages
- Guests should NOT show toasts for peer messages

## Best Practices

1. **Always check `state.isHost`** before triggering DJ-specific UI updates
2. **Use event.kind** to determine sender role, not senderName
3. **Log role enforcement** actions for debugging
4. **Validate Party Pass** on both client and server
5. **Sanitize all user input** before broadcasting
6. **Apply rate limiting** consistently
7. **Tag all events** with role-based identifiers
8. **Document role assumptions** in code comments

## Future Enhancements

1. **Analytics:** Track emoji usage by role (DJ vs guests)
2. **Animations:** Add role-specific animation themes
3. **Customization:** Allow DJ to customize emoji set
4. **Reactions:** Add reaction types beyond emoji (GIFs, stickers)
5. **Energy Decay:** Implement crowd energy decay over time
6. **Milestones:** Trigger special effects at energy milestones
7. **Leaderboard:** Track most active reactors
8. **Replay:** Ability to replay reactions for highlights

## References

- Server implementation: `server.js:5682-6260`
- Client implementation: `app.js:1121-4176, 3709-3752`
- E2E tests: `e2e-tests/15-emoji-role-enforcement.spec.js`
- Unit tests: `dj-emoji-tests.test.js`
- Sync architecture: `docs/SYNC_ARCHITECTURE_EXPLAINED.md`
- Deprecated features: `docs/SYNC_ARCHITECTURE_EXPLAINED.md:699-802`

---

**Last Updated:** 2024
**Version:** 1.0
**Status:** ✅ Production Ready
