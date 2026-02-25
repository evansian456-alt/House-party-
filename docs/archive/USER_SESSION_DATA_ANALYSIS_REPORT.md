# User and Session Data Storage Analysis Report
## SyncSpeaker Prototype Repository

**Generated:** 2026-02-09  
**Repository:** evansian456-alt/syncspeaker-prototype  
**Analysis Scope:** Complete codebase audit for user-identifiable and session information storage

---

## Executive Summary

This report provides a comprehensive analysis of all locations where user or session information is stored or managed in the SyncSpeaker Prototype application. The analysis covers:

- **5 database tables** storing persistent user data
- **7 in-memory data structures** for active session management
- **6 localStorage keys** for client-side persistence
- **JWT-based authentication** with HTTP-only cookies
- **Redis caching** for distributed party state
- **WebSocket session tracking** for real-time communication

### Storage Categories

| Category | Storage Method | Persistence | User Data Types |
|----------|---------------|-------------|-----------------|
| **Authentication** | PostgreSQL Database | Permanent | Email, password hash, tokens |
| **User Profiles** | PostgreSQL Database | Permanent | DJ name, rank, score, cosmetics |
| **Subscriptions** | PostgreSQL Database | Permanent | Tier, expiration, payment provider |
| **Active Sessions** | In-memory Maps | Temporary (2hr) | WebSocket connections, party membership |
| **Party State** | Redis + In-memory | Temporary (2hr) | Guest names, reactions, messages |
| **Client State** | localStorage | Persistent | Party codes, nicknames, session IDs |
| **Auth Tokens** | HTTP-only Cookies | 7 days | JWT with userId and email |

---

## 1. DATABASE STORAGE (Persistent)

### File: `db/schema.sql`
**Purpose:** Database schema definition for persistent user data

---

#### 1.1 USERS Table (Core Authentication)

**Purpose:** Primary user account and authentication data  
**Lines:** 1-18 in schema.sql

| Column | Type | Purpose | Security Notes |
|--------|------|---------|----------------|
| `id` | UUID | Primary key, user identifier | Auto-generated |
| `email` | TEXT UNIQUE NOT NULL | Login credential | Unique constraint prevents duplicates |
| `password_hash` | TEXT NOT NULL | Authentication | **✓ Bcrypt hashed with 10 salt rounds** |
| `dj_name` | TEXT NOT NULL | Display name | User-controlled string |
| `created_at` | TIMESTAMPTZ | Account creation timestamp | Auto-set |
| `last_login` | TIMESTAMPTZ | Session tracking | Updated on login |
| `email_verified` | BOOLEAN | Email verification status | Default FALSE |
| `email_verify_token` | TEXT | Email verification token | **⚠️ Currently unused** |
| `reset_password_token` | TEXT | Password reset token | **⚠️ Currently unused** |
| `reset_password_expires` | TIMESTAMPTZ | Token expiration | **⚠️ Currently unused** |

**Data Operations:**
- **Create:** `server.js` lines 769-774 (signup endpoint)
- **Read:** `server.js` lines 922-925 (GET /api/me)
- **Update:** `server.js` line 847 (last_login update on login)
- **Delete:** Not implemented (cascade on user deletion)

**Security Considerations:**
- ✓ Passwords stored as bcrypt hashes (never plain text)
- ✓ Email uniqueness enforced at database level
- ⚠️ Email verification system not implemented
- ⚠️ Password reset system not implemented (tokens exist but unused)

---

#### 1.2 SUBSCRIPTIONS Table (Pro Membership)

**Purpose:** Track user subscription and billing status  
**Lines:** 20-33 in schema.sql

| Column | Type | Purpose | Storage Method |
|--------|------|---------|----------------|
| `id` | UUID | Subscription identifier | Auto-generated |
| `user_id` | UUID | Foreign key to users | CASCADE delete |
| `status` | TEXT | Subscription state | CHECK: active/past_due/canceled/trialing |
| `provider` | TEXT | Payment provider | Default: 'simulated' |
| `provider_customer_id` | TEXT | External customer ID | Nullable |
| `provider_subscription_id` | TEXT | External subscription ID | Nullable |
| `current_period_start` | TIMESTAMPTZ | Billing period start | |
| `current_period_end` | TIMESTAMPTZ | Billing period end | |
| `cancel_at_period_end` | BOOLEAN | Cancel flag | Default FALSE |
| `updated_at` | TIMESTAMPTZ | Last modification | Auto-updated |

**Data Operations:**
- **Read:** `server.js` lines 953-960 (GET /api/me includes active subscription)
- **Update:** Payment webhook handlers (not shown in main server.js)

**Index:** `idx_subscriptions_user` on `user_id` for fast lookups

**Security Considerations:**
- ✓ Foreign key constraint ensures data integrity
- ✓ Cascade delete prevents orphaned subscriptions
- ℹ️ External payment IDs stored for reconciliation

---

#### 1.3 DJ_PROFILES Table (User Profile Cosmetics)

**Purpose:** Store DJ rank, cosmetics, and verification status  
**Lines:** 35-48 in schema.sql

| Column | Type | Purpose | Default Value |
|--------|------|---------|---------------|
| `user_id` | UUID | Primary key, foreign key to users | - |
| `dj_score` | INT | Ranking metric | 0 |
| `dj_rank` | TEXT | Rank title | 'Bedroom DJ' |
| `active_visual_pack` | TEXT | Cosmetic theme | NULL |
| `active_title` | TEXT | Cosmetic title | NULL |
| `active_background` | TEXT | Background cosmetic | NULL |
| `verified_badge` | BOOLEAN | Verification status | FALSE |
| `crown_effect` | BOOLEAN | Crown cosmetic effect | FALSE |
| `animated_name` | BOOLEAN | Name animation effect | FALSE |
| `reaction_trail` | BOOLEAN | Reaction trail effect | FALSE |
| `updated_at` | TIMESTAMPTZ | Last modification | NOW() |

