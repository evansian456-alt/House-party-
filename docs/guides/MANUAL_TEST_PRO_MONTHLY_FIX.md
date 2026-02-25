# Manual Testing Guide: PRO_MONTHLY Party Pass Fix

## Issue Fixed
PRO_MONTHLY users were incorrectly shown Party Pass upgrade prompts when using prototype mode.

## Testing Scenarios

### Scenario 1: PRO_MONTHLY User (Main Fix)
**Expected Behavior:** PRO_MONTHLY users should NEVER see Party Pass upgrade CTAs

**Steps:**
1. Open the app in a browser
2. Click "Get Started" or navigate to tier selection
3. Select **PRO Monthly** tier (£9.99/month)
4. Click **"Skip Sign Up / Prototype Mode"**
5. Enter a DJ name and click **"Create Party"**
6. Start the party and observe the host/DJ view

**Success Criteria:**
- ✅ NO "Upgrade for 2 hours" banner visible
- ✅ NO Party Pass purchase prompts shown
- ✅ DJ Quick Buttons are visible (not locked)
- ✅ DJ Messaging Feed section is visible (not locked)
- ✅ Crowd Energy and DJ Moments cards are visible
- ✅ Status shows "Party Pass Active" or "Pro"
- ✅ NO countdown timer shown (PRO_MONTHLY doesn't expire in 2 hours)

**Failure Indicators:**
- ❌ Any "Upgrade" or "Activate Party Pass" buttons appear
- ❌ DJ features are locked or hidden
- ❌ Banner shows "Upgrade for the full experience"

---

### Scenario 2: PARTY_PASS User (Verify No Regression)
**Expected Behavior:** PARTY_PASS users should see active status and countdown timer

**Steps:**
1. Select **Party Pass** tier (£2.99, 2 hours)
2. Click **"Skip Sign Up / Prototype Mode"**
3. Enter a DJ name and create party

**Success Criteria:**
- ✅ "Party Pass Active" status shown
- ✅ Countdown timer shows time remaining (e.g., "119m remaining")
- ✅ DJ features are unlocked
- ✅ NO upgrade prompts shown (already has Party Pass)

---

### Scenario 3: FREE User (Verify Upgrade Flow Still Works)
**Expected Behavior:** FREE users should see upgrade prompts

**Steps:**
1. Select **Free** tier
2. Click **"Skip Sign Up / Prototype Mode"**
3. Enter a DJ name and create party

**Success Criteria:**
- ✅ "Free Plan" status shown
- ✅ "Upgrade for 2 hours" or similar CTA IS visible
- ✅ Party Pass purchase prompt IS shown
- ✅ DJ Quick Buttons are hidden/locked
- ✅ DJ Messaging is locked with message visible

---

## Server-Side Verification

### Check Party State API
You can verify the server is returning correct data:

```bash
# Create a party with PRO_MONTHLY tier
curl -X POST http://localhost:8080/api/create-party \
  -H "Content-Type: application/json" \
  -d '{"djName":"Test DJ","prototypeMode":true,"tier":"PRO_MONTHLY","source":"local"}'

# Response will include partyCode, e.g., "ABC123"
# Check party state:
curl http://localhost:8080/api/party-state?code=ABC123
```

**Expected Response for PRO_MONTHLY:**
```json
{
  "tierInfo": {
    "tier": "PRO_MONTHLY",
    "partyPassExpiresAt": 1773190000000,  // ~30 days in future
    "maxPhones": 10
  }
}
```

---

## WebSocket ROOM Snapshot Verification

When joining a party, the ROOM message should include:
- For PRO_MONTHLY: `partyPassActive: true`
- For PARTY_PASS: `partyPassActive: true` (if not expired)
- For FREE: `partyPassActive: false`

---

## Automated Tests

Run the test suite to verify all logic:
```bash
npm test -- pro-monthly-entitlement.test.js
```

**Expected:** 8 tests pass
- ✅ should treat PRO_MONTHLY tier as having Party Pass
- ✅ should treat PARTY_PASS tier as having Party Pass when not expired
- ✅ should NOT treat FREE tier as having Party Pass
- ✅ should accept PRO_MONTHLY as valid tier
- ✅ should accept PRO as valid tier (alias for PRO_MONTHLY)
- ✅ should reject invalid tier
- ✅ should set 30-day expiration for PRO_MONTHLY
- ✅ should set 2-hour expiration for PARTY_PASS

---

## Code Changes Summary

### Server (server.js)
```javascript
function isPartyPassActive(partyData, now = Date.now()) {
  // PRO_MONTHLY implicitly includes Party Pass features
  if (partyData.tier === 'PRO_MONTHLY' || partyData.tier === 'PRO') {
    return true;
  }
  // PARTY_PASS tier: check expiration
  const expires = Number(partyData.partyPassExpiresAt || 0);
  return expires > now;
}
```

### Client (app.js)
```javascript
function hasPartyPassEntitlement() {
  // Check tier-based entitlement
  if (state.userTier === USER_TIER.PRO || state.userTier === USER_TIER.PARTY_PASS) {
    return true;
  }
  // Check active Party Pass flag (from server)
  if (state.partyPassActive) {
    return true;
  }
  // Check party-wide Pro status
  if (state.partyPro) {
    return true;
  }
  return false;
}
```

This helper is now used in:
- `updatePartyPassUI()` - Hide upgrade UI for entitled users
- `updateGuestTierUI()` - Set correct tier display
- `updateGuestPartyStatus()` - Show correct status
- DJ Profile features visibility
- Host gift section visibility

---

## Security Summary

✅ **No security vulnerabilities introduced**
- CodeQL analysis: 0 alerts
- No user input handling changes
- No authentication/authorization bypass
- Only UI display logic changes based on tier entitlement

---

## Test Results

```
Test Suites: 15 passed, 15 total
Tests:       284 passed, 284 total
Snapshots:   0 total
Time:        6.662 s
```

All existing tests continue to pass, confirming no regressions.
