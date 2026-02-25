# Payment and Upgrade System - Manual Test Checklist

## Prerequisites
- Test user account created
- Able to create parties
- Payment system enabled (TEST_MODE=true for simulated payments)

---

## Test Suite 1: Party Pass Purchase

### Test 1.1: Party Pass Purchase with Card
**Steps:**
1. Create a free party
2. Click "Activate Party Pass" button
3. Select Card payment method
4. Confirm payment in test dialog
5. Verify toast shows "Party Pass activated"
6. Verify party pass timer shows "2h 0m remaining"
7. Verify DJ messaging controls are now visible
8. Verify emoji reactions are enabled

**Expected Results:**
- ✅ Payment processes successfully
- ✅ Party Pass timer appears and counts down
- ✅ DJ messaging features unlock
- ✅ Party continues to work normally

**Status:** [ ] PASS / [ ] FAIL

---

### Test 1.2: Party Pass Restore on Reload
**Steps:**
1. Purchase Party Pass (Test 1.1)
2. Reload the page
3. Verify Party Pass is still active
4. Verify timer shows correct remaining time
5. Verify features still unlocked

**Expected Results:**
- ✅ Party Pass persists across reload
- ✅ Timer resumes correctly
- ✅ Features remain unlocked

**Status:** [ ] PASS / [ ] FAIL

---

### Test 1.3: Party Pass Expiry
**Steps:**
1. Purchase Party Pass
2. Wait for expiry (or manually set short expiry for testing)
3. Verify toast notification when expired
4. Verify DJ messaging controls are hidden
5. Verify timer disappears

**Expected Results:**
- ✅ Expiry is detected automatically
- ✅ Features lock again after expiry
- ✅ User is notified of expiry

**Status:** [ ] PASS / [ ] FAIL

---

## Test Suite 2: Pro Monthly Subscription

### Test 2.1: Pro Monthly Purchase with Card
**Steps:**
1. Navigate to tier selection
2. Select "Pro Monthly" tier
3. Click "Go Pro" button
4. Confirm payment
5. Verify subscription activates
6. Create a party
7. Verify up to 10 phones can join
8. Verify all Party Pass features are available
9. Verify Pro-only DJ features are available

**Expected Results:**
- ✅ Subscription activates successfully
- ✅ Phone limit increases to 10
- ✅ All Party Pass features included
- ✅ Pro features available

**Status:** [ ] PASS / [ ] FAIL

---

### Test 2.2: Pro Monthly Restore on Reload
**Steps:**
1. Purchase Pro Monthly
2. Reload the page
3. Verify Pro Monthly badge shows
4. Create a party
5. Verify Pro features available

**Expected Results:**
- ✅ Pro Monthly persists across reload
- ✅ Features remain unlocked
- ✅ New parties inherit Pro benefits

**Status:** [ ] PASS / [ ] FAIL

---

### Test 2.3: Pro Monthly Includes Party Pass
**Steps:**
1. Purchase Pro Monthly
2. Create a party
3. Verify Party Pass features are available
4. Verify no separate Party Pass purchase needed

**Expected Results:**
- ✅ Pro Monthly users have Party Pass features
- ✅ No Party Pass CTA shown to Pro users

**Status:** [ ] PASS / [ ] FAIL

---

## Test Suite 3: Payment Methods

### Test 3.1: Apple Pay on iOS
**Platform:** iOS device or simulator
**Steps:**
1. Open app on iOS device
2. Purchase Party Pass
3. Verify Apple Pay UI appears
4. Complete payment
5. Verify entitlement granted

**Expected Results:**
- ✅ Apple Pay UI shown on iOS
- ✅ Payment routes through Apple IAP
- ✅ Entitlement granted correctly

**Status:** [ ] PASS / [ ] FAIL

---

### Test 3.2: Google Pay on Android
**Platform:** Android device or emulator
**Steps:**
1. Open app on Android device
2. Purchase Pro Monthly
3. Verify Google Pay UI appears
4. Complete payment
5. Verify entitlement granted

**Expected Results:**
- ✅ Google Pay UI shown on Android
- ✅ Payment routes through Google Play Billing
- ✅ Entitlement granted correctly

**Status:** [ ] PASS / [ ] FAIL

---

### Test 3.3: Card Payment on Web
**Platform:** Web browser
**Steps:**
1. Open app in browser
2. Purchase Party Pass
3. Verify card payment UI appears
4. Complete payment
5. Verify entitlement granted

**Expected Results:**
- ✅ Card payment UI shown on web
- ✅ Payment routes through Stripe (or test provider)
- ✅ Entitlement granted correctly

**Status:** [ ] PASS / [ ] FAIL

---

## Test Suite 4: Feature Enforcement

### Test 4.1: Free User Cannot Access Party Pass Features
**Steps:**
1. Create a FREE party (no purchase)
2. Try to send DJ emoji
3. Try to send DJ quick message
4. Verify features are locked