**Data Operations:**
- **Create:** `server.js` lines 779-783 (created with new user)
- **Read:** `server.js` lines 934-950 (GET /api/me)
- **Update:** `database.js` lines 176-194 (`updateDjProfileScore` - UPSERT)

**How Data is Used:**
- Display customization (visual packs, backgrounds)
- Leaderboard ranking (dj_score)
- Status badges (verified_badge)
- Visual effects (crown, animations, trails)

**Security Considerations:**
- ✓ One-to-one relationship with users table
- ✓ Cascade delete maintains referential integrity
- ℹ️ Cosmetic data has no authentication implications

---

#### 1.4 PARTY_MEMBERSHIPS Table (Session Participation)

**Purpose:** Track user participation in parties/sessions  
**Lines:** 50-61 in schema.sql

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Membership identifier |
| `party_code` | TEXT | Party identifier (6-char code) |
| `user_id` | UUID | Foreign key to users |
| `role` | TEXT | User role in party |
| `joined_at` | TIMESTAMPTZ | Session join time |
| `left_at` | TIMESTAMPTZ | Session leave time (nullable) |

**Indexes:**
- `idx_party_memberships_party` on `party_code`
- `idx_party_memberships_user` on `user_id`

**How Data is Used:**
- Session history tracking
- Party participation analytics
- Role-based access control (host vs guest)

**Security Considerations:**
- ✓ Foreign key ensures user exists
- ✓ Cascade delete on user removal
- ℹ️ Historical data preserved after party ends
- ⚠️ No TTL - historical records accumulate indefinitely

---

#### 1.5 GUEST_PROFILES Table (Unregistered Users)

**Purpose:** Track guest/anonymous user activity  
**Lines:** 63-77 in schema.sql

| Column | Type | Purpose | Default |
|--------|------|---------|---------|
| `id` | UUID | Guest profile identifier | Auto-generated |
| `guest_identifier` | TEXT | localStorage ID or user_id | UNIQUE |
| `nickname` | TEXT | Display name | NULL |
| `total_contribution_points` | INT | Engagement metric | 0 |
| `guest_rank` | TEXT | Rank title | 'Party Newbie' |
| `parties_joined` | INT | Session counter | 0 |
| `total_reactions_sent` | INT | Reaction counter | 0 |
| `total_messages_sent` | INT | Message counter | 0 |
| `created_at` | TIMESTAMPTZ | Profile creation | NOW() |
| `updated_at` | TIMESTAMPTZ | Last modification | NOW() |

**Indexes:**
- `idx_guest_profiles_identifier` on `guest_identifier` (UNIQUE)
- `idx_guest_profiles_points` on `total_contribution_points` (leaderboard)

**Data Operations:**
- **Create/Read:** `database.js` lines 97-122 (`getOrCreateGuestProfile`)
- **Update:** `database.js` lines 127-150 (`updateGuestProfile` - UPSERT)
- **Update:** `database.js` lines 155-171 (`incrementGuestPartiesJoined`)

**How Data is Used:**
- Guest leaderboard rankings
- Persistent identity across sessions (via localStorage)
- Engagement analytics

**Security Considerations:**
- ✓ Unique constraint on guest_identifier prevents duplicates
- ⚠️ Guest identifier stored in plain text (client-controlled)
- ⚠️ No validation that guest_identifier hasn't been tampered with
- ℹ️ Used for unregistered users without authentication

---

#### 1.6 Additional Supporting Tables

**entitlements** - User cosmetic/feature ownership
- `user_id` (FK to users)
- `item_type` (visual_pack, title, background, etc.)
- `item_key` (specific item identifier)
- `owned` (boolean ownership flag)
- **Read:** `server.js` lines 966-969

**purchases** - Purchase audit log
- `user_id` (FK to users)
- Purchase metadata for payment reconciliation
- Audit trail for financial transactions

**party_scoreboard_sessions** - Party session results
- `host_user_id` (nullable FK to users)
- `party_code`, `ended_at`, `dj_score`
- `guest_scores` (JSON array)
- **Create:** `database.js` lines 199-237 (`savePartyScoreboard`)
- **Read:** `database.js` lines 242-258 (`getPartyScoreboard`)

---

## 2. AUTHENTICATION SYSTEM (Server-Side)

### File: `auth-middleware.js`
**Purpose:** JWT token management, password hashing, authentication middleware

---

#### 2.1 Password Management

**Password Hashing Function**  
**Lines:** 27-29

```javascript
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS); // SALT_ROUNDS = 10
}
```

- **Algorithm:** bcrypt
- **Salt Rounds:** 10 (line 22)
- **Security:** Industry-standard one-way hashing
- **Usage:** `server.js` line 766 (signup endpoint)

**Password Verification Function**  
**Lines:** 34-36

```javascript
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}
```

- **Constant-time comparison** prevents timing attacks
- **Usage:** `server.js` line 838 (login endpoint)

**Password Validation**  
**Lines:** 118-123

```javascript
function isValidPassword(password) {
  if (!password || typeof password !== 'string') {
    return false;
  }
  return password.length >= 6;
}
```

- **Minimum length:** 6 characters
- **No complexity requirements** (⚠️ weak policy)
- **Validated:** `server.js` line 752 (signup), line 828 (login)

**Security Considerations:**
- ✓ Strong hashing algorithm (bcrypt)
- ✓ Adequate salt rounds (10)
- ✓ Constant-time comparison
- ⚠️ Weak password policy (6 char minimum, no complexity)
- ⚠️ No rate limiting on password attempts (could enable brute force)

---

#### 2.2 JWT Token Management

**Token Generation**  
**Lines:** 41-43

```javascript
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }); // 7 days
}
```

- **Expiration:** 7 days (JWT_EXPIRES_IN constant, line 21)
- **Secret:** `JWT_SECRET` environment variable (line 12)
- **Algorithm:** HS256 (default for jwt.sign)
- **Payload:** `{ userId: user.id, email: user.email }` (server.js lines 787-789)

**Token Verification**  
**Lines:** 48-54

```javascript
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}
```

- **Returns:** Decoded payload or null
- **Error handling:** Silent failure returns null
- **Usage:** `requireAuth` middleware (line 76), `optionalAuth` (line 98)

