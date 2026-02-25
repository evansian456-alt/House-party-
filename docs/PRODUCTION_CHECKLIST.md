# Production Readiness Checklist

**Complete pre-launch checklist for deploying Phone Party to production**

Use this checklist to ensure your production deployment is secure, reliable, and ready for users.

---

## Pre-Deployment Checklist

### 🔐 Security

- [ ] **JWT_SECRET generated securely**
  ```bash
  openssl rand -base64 48
  ```
  - Minimum 32 characters
  - NOT using default: `syncspeaker-no-auth-mode`
  - NOT using dev defaults: `dev-secret-not-for-production`

- [ ] **NODE_ENV set to production**
  ```bash
  export NODE_ENV=production
  ```

- [ ] **HTTPS/TLS enabled**
  - SSL certificates installed
  - HTTP redirects to HTTPS
  - HSTS headers configured

- [ ] **Database credentials secured**
  - Strong password (not default)
  - SSL/TLS enabled for connection
  - Stored in environment variables or secrets manager

- [ ] **Redis credentials secured**
  - Password authentication enabled
  - TLS enabled (rediss://)
  - `REDIS_TLS_REJECT_UNAUTHORIZED=true` (if using proper certs)

- [ ] **Secrets management**
  - No secrets in code
  - No secrets in .env committed to git
  - Using platform secrets or secrets manager

- [ ] **Rate limiting configured**
  - Auth endpoints rate limited
  - Consider API-wide rate limiting

- [ ] **CORS configured**
  - Not using wildcard `*` in production
  - Specific origins whitelisted

- [ ] **Cookie security enabled**
  - `httpOnly: true`
  - `secure: true` (in production)
  - `sameSite: 'lax'` or 'strict'

---

### 🗄️ Database

- [ ] **PostgreSQL 12+ running**
  - Version: `psql --version`

- [ ] **Database created**
  ```bash
  createdb phoneparty
  ```

- [ ] **Schema applied**
  ```bash
  psql $DATABASE_URL -f db/schema.sql
  ```

- [ ] **Migrations applied**
  ```bash
  psql $DATABASE_URL -f db/migrations/001_add_performance_indexes.sql
  ```

- [ ] **Backups configured**
  - Automated daily backups
  - Backup retention policy set
  - Restore tested successfully

- [ ] **Connection pooling configured**
  - Default max connections: 20
  - Monitor connection usage

- [ ] **Database credentials secured**
  - Using DATABASE_URL environment variable
  - SSL enabled

---

### 📮 Redis

- [ ] **Redis 6+ running**
  - Version: `redis-cli --version`

- [ ] **Redis accessible**
  ```bash
  redis-cli -u $REDIS_URL ping
  # Should return: PONG
  ```

- [ ] **Authentication enabled**
  - Password set
  - Not using default/no password

- [ ] **TLS enabled**
  - Using `rediss://` URL (note double 's')
  - Certificate validation configured

- [ ] **Persistence enabled**
  - RDB or AOF enabled
  - Save frequency configured

- [ ] **Memory limit set**
  - Appropriate for workload
  - Eviction policy configured

---

### 🚀 Application

- [ ] **Node.js 18+ installed**
  ```bash
  node --version
  # Should be: v18.x.x or higher
  ```

- [ ] **Dependencies installed**
  ```bash
  npm ci --only=production
  ```

- [ ] **Environment validation passes**
  ```bash
  node -e "require('./env-validator').validateAndFailFast()"
  # Should exit 0 with "✅ VALIDATION PASSED"
  ```

- [ ] **Health check responds**
  ```bash
  curl http://localhost:8080/health
  # Should return: {"status":"ok","redis":"ready",...}
  ```

- [ ] **WebSocket connection works**
  - Test with browser
  - Check for upgrade headers

- [ ] **Process manager configured**
  - PM2, systemd, or container orchestration
  - Auto-restart on failure
  - Starts on system boot

---

### 📊 Monitoring

- [ ] **Error tracking configured**
  - Sentry DSN set: `SENTRY_DSN`
  - Errors reporting correctly

- [ ] **Uptime monitoring configured**
  - UptimeRobot, Pingdom, or similar
  - Monitoring `/health` endpoint
  - Alert contacts configured

- [ ] **Log aggregation configured**
  - CloudWatch, Datadog, or similar
  - Logs searchable
  - Log retention policy set

- [ ] **Metrics collection**
  - Response times
  - Error rates
  - Redis connectivity
  - Database connections

---

### 🌐 Infrastructure

- [ ] **Domain configured**
  - DNS points to server
  - SSL certificate valid

- [ ] **Reverse proxy configured**
  - NGINX, Traefik, or platform load balancer
  - WebSocket upgrade headers set
  - Timeouts configured (3600s for WebSockets)

- [ ] **Firewall configured**
  - Port 443 (HTTPS) open
  - Port 80 (HTTP) open (redirects to 443)
  - Database/Redis ports restricted

- [ ] **Load balancing configured** (if multi-instance)
  - Sticky sessions enabled (recommended)
  - Health checks enabled
  - Multiple instances running

---

## Deployment Steps

### Step 1: Verify Environment

```bash
# Test environment validation
NODE_ENV=production \
REDIS_URL=$REDIS_URL \
DATABASE_URL=$DATABASE_URL \
JWT_SECRET=$JWT_SECRET \
node -e "require('./env-validator').validateAndFailFast()"
```

**Expected output:**
```
✅ VALIDATION PASSED - All required variables configured
```

### Step 2: Deploy Application

**Option A: Direct Deployment**
```bash
npm ci --only=production
pm2 start server.js --name phoneparty -i max
pm2 save
```

**Option B: Docker**
```bash
docker build -t phoneparty:latest .
docker run -d --name phoneparty \
  -p 8080:8080 \
  --env-file .env.production \
  --restart unless-stopped \
  phoneparty:latest
```

**Option C: Platform (Railway, Heroku, etc.)**
```bash
# Follow platform-specific deployment guide
railway up
# or
git push heroku main
```

### Step 3: Verify Deployment

```bash
# 1. Check health endpoint
curl https://your-domain.com/health

# Expected: {"status":"ok","redis":"ready",...}

# 2. Check detailed health
curl https://your-domain.com/api/health

# Expected: {"ok":true,"status":"ready",...}

# 3. Test WebSocket connection
# Open browser console and test WebSocket connection

# 4. Create test party
curl -X POST https://your-domain.com/api/create-party

# Expected: {"partyCode":"ABC123","hostId":...}
```

### Step 4: Monitor Initial Traffic

```bash
# Watch logs for first 30 minutes
pm2 logs phoneparty --lines 100

# or
docker logs -f phoneparty

# or
railway logs
```

**Watch for:**
- No error spikes
- Normal response times
- Redis stays connected
- No database connection errors

---

## Post-Deployment Checklist

### ✅ Smoke Tests

- [ ] **Homepage loads**
  - Visit https://your-domain.com
  - No 500 errors
  - Assets load correctly

- [ ] **Create party works**
  - Host creates party
  - Party code displayed
  - No errors in console

- [ ] **Join party works**
  - Guest enters party code
  - Joins successfully
  - Host sees guest count update

- [ ] **Multi-device sync works**
  - Test with 2+ devices
  - Parties sync via Redis
  - No delays > 3 seconds

- [ ] **WebSocket connection works**
  - Real-time updates
  - No connection drops
  - Reconnects after interruption

- [ ] **Authentication works** (if enabled)
  - User can sign up
  - User can log in
  - JWT tokens issued correctly

---

### 📈 Performance Verification

- [ ] **Response times acceptable**
  - Health check: < 100ms
  - Create party: < 500ms
  - Join party: < 500ms
  - API endpoints: < 1s

- [ ] **Resource usage normal**
  - CPU < 70% average
  - Memory < 80% of allocated
  - No memory leaks over time

- [ ] **Database performance**
  - Query times < 100ms average
  - No slow query warnings
  - Connection pool healthy

- [ ] **Redis performance**
  - Ping latency < 10ms
  - No connection timeouts
  - Memory usage stable

---

### 🔒 Security Verification

- [ ] **HTTPS working**
  - No mixed content warnings
  - Certificate valid
  - TLS 1.2+ enabled

- [ ] **Security headers present**
  ```bash
  curl -I https://your-domain.com
  ```
  - X-Frame-Options
  - X-Content-Type-Options
  - Strict-Transport-Security

- [ ] **No secrets exposed**
  - Check browser network tab
  - Check API responses
  - Check error messages

- [ ] **Rate limiting working**
  - Test auth endpoints
  - Should block after threshold

---

## Rollback Plan

### If Deployment Fails

**Immediate actions:**

1. **Revert to previous version**
   ```bash
   # PM2
   pm2 reload phoneparty --update-env
   
   # Docker
   docker stop phoneparty
   docker run -d --name phoneparty phoneparty:previous-tag
   
   # Platform
   railway rollback
   ```

2. **Check logs for root cause**
   ```bash
   pm2 logs phoneparty --err --lines 500
   ```

3. **Verify rollback successful**
   ```bash
   curl https://your-domain.com/health
   ```

4. **Notify team**
   - Post in team chat
   - Update status page

5. **Document issue**
   - What failed
   - Error messages
   - Steps taken

### Common Issues & Fixes

**Issue: Environment validation fails**
```bash
# Fix: Verify all required variables are set
node -e "require('./env-validator').validateAndFailFast()"
```

**Issue: Redis connection fails**
```bash
# Fix: Check REDIS_URL and Redis server status
echo $REDIS_URL
redis-cli -u $REDIS_URL ping
```

**Issue: Database connection fails**
```bash
# Fix: Check DATABASE_URL and database server status
echo $DATABASE_URL
psql $DATABASE_URL -c "SELECT 1"
```

**Issue: WebSocket connections fail**
```bash
# Fix: Check reverse proxy configuration
# Ensure Upgrade and Connection headers are set
```

---

## Monitoring & Logging

### What to Monitor

**Application Metrics:**
- Request rate
- Response times (p50, p95, p99)
- Error rate
- Active WebSocket connections

**Infrastructure Metrics:**
- CPU usage
- Memory usage
- Disk usage
- Network traffic

**Service Health:**
- Redis connectivity
- Database connectivity
- External API availability

**Business Metrics:**
- Active parties
- Active users
- Party creation rate
- Join success rate

### Alert Thresholds

**Critical (Page immediately):**
- Health check fails for > 5 minutes
- Error rate > 10% for > 5 minutes
- Redis disconnected for > 2 minutes
- Database disconnected for > 2 minutes

**Warning (Notify during business hours):**
- Response time p95 > 2 seconds
- Memory usage > 80%
- CPU usage > 80% sustained
- Error rate > 5%

### Log Monitoring

**Watch for these patterns:**
```bash
# Critical errors
grep -i "critical\|fatal" logs.txt

# Authentication issues
grep -i "authentication.*disabled" logs.txt

# Database errors
grep -i "database.*error\|connection.*failed" logs.txt

# Redis errors
grep -i "redis.*error\|redis.*disconnected" logs.txt
```

---

## Regular Maintenance

### Daily
- [ ] Check health endpoints
- [ ] Review error logs
- [ ] Check resource usage
- [ ] Verify backups completed

### Weekly
- [ ] Review performance metrics
- [ ] Check for security updates
- [ ] Test backup restore
- [ ] Review alert history

### Monthly
- [ ] Update dependencies
- [ ] Review and rotate secrets
- [ ] Database maintenance (VACUUM, ANALYZE)
- [ ] Review and optimize slow queries
- [ ] Test disaster recovery

---

## Additional Resources

- **[docs/ENVIRONMENT.md](./ENVIRONMENT.md)** - Environment variables reference
- **[docs/DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment guide
- **[docs/HEALTH_CHECKS.md](./HEALTH_CHECKS.md)** - Health check documentation
- **[docs/DOCKER.md](./DOCKER.md)** - Docker deployment guide
- **[README.md](../README.md)** - Project overview

---

## Final Pre-Launch Checklist

Review this final checklist before going live:

- [ ] All security requirements met
- [ ] All infrastructure configured
- [ ] Monitoring and alerting active
- [ ] Team trained on deployment process
- [ ] Rollback plan tested
- [ ] Backup and restore tested
- [ ] Load testing completed (if high traffic expected)
- [ ] Smoke tests passed
- [ ] Performance acceptable
- [ ] Documentation up to date
- [ ] Support contact information available
- [ ] Incident response plan ready

---

**🎉 Ready to launch!**

Once all items are checked, you're ready to deploy to production.

---

**Last Updated:** February 19, 2026  
**Version:** 1.0  
**Maintained by:** DevOps Team
