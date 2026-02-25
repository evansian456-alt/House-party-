# Health Checks & Operational Readiness

**Guide to health check endpoints and operational monitoring for Phone Party**

This document explains the health check endpoints, their purpose, and how to use them for monitoring and load balancing.

---

## Health Check Endpoints

Phone Party provides two health check endpoints with different purposes:

### 1. `/health` - Basic Health Check

**Purpose:** Fast, lightweight health check for basic uptime monitoring

**Method:** `GET`

**Authentication:** None (public endpoint)

**Response Time:** < 50ms

**Response:**
```json
{
  "status": "ok",
  "instanceId": "server-abc123",
  "redis": "ready",
  "version": "0.1.0-party-fix",
  "configSource": "REDIS_URL",
  "uptimeSeconds": 3600
}
```

**Redis Status Values:**
- `"ready"` - Redis is connected and functioning
- `"fallback"` - Using in-memory fallback (development only)
- `"error"` - Redis connection failed

**When to use:**
- Uptime monitoring services (UptimeRobot, Pingdom)
- Basic availability checks
- Quick manual verification

**Example:**
```bash
curl https://phoneparty.example.com/health
```

---

### 2. `/api/health` - Detailed Readiness Check

**Purpose:** Comprehensive readiness check with active connectivity tests

**Method:** `GET`

**Authentication:** None (public endpoint)

**Response Time:** < 1000ms (includes active Redis ping)

**Response:**
```json
{
  "ok": true,
  "status": "ready",
  "instanceId": "server-abc123",
  "redis": {
    "connected": true,
    "ping": "PONG",
    "latency": 5
  },
  "version": "0.1.0-party-fix",
  "uptimeSeconds": 3600
}
```

**Status Values:**
- `"ready"` - Server is ready to accept traffic
- `"degraded"` - Server is running but Redis unavailable (development mode)
- `"not_ready"` - Server is not ready (production without Redis)

**When to use:**
- Load balancer health checks
- Kubernetes liveness/readiness probes
- Detailed diagnostics
- Pre-deployment verification

**Example:**
```bash
curl https://phoneparty.example.com/api/health
```

---

## Liveness vs Readiness

### Liveness Check
**"Is the application process running?"**

- Use: `/health`
- Frequency: Every 10-30 seconds
- Timeout: 5 seconds
- Action on failure: Restart container/process

### Readiness Check
**"Is the application ready to serve traffic?"**

- Use: `/api/health`
- Frequency: Every 30 seconds
- Timeout: 10 seconds  
- Action on failure: Remove from load balancer pool

---

## Load Balancer Configuration

### AWS Application Load Balancer

```
Target Group Health Check:
  Protocol: HTTP
  Path: /health
  Port: 8080
  Healthy threshold: 2
  Unhealthy threshold: 3
  Timeout: 5 seconds
  Interval: 30 seconds
  Success codes: 200
```

### NGINX Upstream Health Check

```nginx
upstream phoneparty_backend {
    server 127.0.0.1:8080 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:8081 max_fails=3 fail_timeout=30s;
}

server {
    location /health {
        access_log off;  # Don't log health checks
        proxy_pass http://phoneparty_backend;
    }
}
```

### HAProxy

```
backend phoneparty
    option httpchk GET /health HTTP/1.1
    http-check expect status 200
    server app1 127.0.0.1:8080 check inter 30s fall 3 rise 2
    server app2 127.0.0.1:8081 check inter 30s fall 3 rise 2
```

### Kubernetes

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: phoneparty
spec:
  containers:
  - name: phoneparty
    image: phoneparty:latest
    ports:
    - containerPort: 8080
    livenessProbe:
      httpGet:
        path: /health
        port: 8080
      initialDelaySeconds: 30
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /api/health
        port: 8080
      initialDelaySeconds: 10
      periodSeconds: 30
      timeoutSeconds: 10
      failureThreshold: 3
```

### Docker Compose

```yaml
services:
  phoneparty:
    image: phoneparty:latest
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s
```

---

## Monitoring Integration

### Uptime Monitoring Services

**UptimeRobot:**
```
Monitor Type: HTTP(S)
URL: https://phoneparty.example.com/health
Monitoring Interval: 5 minutes
Alert Contacts: team@example.com
```

**Pingdom:**
```
Check Type: HTTP
URL: https://phoneparty.example.com/health
Check Interval: 1 minute
Response Time Alert: > 2000ms
```

**StatusCake:**
```
Test Type: HTTP
Website URL: https://phoneparty.example.com/health
Check Rate: Every 5 minutes
Confirmation Servers: 3
```

### Application Monitoring

**Sentry Health Check:**
```javascript
// Already configured in server.js
if (process.env.SENTRY_DSN) {
  // Errors automatically sent to Sentry
}
```

**Custom Monitoring Script:**
```bash
#!/bin/bash
# monitor-health.sh

ENDPOINT="https://phoneparty.example.com/health"
ALERT_EMAIL="devops@example.com"

response=$(curl -s -w "\n%{http_code}" "$ENDPOINT")
status_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$status_code" != "200" ]; then
  echo "Health check failed with status $status_code" | \
    mail -s "Phone Party Health Alert" "$ALERT_EMAIL"
  exit 1
fi

redis_status=$(echo "$body" | jq -r '.redis')
if [ "$redis_status" != "ready" ]; then
  echo "Redis is $redis_status" | \
    mail -s "Phone Party Redis Alert" "$ALERT_EMAIL"
  exit 1
fi

echo "Health check passed"
exit 0
```

---

## Operational Procedures

### Pre-Deployment Health Check
```bash
# Before deploying new version, verify staging health
curl https://staging.phoneparty.example.com/api/health | jq .