**Token Storage**  
**Server:** HTTP-only cookies  
**Set in:** `server.js` lines 792-797 (signup), 858-863 (login)

```javascript
res.cookie('auth_token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  sameSite: 'lax'
});
```

**Cookie Properties:**
- `httpOnly: true` - **✓ Prevents JavaScript access (XSS protection)**
- `secure: true` (prod only) - **✓ HTTPS-only in production**
- `maxAge: 7 days` - Matches JWT expiration
- `sameSite: 'lax'` - **✓ CSRF protection**

**Security Considerations:**
- ✓ HTTP-only cookies prevent XSS token theft
- ✓ Secure flag in production enforces HTTPS
- ✓ SameSite attribute prevents CSRF
- ⚠️ 7-day expiration is long (no refresh token mechanism)
- ⚠️ No token revocation capability (logout only clears cookie)
- ⚠️ No session tracking server-side (can't revoke compromised tokens)

---

#### 2.3 Authentication Middleware

**requireAuth Middleware**  
**Lines:** 61-83

```javascript
function requireAuth(req, res, next) {
  // TEMPORARY: If auth is disabled, allow all requests through
  if (AUTH_DISABLED) {
    const anonymousId = `anonymous-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.user = { userId: anonymousId, email: 'anonymous@guest.local', djName: 'Guest DJ' };
    return next();
  }
  
  const token = req.cookies?.auth_token;
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  req.user = decoded;
  next();
}
```

**How it Works:**
1. Checks if authentication is disabled (lines 63-67)
2. Reads JWT from `auth_token` cookie (line 70)
3. Returns 401 if token missing (lines 72-73)
4. Verifies token signature and expiration (line 76)
5. Returns 401 if token invalid (lines 77-78)
6. Adds decoded payload to `req.user` (line 81)

**optionalAuth Middleware**  
**Lines:** 89-105

- Similar to `requireAuth` but allows unauthenticated requests
- Adds `req.user` if valid token present, but doesn't block requests

**Security Considerations:**
- ✓ Centralized authentication logic
- ✓ Clear 401 responses for unauthorized access
- ⚠️ **CRITICAL: AUTH_DISABLED mode bypasses all authentication** (lines 9-19, 63-67)
  - When `JWT_SECRET` env var not set, all routes become public
  - Creates anonymous users on each request
  - Console warning issued but functionality remains
- ⚠️ No rate limiting on failed auth attempts

---

#### 2.4 Auth Disabled Mode ⚠️

**Lines:** 9-19

```javascript
const AUTH_DISABLED = !process.env.JWT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET || 'syncspeaker-no-auth-mode';

