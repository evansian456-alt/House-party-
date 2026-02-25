# What's Left To Do - Quick Reference

**TL;DR:** The browser app is 80% done. Main missing pieces are messaging, reactions, store purchases, and payment processing.

---

## 🚦 Status at a Glance

| Component | Status | Effort |
|-----------|--------|--------|
| Core Infrastructure | ✅ 100% | Done |
| Single-Device Mode | ✅ 100% | Done |
| Multi-Device Sync | ✅ 100% | Done |
| **Messaging** | ⚠️ 0% (placeholder UI only) | **8-12 hours** |
| **Reactions** | ⚠️ 0% (placeholder UI only) | **4-6 hours** |
| **Store Purchases** | ⚠️ 0% | **16-20 hours** |
| **Payment Processing** | ⚠️ 50% (simulated) | **12-16 hours** |
| **E2E Tests** | ⚠️ 80% (20% missing) | **8-10 hours** |
| Auth Tests | ❌ 4 failing | **1 hour** |
| Production Security | ⚠️ 70% | **4-6 hours** |

**Total to Complete Everything:** 40-60 hours  
**Minimum Viable:** 8-12 hours (messaging + reactions + fix tests)

---

## 🔴 Critical TODOs (Must Fix)

### 1. Fix Failing Auth Tests (1 hour)
**Problem:** JWT_SECRET not set in test environment  
**Fix:**
```bash
# Add to jest.setup.js
process.env.JWT_SECRET = 'test-secret-for-testing-only';
```

### 2. Implement Messaging System (8-12 hours)
**Problem:** Guest messaging UI exists but doesn't work  
**Location:** `app.js` - search for "handleSendMessage"  
**What to Do:**
- Add WebSocket `GUEST_MESSAGE` handler in `server.js`
- Implement message broadcasting to all party members
- Add message feed storage (Redis or in-memory)
- Enforce tier-based message limits
- Create tests: `messaging.test.js`

**Code Needed:**
```javascript
// server.js - Add message handler
case 'GUEST_MESSAGE':
  if (!party) return;
  // Broadcast to all party members
  party.members.forEach(member => {
    member.ws.send(JSON.stringify({
      t: 'NEW_MESSAGE',
      from: msg.guestId,
      text: msg.text,
      timestamp: Date.now()
    }));
  });
  break;
```

### 3. Implement Reactions System (4-6 hours)
**Problem:** Reaction UI exists but doesn't work  
**What to Do:**
- Add WebSocket reaction handlers
- Implement DJ screen reaction display
- Add crowd energy visualization
- Create tests: `reactions.test.js`

---

## 🟡 High Priority (Should Fix)

### 4. WebSocket Sync Feedback (4-6 hours)
**Problem:** Guest sync issues not reported to host  
**Location:** `app.js` line 2971 - "TODO: Send WebSocket message to host about sync issue"  
**What to Do:**
- Add guest sync drift detection
- Send SYNC_ISSUE message to server
- Notify host with warning
- Update `sync.test.js`

### 5. Complete E2E Tests (8-10 hours)
**Problem:** 20% of E2E test coverage missing  
**Missing Sections:**
- Section 3: Store purchases (0%)
- Section 4: Multi-device party (partial)
- Section 5: In-party features (partial)

**Create:**
- `e2e-tests/03-store-purchases.spec.js`
- `e2e-tests/04-multi-device-party.spec.js`
- `e2e-tests/05-in-party-features.spec.js`

---

## 🟢 Nice to Have (Optional)

### 6. Store Purchases System (16-20 hours)
**Problem:** Not implemented at all  
**What to Do:**
- Create store catalog UI
- Implement purchase flow
- Add database tables for purchases/inventory
- Apply visual items (badges, crowns, titles)
- Create tests

**Database:**
```sql
CREATE TABLE user_purchases (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  item_type VARCHAR(50),
  item_id VARCHAR(100),
  purchased_at TIMESTAMP DEFAULT NOW()
);
```

### 7. Real Payment Processing (12-16 hours)
**Problem:** Currently simulated only  
**Options:**
- **A: Integrate Stripe** (recommended for production)
- **B: Keep simulated** (fine for prototype)