# Expected: {"ok": true, "status": "ready", ...}
```

### Post-Deployment Verification
```bash
#!/bin/bash
# deploy-verify.sh

echo "Waiting for deployment to stabilize..."
sleep 30

echo "Checking health endpoint..."
for i in {1..5}; do
  response=$(curl -s https://phoneparty.example.com/health)
  status=$(echo "$response" | jq -r '.status')
  redis=$(echo "$response" | jq -r '.redis')
  
  echo "Attempt $i: status=$status, redis=$redis"
  
  if [ "$status" = "ok" ] && [ "$redis" = "ready" ]; then
    echo "✅ Deployment verified successfully"
    exit 0
  fi
  
  sleep 10
done

echo "❌ Deployment verification failed"
exit 1
```

### Troubleshooting Failed Health Checks

**If `/health` returns 500 or timeout:**
1. Check if server process is running
   ```bash
   pm2 list
   # or
   systemctl status phoneparty
   ```

2. Check server logs for errors
   ```bash
   pm2 logs phoneparty --lines 100
   ```

3. Check port binding
   ```bash
   netstat -tulpn | grep 8080
   ```

**If `/health` returns `{"redis": "error"}`:**
1. Verify REDIS_URL is set correctly
   ```bash
   echo $REDIS_URL
   ```

2. Test Redis connectivity manually
   ```bash
   redis-cli -u $REDIS_URL ping
   ```

3. Check Redis server status
   ```bash
   # If self-hosted
   systemctl status redis
   ```

4. Check network/firewall rules
   ```bash
   telnet redis-host 6379
   ```

**If `/api/health` returns `{"ok": false}`:**
1. Server is in production mode but Redis is unavailable
2. Check Redis connection as above
3. In emergency, can set `ALLOW_FALLBACK_IN_PRODUCTION=true` temporarily
   - ⚠️ This breaks multi-instance deployments
   - Only use for single-instance emergency recovery

---

## Health Check Response Details

### Success Response (200 OK)

**`/health`:**
```json
{
  "status": "ok",
  "instanceId": "server-abc123",
  "redis": "ready",
  "version": "0.1.0-party-fix",
  "configSource": "REDIS_URL",
  "uptimeSeconds": 3600
}
```

**`/api/health`:**
```json
{
  "ok": true,
  "status": "ready",
  "instanceId": "server-abc123",
  "redis": {
    "connected": true,
    "ping": "PONG",
    "latency": 5
  },
  "version": "0.1.0-party-fix",
  "uptimeSeconds": 3600
}
```

### Degraded Response (200 OK, but warnings)

**Development mode without Redis:**
```json
{
  "status": "ok",
  "instanceId": "server-abc123",
  "redis": "fallback",
  "version": "0.1.0-party-fix",
  "configSource": "fallback",
  "uptimeSeconds": 120
}
```

### Error Response

**Redis connection failed:**
```json
{
  "status": "ok",
  "instanceId": "server-abc123",
  "redis": "error",
  "redisError": "Connection timeout",
  "redisErrorType": "CONNECTION_TIMEOUT",
  "redisLastErrorAt": "2026-02-19T10:30:00.000Z",
  "version": "0.1.0-party-fix",
  "configSource": "REDIS_URL",
  "uptimeSeconds": 3600
}
```

**`/api/health` when not ready (production without Redis):**
```json
{
  "ok": false,
  "status": "not_ready",
  "instanceId": "server-abc123",
  "redis": {
    "connected": false,
    "error": "Connection refused"
  },
  "version": "0.1.0-party-fix",
  "uptimeSeconds": 60
}
```

---

## Best Practices

### 1. Health Check Frequency
- **Development:** Every 60 seconds
- **Staging:** Every 30 seconds
- **Production:** Every 10-30 seconds (depending on traffic)

### 2. Timeout Values
- **Liveness (`/health`):** 5 seconds
- **Readiness (`/api/health`):** 10 seconds

### 3. Failure Thresholds
- **Mark unhealthy after:** 3 consecutive failures
- **Mark healthy after:** 2 consecutive successes

### 4. Logging
- Don't log health check requests (creates noise)
- Do log health check failures
- Alert on sustained failures (> 5 minutes)

### 5. Monitoring
- Monitor health check response times
- Alert if response time > 1 second
- Track Redis connectivity metrics
- Monitor instance uptime

### 6. Multi-Instance Deployments
- Each instance has unique `instanceId`
- Health checks should succeed on all instances
- Load balancer removes unhealthy instances from pool
- Investigate if same instance repeatedly fails

---

## Security Considerations

### 1. No Sensitive Data
Health check endpoints return NO sensitive information:
- ✅ Instance ID (random, non-sensitive)
- ✅ Uptime (public information)
- ✅ Redis status (connection state only)
- ❌ NO database credentials
- ❌ NO API keys
- ❌ NO user data
- ❌ NO party information

### 2. No Authentication Required
Health checks are intentionally public:
- Enables external monitoring services
- Required for load balancer health checks
- No state changes (read-only)
- No resource access

### 3. Rate Limiting
Health check endpoints are NOT rate limited to allow:
- High-frequency health checks
- Load balancer probes
- Monitoring service requests

---

## Additional Resources

- **[docs/DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment guide
- **[docs/ENVIRONMENT.md](./ENVIRONMENT.md)** - Environment variable reference
- **[docs/API_REFERENCE.md](./API_REFERENCE.md)** - Full API documentation

---

**Last Updated:** February 19, 2026  
**Version:** 1.0  
**Maintained by:** DevOps Team