if (AUTH_DISABLED) {
  console.warn('[Auth] ⚠️  TEMPORARY: Authentication is DISABLED (no JWT_SECRET set)');
  console.warn('[Auth] ⚠️  All protected routes will be publicly accessible');
}
```

**Critical Security Issue:**
- If `JWT_SECRET` environment variable is not set:
  - All authentication is bypassed
  - Protected routes become publicly accessible
  - Anonymous users are generated on each request
  - Console warnings issued but functionality continues
- **Risk Level:** CRITICAL
- **Mitigation:** Ensure `JWT_SECRET` is always set in production

---

## 3. SERVER-SIDE SESSION MANAGEMENT

### File: `server.js`
**Purpose:** WebSocket connections, party state, in-memory session tracking

---

#### 3.1 In-Memory Data Structures

**3.1.1 `clients` Map**  
**Line:** 1639

```javascript
const clients = new Map();  // ws -> { id, party }
```

- **Type:** Map<WebSocket, Object>
- **Purpose:** Track WebSocket connections to client metadata
- **Key:** WebSocket object
- **Value:** `{ id: clientId, party: partyCode }`
- **User Data Stored:**
  - `id`: Numeric client ID (auto-incrementing)
  - `party`: Party code (6-char string, null if not in party)
- **Lifecycle:**
  - **Created:** Line 3995 (on WebSocket connection)
  - **Deleted:** Line 4009 (on WebSocket close)
- **How Used:** Map WebSocket to party for message routing
- **Storage:** In-memory only, cleared on connection close
- **Security:** WebSocket objects not serializable, automatic cleanup

---

**3.1.2 `parties` Map**  
**Line:** 1638

```javascript
const parties = new Map();  // partyCode -> partyData
```

- **Type:** Map<String, Object>
- **Purpose:** Main in-memory storage for party state
- **Key:** Party code (6-character string)
- **Value Structure** (lines 1769-1796):

```javascript
{
  // Core identifiers
  partyCode: string,
  djName: string,
  source: 'web'|'mobile',
  
  // User information
  hostId: number,
  hostConnected: boolean,
  guestCount: number,
  guests: [],
  
  // Party settings
  chatMode: 'all'|'dj_only',
  tier: 'FREE'|'PARTY_PASS'|'PRO_MONTHLY',
  partyPro: boolean,
  partyPassExpiresAt: timestamp|null,
  maxPhones: number,
  
  // Party state
  status: 'active'|'ended',
  createdAt: timestamp,
  expiresAt: timestamp,
  
  // Music state
  currentTrack: { name, artist, duration, startTime },
  queue: [...],
  
  // Engagement
  reactionHistory: [...],
  
  // WebSocket connections
  host: WebSocket,
  members: [{ ws, id, name, isPro, isHost }],
  
  // Scoreboard
  scoreState: {
    dj: { djName, sessionScore, lifetimeScore, djUserId, djIdentifier },
    guests: Map<guestId, { guestId, nickname, points, emojis, messages, rank }>,
    totalReactions: number,
    totalMessages: number,
    peakCrowdEnergy: number
  }
}
```

**User Data Stored:**
- **DJ Information:**
  - `djName`: Host's display name
  - `djUserId`: Database user ID (if authenticated)
  - `djIdentifier`: Guest identifier (if not authenticated)
  - `sessionScore`: Current party score
  - `lifetimeScore`: All-time DJ score
- **Guest Information (in members array):**
  - `ws`: WebSocket connection
  - `id`: Client ID (numeric)
  - `name`: Guest nickname (max 50 chars)
  - `isPro`: Pro badge status
  - `isHost`: Host role flag
- **Guest Scoreboard:**
  - `guestId`: Unique guest identifier
  - `nickname`: Display name
  - `points`: Contribution points
  - `emojis`: Emoji reaction count
  - `messages`: Message count
  - `rank`: Guest rank title

**Data Operations:**
- **Create:** Lines 4376-4380 (on CREATE party)
- **Update:** Throughout message handlers (TRACK_CHANGE, QUEUE_UPDATE, etc.)
- **Delete:** Lines 5777-5791 (on END_PARTY or cleanup)

**How Used:**
- WebSocket message routing
- State synchronization across clients
- Scoreboard calculations
- Queue management
- Reaction tracking

**Storage Method:**
- **In-memory:** Temporary storage in Node.js process
- **Redis backup:** Lines 1661-1700 (for multi-instance support)
- **TTL:** 2 hours (line 1628)

**Security Considerations:**
- ✓ Automatic cleanup on party end
- ✓ Guest names sanitized (line 4351: max 50 chars)
- ✓ WebSocket objects not persisted to Redis
- ⚠️ No encryption of data in memory
- ⚠️ Guest nicknames user-controlled (potential for abuse)

---

**3.1.3 `uploadedTracks` Map**  
**Line:** 1271

```javascript
const uploadedTracks = new Map();
```

- **Type:** Map<String, Object>
- **Purpose:** Track uploaded audio files
- **Key:** Track ID (UUID)
- **Value:**
  ```javascript
  {
    filename: string,
    originalName: string,
    uploadedAt: timestamp,
    filepath: string,
    contentType: string,
    sizeBytes: number
  }
  ```
- **User Data:** Original filename (user-uploaded)
- **TTL:** 2 hours (line 1272)
- **Cleanup:** `cleanupExpiredTracks()` every 5 minutes (lines 1289-1310)

**Security Considerations:**
- ✓ Automatic expiration and cleanup
- ✓ File paths stored server-side only
- ⚠️ Original filename preserved (could contain PII)

---

**3.1.4 `messagingRateLimits` Map**  
**Line:** 1833

```javascript
const messagingRateLimits = new Map();
```

- **Type:** Map<String, Map<String, Array<Number>>>
- **Purpose:** Rate limiting for DJ messaging
- **Structure:** `partyCode -> userId -> [timestamps]`
- **User Data:** Message timestamps per user per party
- **Limits:** Lines 1841-1850
  - 5 messages per 10 seconds (DJ messaging)
  - 10 messages per 60 seconds (guest chat)
- **Cleanup:** Line 5787 (deleted when party ends)

**How Used:**
- Prevent message spam
- Enforce tier-based messaging limits
- Block users exceeding rate limits

**Security Considerations:**
- ✓ Prevents DOS via message flooding
- ✓ Automatic cleanup on party end
- ✓ Temporary storage only

---

**3.1.5 `fallbackPartyStorage` Map**  
**Line:** 1648

```javascript
const fallbackPartyStorage = new Map();
```

- **Type:** Map<String, Object>
- **Purpose:** Backup storage when Redis unavailable
- **Key:** Party code
- **Value:**
  ```javascript
  {
    chatMode: string,
    createdAt: timestamp,
    hostId: number,
    hostConnected: boolean,
    guestCount: number
  }
  ```
- **User Data:** Minimal party metadata
- **Usage:** Lines 1703-1713 (when Redis operations fail)

**Security Considerations:**
- ℹ️ Minimal user data stored
- ℹ️ Only used as fallback
- ⚠️ No automatic cleanup (could accumulate if Redis fails)

---

**3.1.6 Client ID Counters**  
**Lines:** 1642-1644

```javascript
let nextWsClientId = 1;      // WebSocket client IDs
let nextHttpGuestSeq = 1;    // HTTP-generated guest IDs
let nextHostId = 1;          // Host IDs
```

- **Type:** Numbers (auto-incrementing)
- **Purpose:** Generate unique client identifiers
- **User Data:** Numeric IDs only (no PII)
- **Lifecycle:** Reset on server restart
- **Collision Risk:** Low (timestamp + counter combination)

---

#### 3.2 WebSocket Connection Management

**WebSocket Server Initialization**  
**Line:** 3979

```javascript
wss = new WebSocket.Server({ server });
```

**Connection Handler**  
**Lines:** 3981-4015

```javascript
wss.on("connection", (ws) => {
  const clientId = nextWsClientId++;
  clients.set(ws, { id: clientId, party: null });
  
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  
  ws.on("message", (data) => {
    // Message handling...
  });
  
  ws.on("close", () => {
    clients.delete(ws);
    // Cleanup party membership...
  });
});
```

**User Data in WebSocket:**
- **Connection Metadata:**
  - `ws.isAlive`: Heartbeat status (line 3993)
  - `clients.get(ws).id`: Numeric client ID
  - `clients.get(ws).party`: Party code (null until JOIN)
- **Party Membership:**
  - Added to `party.members` array on JOIN (line 4367-4372)
  - Includes: `{ ws, id, name, isPro, isHost }`

**Heartbeat Mechanism**  
**Lines:** 4017-4031

```javascript
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000); // Every 30 seconds
```

- **Purpose:** Detect dead connections
- **Interval:** 30 seconds
- **User Data:** None (only connection status)

**Security Considerations:**
- ✓ Automatic connection cleanup on disconnect
- ✓ Heartbeat prevents zombie connections
- ✓ No sensitive data in WebSocket metadata
- ⚠️ No WebSocket authentication (relies on party code)

---

#### 3.3 Redis Session Storage

**Redis Configuration**  
**Lines:** 142-205

```javascript
const REDIS_URL = process.env.REDIS_URL;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