**If going production:**
```bash
npm install stripe
# Add to .env:
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

### 8. Production Security (4-6 hours)
**Problem:** JWT_SECRET not documented for production  
**What to Do:**
- Document JWT_SECRET setup in RAILWAY_DEPLOYMENT.md
- Add email system integration (SendGrid/SES)
- Security audit
- Error handling improvements

### 9. Performance Optimizations (2-4 hours)
**Problem:** Missing gzip compression and audio optimization  
**What to Do:**
```bash
npm install compression
```
```javascript
// server.js
const compression = require('compression');
app.use(compression());
```

---

## 📋 Recommended Implementation Order

### **Path A: Full Production (40-60 hours)**
1. Fix auth tests (1h)
2. Implement messaging (10h)
3. Implement reactions (5h)
4. Add sync feedback (5h)
5. Complete E2E tests (10h)
6. Build store purchases (18h)
7. Integrate Stripe payments (12h)
8. Production security (5h)
9. Performance optimization (3h)

**Result:** Fully functional, production-ready app with monetization

---

### **Path B: Enhanced Prototype (20-30 hours)** ⭐ RECOMMENDED
1. Fix auth tests (1h)
2. Implement messaging (10h)
3. Implement reactions (5h)
4. Add sync feedback (5h)
5. Complete E2E tests (10h)
6. Production security (4h)
7. Performance optimization (3h)

**Skip:** Store purchases, real payments (keep simulated)  
**Result:** Fully functional app without store/payments

---

### **Path C: Minimum Viable (8-12 hours)**
1. Fix auth tests (1h)
2. Basic messaging (simplified) (4-6h)
3. Basic reactions (simplified) (2-3h)
4. Essential E2E tests (2-3h)

**Skip:** Everything else  
**Result:** Basic working prototype for testing

---

## 🎯 Next Steps

### Immediate Actions (Start Here):

1. **Fix Tests** (30 minutes)
   ```bash
   cd /home/runner/work/syncspeaker-prototype/syncspeaker-prototype
   
   # Add JWT_SECRET to test environment
   echo "process.env.JWT_SECRET = 'test-secret';" >> jest.setup.js
   
   # Verify tests pass
   npm test
   ```

2. **Choose Your Path**
   - Production app? → Path A (40-60 hours)
   - Prototype for testing? → Path B (20-30 hours) ⭐
   - Quick demo? → Path C (8-12 hours)

3. **Start Implementation**
   - Begin with messaging system (highest impact)
   - Then reactions (builds on messaging)
   - Then complete tests
   - Then optional features

---

## 📊 Priority Matrix

```
High Impact, Low Effort (DO FIRST):
✅ Fix auth tests (1h)
✅ Basic messaging (6h simplified)
✅ Basic reactions (3h simplified)

High Impact, High Effort (DO NEXT):
⚠️ Full messaging system (10h)
⚠️ Complete E2E tests (10h)
⚠️ Sync feedback (5h)

Low Impact, High Effort (DO LAST):
⚠️ Store purchases (18h)
⚠️ Payment integration (12h)
```

---

## 📞 Quick Summary

**What Works:**
- ✅ Single-device party creation and testing
- ✅ Multi-device sync and audio playback
- ✅ Tier system (Free, Party Pass, Pro)
- ✅ Authentication and accounts
- ✅ 265 passing tests

**What's Missing:**
- ❌ Messaging (placeholder only)
- ❌ Reactions (placeholder only)
- ❌ Store purchases (not implemented)
- ❌ Real payments (simulated only)
- ❌ 20% of E2E tests

**What's Broken:**
- ❌ 4 failing auth tests (easy fix - 1 hour)

**Time to Complete:**
- Full production: 40-60 hours
- Enhanced prototype: 20-30 hours ⭐
- Minimum viable: 8-12 hours

**Recommended:** Path B (Enhanced Prototype) - gives you a fully working app without the complexity of store/payments.

---

## 📚 Related Documentation

- **Full Details:** `BROWSER_APP_COMPLETION_ROADMAP.md`
- **Current Status:** `BROWSER_ONLY_READY.md`
- **Testing Guide:** `E2E_TEST_GUIDE.md`
- **Manual Testing:** `MANUAL_TEST_CHECKLIST.md`
- **Deployment:** `RAILWAY_DEPLOYMENT.md`

---

**Status:** 📋 Assessment Complete  
**Next Action:** Choose Path A, B, or C and begin implementation  
**Questions?** See `BROWSER_APP_COMPLETION_ROADMAP.md` for detailed explanations