**Expected Results:**
- ✅ DJ emoji button disabled/hidden
- ✅ DJ messaging controls locked
- ✅ Error message if attempting to use

**Status:** [ ] PASS / [ ] FAIL

---

### Test 4.2: Party Pass User Can Access Messaging
**Steps:**
1. Purchase Party Pass
2. Send DJ emoji
3. Send DJ quick message
4. Send DJ short message
5. Verify all work

**Expected Results:**
- ✅ All messaging features work
- ✅ Messages broadcast to guests
- ✅ No errors

**Status:** [ ] PASS / [ ] FAIL

---

### Test 4.3: Pro User Can Access All Features
**Steps:**
1. Purchase Pro Monthly
2. Create party with 10 phones
3. Use all DJ features
4. Verify everything works

**Expected Results:**
- ✅ 10-phone limit enforced
- ✅ All features available
- ✅ No errors

**Status:** [ ] PASS / [ ] FAIL

---

## Test Suite 5: Edge Cases

### Test 5.1: Duplicate Payment Prevention
**Steps:**
1. Start Party Pass purchase
2. Click purchase button multiple times rapidly
3. Verify only one payment processed
4. Verify no double charge

**Expected Results:**
- ✅ Only one payment intent created
- ✅ No duplicate charges
- ✅ User notified if already purchased

**Status:** [ ] PASS / [ ] FAIL

---

### Test 5.2: Payment Cancellation
**Steps:**
1. Start Party Pass purchase
2. Cancel payment dialog/UI
3. Verify no entitlement granted
4. Verify user can try again

**Expected Results:**
- ✅ Payment cancellation handled gracefully
- ✅ No partial state
- ✅ Can retry purchase

**Status:** [ ] PASS / [ ] FAIL

---

### Test 5.3: Party Pass Expiry During Session
**Steps:**
1. Purchase Party Pass
2. Wait for expiry (or force expiry)
3. Continue using party
4. Verify features lock automatically
5. Verify no errors/crashes

**Expected Results:**
- ✅ Features lock when expired
- ✅ Timer disappears
- ✅ Party continues to work (playback, etc.)
- ✅ No crashes

**Status:** [ ] PASS / [ ] FAIL

---

### Test 5.4: Pro Cancellation
**Steps:**
1. Purchase Pro Monthly
2. Cancel subscription (via provider)
3. Reload app
4. Verify Pro features removed
5. Verify downgrade to Free

**Expected Results:**
- ✅ Cancellation detected
- ✅ Features locked after period end
- ✅ Graceful downgrade

**Status:** [ ] PASS / [ ] FAIL

---

### Test 5.5: Downgrade from Pro to Party Pass
**Steps:**
1. Have Pro Monthly active
2. Let Pro expire (or cancel)
3. Purchase Party Pass
4. Verify Party Pass works
5. Verify Pro features removed

**Expected Results:**
- ✅ Downgrade handled correctly
- ✅ Party Pass features work
- ✅ Pro-only features locked

**Status:** [ ] PASS / [ ] FAIL

---

## Test Suite 6: Multi-Platform Consistency

### Test 6.1: Purchase on Web, Use on iOS
**Steps:**
1. Purchase Pro Monthly on web
2. Login on iOS device
3. Verify Pro Monthly active
4. Verify features available

**Expected Results:**
- ✅ Entitlement syncs across platforms
- ✅ Features work consistently

**Status:** [ ] PASS / [ ] FAIL

---

### Test 6.2: Purchase on iOS, Use on Android
**Steps:**
1. Purchase Party Pass on iOS
2. Login on Android device
3. Verify Party Pass active
4. Verify timer shows correctly

**Expected Results:**
- ✅ Entitlement syncs across platforms
- ✅ Timer accurate

**Status:** [ ] PASS / [ ] FAIL

---

## Test Suite 7: Network Resilience

### Test 7.1: Payment Success but Network Retry
**Steps:**
1. Initiate payment
2. Simulate network interruption after payment success
3. Retry confirmation
4. Verify no duplicate entitlement
5. Verify correct state

**Expected Results:**
- ✅ Idempotent payment confirmation
- ✅ No duplicate grants
- ✅ Correct final state

**Status:** [ ] PASS / [ ] FAIL

---

### Test 7.2: Offline Mode (No Internet)
**Steps:**
1. Purchase Party Pass online
2. Go offline
3. Reload app
4. Verify entitlements cannot be fetched
5. Go back online
6. Verify entitlements restore

**Expected Results:**
- ✅ Graceful degradation when offline
- ✅ Recovery when back online

**Status:** [ ] PASS / [ ] FAIL

---

## Test Summary

**Total Tests:** 22
**Passed:** ___
**Failed:** ___
**Blocked:** ___

**Critical Issues Found:**
1. 
2. 
3. 

**Notes:**


**Tested By:** _______________
**Date:** _______________
**Build Version:** _______________