let redisClient;
if (REDIS_URL) {
  redisClient = redis.createClient({ url: REDIS_URL });
} else {
  redisClient = redis.createClient({
    socket: { host: REDIS_HOST, port: REDIS_PORT },
    password: REDIS_PASSWORD
  });
}
```

**Redis Key Prefixes**  
**Lines:** 1626-1634

```javascript
const PARTY_KEY_PREFIX = "party:";
const PARTY_META_KEY_PREFIX = "party_meta:";
const PARTY_TTL = 7200; // 2 hours
```

**Party Storage Functions**

**`getPartyFromRedis(code)`** - Lines 1661-1677
- Retrieves party data from Redis
- Returns parsed JSON object
- Fallback to `fallbackPartyStorage` if Redis fails

**`setPartyInRedis(code, partyData)`** - Lines 1679-1691
- Stores party data in Redis
- Sets TTL to 2 hours (7200 seconds)
- Sanitizes party data before storage (removes WebSocket objects)

**`deletePartyFromRedis(code)`** - Lines 1693-1700
- Removes party from Redis
- Called on party end or expiration

**Data Stored in Redis:**
- Party metadata (chatMode, tier, createdAt)
- Music state (currentTrack, queue)
- Reaction history
- Guest count and IDs
- Party Pass expiration
- Scoreboard state (DJ score, guest scores)

**Data NOT Stored in Redis:**
- WebSocket connections (line 1636 comment)
- Active client sessions
- In-progress uploads

**Redis Pub/Sub** - Lines 344-412
- Channel: `"party:broadcast"`
- Purpose: Cross-instance message forwarding
- Forwards FEED_EVENT, TRACK_CHANGE, QUEUE_UPDATE, etc.
- Enables horizontal scaling

**Redis URL Sanitization**  
**Lines:** 76-88

```javascript
function sanitizeRedisUrl(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return url;
  }
}
```

**Security Considerations:**
- ✓ TLS support for remote Redis (rediss://)
- ✓ Password sanitization in logs
- ✓ TTL prevents indefinite storage
- ✓ Pub/Sub for multi-instance without exposing connections
- ⚠️ No encryption of data in Redis
- ⚠️ Redis authentication required but not enforced

---

## 4. CLIENT-SIDE STORAGE

### File: `app.js`
**Purpose:** Browser-based client application

---

#### 4.1 localStorage Usage

**4.1.1 `lastPartyCode`**

- **Purpose:** Store recent party code for auto-rejoin
- **Set:** When joining party
- **Read:** On page load for reconnection
- **Data Type:** String (6-character party code)
- **Security:** Party code is not secret but enables session resumption

**4.1.2 `lastGuestName`**

- **Purpose:** Remember guest's previous nickname
- **Set:** When entering guest name
- **Read:** Pre-fill guest name input
- **Data Type:** String (user-provided nickname)
- **Security:** User-controlled display name, no validation

**4.1.3 `syncSpeakerPrototypeId`**

- **Purpose:** Temporary user ID for prototype mode
- **Set:** On first visit in prototype mode
- **Format:** `'proto_' + crypto.randomUUID()` or `'proto_' + Date.now()`
- **Data Type:** String (UUID or timestamp-based)
- **Usage:** Identify users when authentication disabled
- **Security:** Client-generated, can be tampered with

**4.1.4 `syncSpeakerGuestSession`**

- **Purpose:** Guest session data for auto-reconnect
- **Set:** When guest joins party
- **Data Structure:**
  ```javascript
  {
    partyCode: string,
    guestId: string,
    nickname: string,
    joinedAt: timestamp
  }
  ```
- **Data Type:** JSON string
- **Usage:** Restore guest session on page reload
- **Security:** No authentication, client-controlled

**4.1.5 `partyPass_${code}`**

- **Purpose:** Party Pass subscription state per party
- **Key:** `partyPass_${partyCode}`
- **Data Structure:**
  ```javascript
  {
    endTime: timestamp,
    // Additional subscription metadata
  }
  ```
- **Data Type:** JSON string
- **Usage:** Track Party Pass expiration per party
- **Security:** Client-side only, not trusted server-side

**4.1.6 `partyTheme`**

- **Purpose:** User's selected visual theme
- **Values:** "neon", "dark-rave", "festival", "minimal"
- **Data Type:** String
- **Usage:** Persist theme preference
- **Security:** Cosmetic only, no security implications

**4.1.7 `monetization_${email}` ⚠️**

- **Purpose:** User purchases and subscriptions
- **Key:** `monetization_${user.email}`
- **Data Structure:**
  ```javascript
  {
    ownedPacks: [...],
    ownedTitles: [...],
    upgrades: {...}
  }
  ```
- **Data Type:** JSON string
- **Usage:** Track user purchases and entitlements
- **Security Issues:**
  - **⚠️ Email used as localStorage key (exposed in developer console)**
  - **⚠️ Purchase data client-side (not trusted, needs server validation)**
  - **⚠️ Email enumeration possible via localStorage.keys()**

---

#### 4.2 sessionStorage Usage

**No sessionStorage usage found in app.js**

---

#### 4.3 In-Memory State Object

**Main `state` Object** - Lines 59-141

```javascript
const state = {
  // Connection
  clientId: null,
  ws: null,
  
  // Party
  code: null,
  hostId: null,
  isHost: false,
  
  // User identity
  guestNickname: null,
  temporaryUserId: null,
  userTier: USER_TIER.FREE,
  
  // Party Pass
  partyPassActive: false,
  partyPro: false,
  
  // Music
  currentTrack: null,
  queue: [],
  
  // UI state
  screen: 'initial',
  chatMode: 'all',
  
  // Scoreboard
  sessionScore: 0,
  lifetimeScore: 0
};
```

**User-Identifiable Data in State:**
- `clientId`: WebSocket client ID (numeric)
- `guestNickname`: Guest display name
- `temporaryUserId`: Prototype mode user ID
- `userTier`: Subscription level (FREE/PARTY_PASS/PRO)
- `sessionScore`, `lifetimeScore`: DJ scores

**Lifecycle:**
- **Initialize:** Page load
- **Update:** Throughout application lifecycle
- **Clear:** Page unload (no persistence)

**Security Considerations:**
- ✓ In-memory only (cleared on page reload)
- ℹ️ Minimal PII (only display names)
- ⚠️ No encryption (visible in debugger)

---

## 5. AUTHENTICATION ENDPOINTS

### File: `server.js`

---

#### 5.1 POST /api/auth/signup

**Lines:** 738-812  
**Purpose:** Create new user account

**Request Body:**
```javascript
{
  email: string,
  password: string,
  djName: string
}
```

**Process:**
1. Validate email format (line 745)
2. Validate password (line 752)
3. Check email uniqueness (lines 756-763)
4. Hash password with bcrypt (line 766)
5. Create user record (lines 769-774)
6. Create DJ profile (lines 779-783)
7. Generate JWT token (lines 786-789)
8. Set HTTP-only cookie (lines 792-797)
9. Return user object (lines 799-810)

**Response:**
```javascript
{
  user: {
    id: uuid,
    email: string,
    djName: string,
    createdAt: timestamp
  }
}
```

**Rate Limiting:** Lines 704-710
- Max 10 requests per 15 minutes per IP
- Middleware: `express-rate-limit`

**Security Considerations:**
- ✓ Input validation
- ✓ Duplicate email check
- ✓ Password hashing
- ✓ Rate limiting
- ✓ HTTP-only cookie
- ⚠️ Weak password policy (6 char minimum)
- ⚠️ No email verification

---

#### 5.2 POST /api/auth/login

**Lines:** 818-877  
**Purpose:** Authenticate existing user

**Request Body:**
```javascript
{
  email: string,
  password: string
}
```

**Process:**
1. Validate email format (line 825)
2. Validate password (line 828)
3. Fetch user by email (lines 833-835)
4. Verify password hash (lines 838-840)
5. Update last_login timestamp (line 847)
6. Generate JWT token (lines 852-855)
7. Set HTTP-only cookie (lines 858-863)
8. Return user object (lines 865-875)

**Response:**
```javascript
{
  user: {
    id: uuid,
    email: string,
    djName: string
  }
}
```

**Security Considerations:**
- ✓ Constant-time password comparison (bcrypt.compare)
- ✓ Rate limiting (same as signup)
- ✓ HTTP-only cookie
- ⚠️ No account lockout on failed attempts
- ⚠️ Generic error message (good for security, prevents email enumeration)

---

#### 5.3 POST /api/auth/logout

**Lines:** 883-886  
**Purpose:** End user session

**Process:**
1. Clear `auth_token` cookie (line 884)
2. Return success message

**Response:**
```javascript
{
  message: "Logged out successfully"
}
```

**Security Considerations:**
- ✓ Simple cookie deletion
- ⚠️ No server-side session revocation (JWT remains valid until expiration)

---

#### 5.4 GET /api/me

**Lines:** 893-1003  
**Purpose:** Get current user profile and entitlements

**Authentication:** Required (`requireAuth` middleware)

**Process:**
1. Fetch user basic info (lines 922-925)
2. Get DJ profile (lines 934-950)
3. Get active subscription (lines 953-960)
4. Get owned entitlements (lines 966-969)
5. Resolve entitlements (lines 974-996)
6. Return complete user object

**Response:**
```javascript
{
  id: uuid,
  email: string,
  djName: string,
  djProfile: {
    dj_score: number,
    dj_rank: string,
    active_visual_pack: string,
    active_title: string,
    verified_badge: boolean,
    crown_effect: boolean,
    animated_name: boolean,
    reaction_trail: boolean
  },
  subscription: {
    status: string,
    current_period_end: timestamp
  },
  tier: string,
  upgrades: {
    party_pass_expires_at: timestamp,
    pro_monthly_active: boolean
  },
  entitlements: {
    hasPartyPass: boolean,
    hasProMonthly: boolean,
    ownedVisualPacks: [...],
    ownedTitles: [...]
  }
}
```

**Security Considerations:**
- ✓ Requires authentication
- ✓ Returns only user's own data
- ✓ No password hash in response
- ℹ️ Comprehensive user state for client

---

## 6. SECURITY SUMMARY

### 6.1 Security Strengths ✓

| Category | Implementation |
|----------|----------------|
| **Password Storage** | Bcrypt hashing with 10 salt rounds |
| **Token Security** | HTTP-only cookies with secure flag (prod) |
| **CSRF Protection** | SameSite=lax cookie attribute |
| **XSS Prevention** | HTTP-only cookies prevent JS access to tokens |
| **SQL Injection** | Parameterized queries throughout |
| **Data Validation** | Email regex, password length checks |
| **Rate Limiting** | Auth endpoints limited to 10/15min per IP |
| **Connection Security** | TLS support for Redis, HTTPS in production |
| **Session Cleanup** | Automatic WebSocket cleanup on disconnect |
| **TTL Enforcement** | 2-hour TTL on parties and uploads |

---

### 6.2 Security Vulnerabilities ⚠️

| Risk Level | Issue | Location | Impact |
|------------|-------|----------|--------|
| **CRITICAL** | Auth can be disabled if JWT_SECRET not set | `auth-middleware.js:9-19` | All routes become public |
| **HIGH** | Email used as localStorage key | `app.js` | Email enumeration, localStorage keys exposed |
| **HIGH** | No session revocation mechanism | `auth-middleware.js` | Compromised tokens valid for 7 days |
| **HIGH** | Password reset not implemented | `db/schema.sql` | Users can't recover accounts |
| **MEDIUM** | Weak password policy (6 char min) | `auth-middleware.js:122` | Weak passwords allowed |
| **MEDIUM** | No email verification | `db/schema.sql` | Email addresses not validated |
| **MEDIUM** | No account lockout on failed login | `server.js:818-877` | Brute force attacks possible |
| **MEDIUM** | Guest identifiers not validated | `database.js:97-122` | Client can tamper with guest ID |
| **MEDIUM** | No encryption of data in Redis | `server.js:1679-1691` | Data readable if Redis compromised |
| **LOW** | 7-day token expiration | `auth-middleware.js:21` | Long-lived tokens increase risk window |
| **LOW** | Original filename preserved | `server.js:1271` | Uploaded filenames may contain PII |
| **LOW** | No cleanup of fallbackPartyStorage | `server.js:1648` | Memory leak if Redis repeatedly fails |

---

### 6.3 Missing Security Features

| Feature | Status | Impact |
|---------|--------|--------|
| **2FA/MFA** | ❌ Not implemented | Single-factor authentication only |
| **Email Verification** | ❌ Schema exists but unused | Email addresses not validated |
| **Password Reset** | ❌ Schema exists but unused | Users can't recover accounts |
| **Session Revocation** | ❌ Not implemented | Can't revoke compromised tokens |
| **Account Lockout** | ❌ Not implemented | Brute force possible |
| **Data Encryption at Rest** | ❌ Not implemented | Database and Redis unencrypted |
| **Audit Logging** | ⚠️ Partial (purchases only) | Limited security event logging |
| **IP Whitelisting** | ❌ Not implemented | No geographic restrictions |
| **CAPTCHA** | ❌ Not implemented | Automated attacks possible |

---

## 7. DATA FLOW DIAGRAMS

### 7.1 User Registration Flow

```
Client (app.js)
    |
    | POST /api/auth/signup
    | { email, password, djName }
    v
