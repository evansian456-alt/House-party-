# API Reference

**Complete reference for Phone Party REST API endpoints**

This document provides detailed information about all HTTP API endpoints available in the Phone Party application.

---

## 📋 Table of Contents

- [Authentication Endpoints](#authentication-endpoints)
- [Party Management Endpoints](#party-management-endpoints)
- [Audio Upload Endpoints](#audio-upload-endpoints)
- [Messaging Endpoints](#messaging-endpoints)
- [Purchase Endpoints](#purchase-endpoints)
- [Leaderboard Endpoints](#leaderboard-endpoints)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

---

## 🔐 Authentication Endpoints

### POST /api/auth/signup

Create a new user account.

**Rate Limit**: 10 requests per 15 minutes per IP

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "djName": "DJ Cool"
}
```

**Validation**:
- Email must be valid format
- Password must be 8-128 characters
- DJ name must be 2-30 characters

**Success Response** (200 OK):
```json
{
  "success": true,
  "user": {
    "id": 123,
    "email": "user@example.com",
    "djName": "DJ Cool"
  }
}
```

**Error Responses**:
- `400 Bad Request` - Invalid email format, password too short/long, or DJ name too short/long
- `409 Conflict` - Email already exists
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Database or server error

**HTTP-Only Cookie Set**: `auth_token` (expires in 7 days)

---

### POST /api/auth/login

Log in to an existing account.

**Rate Limit**: 10 requests per 15 minutes per IP

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "user": {
    "id": 123,
    "email": "user@example.com",
    "djName": "DJ Cool"
  }
}
```

**Error Responses**:
- `400 Bad Request` - Invalid email format
- `401 Unauthorized` - Invalid email or password
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Database or server error

**HTTP-Only Cookie Set**: `auth_token` (expires in 7 days)

---

### POST /api/auth/logout

Log out and clear authentication cookie.

**Authentication**: Required (valid auth_token cookie)

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**HTTP-Only Cookie Cleared**: `auth_token`

---

## 🎉 Party Management Endpoints

### POST /api/create-party

Create a new party and become the host.

**Authentication**: Optional (creates anonymous party if not authenticated)

**Rate Limit**: 30 requests per minute per IP

**Request Body**:
```json
{
  "maxPhones": 10,
  "promoCode": "SS-PARTY-A9K2"
}
```

**Parameters**:
- `maxPhones` (optional): Maximum number of phones allowed (default: based on tier)
- `promoCode` (optional): Promo code for party-wide Pro unlock

**Success Response** (200 OK):
```json
{
  "success": true,
  "partyCode": "ABC123",
  "isHost": true,
  "maxPhones": 10
}
```

**Error Responses**:
- `400 Bad Request` - Invalid promo code or max phones value
- `403 Forbidden` - User tier doesn't allow requested max phones
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Redis or server error

---

### POST /api/join-party

Join an existing party as a guest.

**Rate Limit**: 30 requests per minute per IP

**Request Body**:
```json
{
  "code": "ABC123"
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "partyCode": "ABC123",
  "isHost": false,
  "hostName": "DJ Cool"
}
```

**Error Responses**:
- `400 Bad Request` - Missing or invalid party code
- `404 Not Found` - Party not found or expired
- `403 Forbidden` - Party is full
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Redis or server error

---

### POST /api/end-party

End an active party (host only).

**Authentication**: Required (must be party host)

**Rate Limit**: 30 requests per minute per IP

**Request Body**:
```json
{
  "code": "ABC123"
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Party ended"
}
```

**Error Responses**:
- `400 Bad Request` - Missing party code
- `403 Forbidden` - Not the party host
- `404 Not Found` - Party not found
- `500 Internal Server Error` - Redis or server error

---

## 🎵 Audio Upload Endpoints

### POST /api/tracks/presign-put

Generate a presigned PUT URL for direct-to-R2 audio upload (bypasses the server).

> **Note**: `multer` file size limits do NOT apply to presigned uploads. Size is enforced
> server-side via the `sizeBytes` parameter before issuing the URL.

**Authentication**: Not required (party host session context expected)

**Request Body**:
```json
{
  "filename": "my-track.mp3",
  "contentType": "audio/mpeg",
  "sizeBytes": 5242880
}
```

**Validation**:
- `filename`: required, non-empty string
- `contentType`: required, must start with `audio/` — enforced server-side
- `sizeBytes`: required number, finite, > 0, ≤ `TRACK_MAX_BYTES` (default 50 MB)

**Success Response** (`200`):
```json
{
  "ok": true,
  "trackId": "ABCDEF123456",
  "key": "tracks/ABCDEF123456.mp3",
  "putUrl": "https://r2.example.com/signed-put-url?X-Amz-Signature=...",
  "trackUrl": "https://cdn.example.com/tracks/ABCDEF123456.mp3"
}
```

The `putUrl` is a presigned S3 PUT URL valid for 15 minutes. Upload the audio file
directly to this URL with `Content-Type` matching the requested `contentType`.
The `putUrl` is **not logged** server-side.

**Error Responses**:
- `400 Bad Request` — validation failure (missing/invalid fields)
- `503 Service Unavailable` — storage provider not ready
- `400` — storage does not support presigned uploads (use `/api/upload-track` instead)

**Fallback behaviour**: The frontend upload flow automatically falls back to
`POST /api/upload-track` if the presigned PUT fails after one retry. The fallback
is transparent to the user (a status message "Direct upload failed. Falling back…"
is shown briefly).

---

### POST /api/upload-track

Legacy multipart upload endpoint. Used as a fallback when presigned uploads are
unavailable or fail. Accepts `multipart/form-data` with an `audio` field.

---

## 💬 Messaging Endpoints

### POST /api/host-message

Send a message from host to all guests (Party Pass tier and above).

**Authentication**: Required (must be party host with Party Pass or Pro Monthly)

**Rate Limit**: Custom rate limiting (10 messages per minute with 2-second minimum interval)

**Request Body**:
```json
{
  "message": "Welcome to the party!",
  "partyCode": "ABC123"
}
```

**Success Response** (200 OK):
```json
{
  "success": true
}
```

**Error Responses**:
- `400 Bad Request` - Message too long (>200 characters) or missing
- `403 Forbidden` - User doesn't have Party Pass or Pro Monthly tier
- `429 Too Many Requests` - Rate limit exceeded (too many messages too quickly)
- `500 Internal Server Error` - Server error

---

## 💎 Purchase Endpoints

### POST /api/purchase/party-pass

Purchase a 2-hour Party Pass.

**Authentication**: Required

**Rate Limit**: 10 requests per minute per IP

**Request Body**:
```json
{
  "paymentToken": "tok_test_123456"
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "expiresAt": "2026-02-16T12:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request` - Missing or invalid payment token
- `402 Payment Required` - Payment failed
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Database or server error

**Note**: Current implementation uses simulated payments. Production integration required.

---

### POST /api/purchase/pro-monthly

Subscribe to Pro Monthly plan.

**Authentication**: Required

**Rate Limit**: 10 requests per minute per IP

**Request Body**:
```json
{
  "paymentToken": "tok_test_123456"
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "status": "active"
}
```

**Error Responses**:
- `400 Bad Request` - Missing or invalid payment token
- `402 Payment Required` - Payment failed
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Database or server error

**Note**: Current implementation uses simulated payments. Production integration required.

---

## 🏆 Leaderboard Endpoints

### GET /api/leaderboard/dj

Get the top DJs by score.

**Rate Limit**: 30 requests per minute per IP

**Query Parameters**:
- `limit` (optional): Number of results to return (default: 10, max: 100)

**Success Response** (200 OK):
```json
{
  "success": true,
  "leaderboard": [
    {
      "userId": 123,
      "djName": "DJ Cool",
      "djScore": 1500,
      "rank": 1
    },
    {
      "userId": 456,
      "djName": "DJ Fire",
      "djScore": 1200,
      "rank": 2
    }
  ]
}
```

**Note**: Only DJs with active Pro Monthly subscriptions appear on the leaderboard.

---

### GET /api/leaderboard/guest/:guestIdentifier

Get guest profile and contribution points.

**Rate Limit**: 30 requests per minute per IP

**Success Response** (200 OK):
```json
{
  "success": true,
  "profile": {
    "guestIdentifier": "guest_abc123",
    "totalContributionPoints": 250,
    "partiesAttended": 5
  }
}
```

**Error Responses**:
- `404 Not Found` - Guest profile not found
- `500 Internal Server Error` - Database error

---

## ⚠️ Error Handling

All error responses follow this format:

```json
{
  "error": "Human-readable error message"
}
```

### Common HTTP Status Codes

| Code | Meaning | When It Occurs |
|------|---------|----------------|
| `200` | OK | Request succeeded |
| `400` | Bad Request | Invalid input or missing required fields |
| `401` | Unauthorized | Invalid or missing authentication |
| `403` | Forbidden | Authentication valid but access denied (tier restrictions, not party host, etc.) |
| `404` | Not Found | Resource doesn't exist (party, user, etc.) |
| `409` | Conflict | Resource already exists (duplicate email, etc.) |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server or database error |

---

## 🚦 Rate Limiting

Phone Party implements rate limiting to prevent abuse:

### Auth Endpoints (`/api/auth/*`)
- **Window**: 15 minutes
- **Max Requests**: 10 per IP
- **Headers**: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`

### General API Endpoints (`/api/*`)
- **Window**: 1 minute
- **Max Requests**: 30 per IP
- **Headers**: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`

### Purchase Endpoints (`/api/purchase/*`)
- **Window**: 1 minute
- **Max Requests**: 10 per IP
- **Headers**: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`

### Rate Limit Response

When rate limit is exceeded:

```json
{
  "error": "Too many requests, please try again later"
}
```

**HTTP Status**: `429 Too Many Requests`

**Headers**:
- `Retry-After`: Number of seconds to wait before retrying

---

## 🔌 WebSocket API

Phone Party uses WebSocket for real-time communication. WebSocket messages are not covered in this REST API reference.

For WebSocket protocol documentation, see:
- `docs/SYNC_ARCHITECTURE_EXPLAINED.md` - Sync protocol
- `docs/EVENT_REPLAY_SYSTEM.md` - Message delivery system
- `docs/EMOJI_REACTION_SYSTEM.md` - Reaction system

---

## 📚 Additional Resources

- **[README.md](../README.md)** - Main documentation
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Contribution guidelines
- **[docs/SYNC_ARCHITECTURE_EXPLAINED.md](SYNC_ARCHITECTURE_EXPLAINED.md)** - Sync system details

---

**Last Updated**: February 16, 2026  
**API Version**: 1.0  
**Server Implementation**: `server.js`