Server (server.js:738-812)
    |
    | 1. Validate input
    | 2. Check email uniqueness
    v
Auth Middleware (auth-middleware.js:27-29)
    |
    | 3. Hash password (bcrypt)
    v
Database (PostgreSQL)
    |
    | 4. INSERT INTO users
    | 5. INSERT INTO dj_profiles
    v
Auth Middleware (auth-middleware.js:41-43)
    |
    | 6. Generate JWT token
    v
Server (server.js:792-797)
    |
    | 7. Set HTTP-only cookie
    v
Client (app.js)
    |
    | 8. Store user in localStorage
    | 9. Navigate to dashboard
```

---

### 7.2 User Login Flow

```
Client (app.js)
    |
    | POST /api/auth/login
    | { email, password }
    v
Server (server.js:818-877)
    |
    | 1. Validate input
    | 2. Fetch user from DB
    v
Auth Middleware (auth-middleware.js:34-36)
    |
    | 3. Verify password hash
    v
Database (PostgreSQL)
    |
    | 4. UPDATE last_login
    v
Auth Middleware (auth-middleware.js:41-43)
    |
    | 5. Generate JWT token
    v
Server (server.js:858-863)
    |
    | 6. Set HTTP-only cookie
    v
Client (app.js)
    |
    | 7. Store user in localStorage
    | 8. Navigate to dashboard
```

---

### 7.3 WebSocket Session Flow

```
Client (app.js)
    |
    | WebSocket connection
    v
Server (server.js:3981-3995)
    |
    | 1. Assign clientId
    | 2. Add to clients Map
    v
Client (app.js)
    |
    | JOIN message
    | { code, name, isHost }
    v
Server (server.js:4063-4372)
    |
    | 3. Validate party exists
    | 4. Add to party.members
    | 5. Store in Redis
    v
Redis
    |
    | 6. Save party state
    | 7. Set TTL (2 hours)
    v
Server (server.js:4367-4372)
    |
    | 8. Send ROOM snapshot
    v
Client (app.js)
    |
    | 9. Update local state
    | 10. Render party UI
```

---

### 7.4 Guest Profile Flow

```
Client (app.js)
    |
    | 1. Generate guest ID in localStorage
    | 2. Join party as guest
    v
Server (server.js)
    |
    | 3. Receive JOIN with guest info
    v
Database (database.js:97-122)
    |
    | 4. getOrCreateGuestProfile()
    | 5. UPSERT into guest_profiles
    v
In-Memory (server.js:parties Map)
    |
    | 6. Add to party.scoreState.guests
    | 7. Track reactions/messages
    v
Database (database.js:127-150)
    |
    | 8. updateGuestProfile() on activity
    | 9. UPDATE contribution_points, reactions, messages
```

---

## 8. RECOMMENDATIONS

### 8.1 Critical Priority (Immediate Action Required)

1. **Fix AUTH_DISABLED Mode**
   - Remove fallback JWT_SECRET value
   - Fail to start if JWT_SECRET not set
   - **Current Risk:** All routes public without env var

2. **Remove Email from localStorage Keys**
   - Use hashed user ID or UUID instead
   - **Current Risk:** Email enumeration, privacy violation

3. **Implement Session Revocation**
   - Add token blacklist or session store
   - Enable logout from all devices
   - **Current Risk:** Compromised tokens valid for 7 days

---

### 8.2 High Priority (Within 1 Month)

4. **Implement Email Verification**
   - Use existing schema fields
   - Send verification emails
   - Require verification for sensitive actions

5. **Implement Password Reset**
   - Use existing schema fields
   - Time-limited reset tokens
   - Email-based recovery flow

6. **Add Account Lockout**
   - Lock after 5 failed login attempts
   - 15-minute lockout period
   - Email notification on lockout

7. **Strengthen Password Policy**
   - Minimum 8 characters (currently 6)
   - Require uppercase, lowercase, number
   - Check against common password lists

---

### 8.3 Medium Priority (Within 3 Months)

8. **Encrypt Data in Redis**
   - Encrypt party state before storage
   - Use application-level encryption
   - **Current Risk:** Readable if Redis compromised

9. **Add Audit Logging**
   - Log login attempts (success/fail)
   - Log password changes
   - Log account modifications
   - Retain logs for compliance

10. **Validate Guest Identifiers**
    - Server-generate guest IDs
    - Sign guest IDs to prevent tampering
    - **Current Risk:** Client can forge guest ID

11. **Implement CAPTCHA**
    - Protect signup/login forms
    - Prevent automated account creation
    - Reduce brute force risk

---

### 8.4 Low Priority (Future Enhancements)

12. **Implement 2FA/MFA**
    - TOTP-based (Google Authenticator)
    - SMS backup codes
    - Enhanced account security

13. **Add Data Encryption at Rest**
    - Encrypt sensitive DB columns
    - Use PostgreSQL pgcrypto
    - Encrypt file uploads

14. **Reduce Token Expiration**
    - Reduce from 7 days to 24 hours
    - Implement refresh tokens
    - Improve security/UX balance

15. **Add Geographic Restrictions**
    - IP whitelisting for admin
    - Country-based access control
    - Fraud prevention

---

## 9. COMPLIANCE CONSIDERATIONS

### 9.1 GDPR (General Data Protection Regulation)

**Personal Data Collected:**
- Email addresses (users table)
- Display names (dj_name, nickname)
- IP addresses (rate limiting logs)
- Usage data (party participation, reactions, messages)

**User Rights:**
- ❌ **Right to Access:** No API endpoint to export user data
- ❌ **Right to Erasure:** No account deletion implemented
- ❌ **Right to Portability:** No data export functionality
- ⚠️ **Right to Rectification:** Partial (can update DJ name, but no email change)

**Recommendations:**
- Add GET /api/me/export endpoint (JSON export of all user data)
- Add DELETE /api/me endpoint (account deletion)
- Add PUT /api/me/email endpoint (email change with verification)
- Add privacy policy acceptance tracking

---

### 9.2 CCPA (California Consumer Privacy Act)

**Similar Requirements to GDPR:**
- Right to know what data is collected
- Right to delete personal data
- Right to opt-out of data selling (not applicable - no data selling)

**Recommendations:**
- Same as GDPR compliance above
- Add "Do Not Sell My Info" disclosure (even if not selling)

---

### 9.3 Data Retention

**Current Retention Policies:**
- User accounts: Indefinite (no deletion)
- Guest profiles: Indefinite (no cleanup)
- Party data: 2 hours TTL (Redis)
- Party memberships: Indefinite (historical records)
- Uploaded tracks: 2 hours TTL

**Recommendations:**
- Define retention periods for each data type
- Implement automatic data deletion
- Allow users to request data deletion
- Archive old data instead of deleting (for analytics)

---

## 10. APPENDIX

### 10.1 Data Storage Summary Table

| Data Type | Storage Location | Persistence | TTL/Retention | Contains PII |
|-----------|------------------|-------------|---------------|--------------|
| Email | PostgreSQL (users) | Permanent | Indefinite | ✓ Yes |
| Password Hash | PostgreSQL (users) | Permanent | Indefinite | ✓ Yes |
| DJ Name | PostgreSQL (users) | Permanent | Indefinite | ✓ Yes |
| DJ Score | PostgreSQL (dj_profiles) | Permanent | Indefinite | ℹ️ Indirect |
| Guest Nickname | PostgreSQL (guest_profiles) | Permanent | Indefinite | ✓ Yes |
| Guest ID | PostgreSQL, localStorage | Permanent | Indefinite | ⚠️ Pseudonym |
| Subscription | PostgreSQL (subscriptions) | Permanent | Indefinite | ℹ️ Financial |
| Party Code | Redis, In-memory | Temporary | 2 hours | ℹ️ Session ID |
| WebSocket Connection | In-memory (Map) | Temporary | Session | ℹ️ Connection |
| JWT Token | HTTP-only Cookie | Temporary | 7 days | ✓ Yes |
| Guest Session | localStorage | Persistent | User-controlled | ✓ Yes |
| Party Theme | localStorage | Persistent | User-controlled | ℹ️ Preference |
| Reaction History | Redis, In-memory | Temporary | 2 hours | ℹ️ Activity |
| Message Timestamps | In-memory (Map) | Temporary | Party duration | ℹ️ Rate limit |
| Uploaded Filename | In-memory (Map), Disk | Temporary | 2 hours | ⚠️ Possible PII |

---

### 10.2 File Reference Index

| File | Primary Purpose | User Data Types |
|------|-----------------|-----------------|
| `db/schema.sql` | Database schema | Email, password, profiles, subscriptions |
| `auth-middleware.js` | Auth & JWT | Tokens, password hashing |
| `auth.js` | Client auth | localStorage user data |
| `database.js` | DB operations | Guest profiles, DJ scores |
| `server.js` | Main server | Sessions, WebSockets, parties |
| `app.js` | Client app | localStorage, in-memory state |

---

### 10.3 Environment Variables

**Required:**
- `JWT_SECRET` - JWT signing key (**CRITICAL: Must be set**)
- `DATABASE_URL` - PostgreSQL connection string

**Optional:**
- `REDIS_URL` - Redis connection string (or use REDIS_HOST/PORT/PASSWORD)
- `REDIS_HOST` - Redis hostname (default: localhost)
- `REDIS_PORT` - Redis port (default: 6379)
- `REDIS_PASSWORD` - Redis password
- `NODE_ENV` - Environment (production enables secure cookies)

---

### 10.4 Glossary

- **PII (Personally Identifiable Information):** Data that can identify a specific individual (email, name, IP address)
- **JWT (JSON Web Token):** Signed token containing user identity claims
- **Bcrypt:** Password hashing algorithm with built-in salting
- **HTTP-only Cookie:** Cookie not accessible via JavaScript (XSS protection)
- **CSRF (Cross-Site Request Forgery):** Attack forcing authenticated user to submit unwanted requests
- **TTL (Time To Live):** Duration before data expires and is deleted
- **UPSERT:** Database operation that updates if exists, inserts if not
- **WebSocket:** Protocol for bidirectional real-time communication

---

## CONCLUSION

This analysis identified **comprehensive user and session data management** across the SyncSpeaker Prototype application. Key findings:

**Strengths:**
- Strong password hashing (bcrypt)
- HTTP-only cookies for token security
- Automatic session cleanup
- Rate limiting on auth endpoints

**Critical Risks:**
- Authentication can be completely disabled
- No session revocation mechanism
- Email exposed in localStorage keys
- Missing password reset and email verification

**Immediate Actions Required:**
1. Fix AUTH_DISABLED mode (enforce JWT_SECRET)
2. Remove email from localStorage keys
3. Implement session revocation

This report serves as a foundation for security improvements and compliance efforts.

---

**Report End**
