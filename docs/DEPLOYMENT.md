# Production Deployment Guide (Enhanced)

**Comprehensive guide for deploying Phone Party to production with operational best practices**

This guide provides detailed, platform-agnostic instructions for deploying Phone Party to production. For quick platform-specific examples, see the [Platform Examples](#platform-examples) section.

**Prerequisites:**
- Basic understanding of Node.js deployment
- Access to PostgreSQL 12+ and Redis 6+ instances
- SSL/TLS certificates for production domain

---

## Table of Contents

1. [Quick Start (Local Development)](#1-quick-start-local-development)
2. [Production Deployment (Generic Node Hosting)](#2-production-deployment-generic-node-hosting)
3. [Database & Migrations](#3-database--migrations)
4. [Redis Configuration](#4-redis-configuration)
5. [WebSockets Behind Proxies](#5-websockets-behind-proxies)
6. [Security Checklist](#6-security-checklist)
7. [Operational Checklist](#7-operational-checklist)
8. [Platform Examples](#8-platform-examples)

---

## 1. Quick Start (Local Development)

### Prerequisites
```bash
# Required software
- Node.js 18+ (LTS recommended)
- PostgreSQL 12+
- Redis 6+
- Git
```

### Installation
```bash
# Clone repository
git clone https://github.com/evansian456-alt/syncspeaker-prototype.git
cd syncspeaker-prototype

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Setup Environment
Edit `.env` with your local configuration:
```bash
NODE_ENV=development
DATABASE_URL=postgresql://localhost:5432/phoneparty
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=dev-secret-not-for-production
```

### Initialize Database
```bash
# Create database
createdb phoneparty

# Apply schema
psql -d phoneparty -f db/schema.sql

# Apply migrations
psql -d phoneparty -f db/migrations/001_add_performance_indexes.sql
```

### Start Server
```bash
# Development mode (with auto-reload if using nodemon)
npm run dev

# Or standard start
npm start
```

Server will start on `http://localhost:8080`

### Run Tests
```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# With coverage
npm run test:coverage
```

---

## 2. Production Deployment (Generic Node Hosting)

### A) Required Environment Variables

**See `docs/ENVIRONMENT.md` for complete documentation.**

Minimum production configuration:
```bash
# Environment
NODE_ENV=production

# Redis (REQUIRED - app will not start without this)
REDIS_URL=rediss://default:password@redis.example.com:6379
REDIS_TLS_REJECT_UNAUTHORIZED=true

# Database (REQUIRED)
DATABASE_URL=postgresql://user:pass@db.example.com:5432/phoneparty

# Security (STRONGLY RECOMMENDED - auth disabled without this)
JWT_SECRET=<secure-random-48-char-string>

# Generate secure JWT secret:
openssl rand -base64 48
```

### B) Recommended Production Settings

```bash
# Environment
NODE_ENV=production
PORT=8080

# Redis with TLS
REDIS_URL=rediss://default:password@redis.example.com:6379
REDIS_TLS_REJECT_UNAUTHORIZED=true

# Database with SSL
DATABASE_URL=postgresql://user:pass@db.example.com:5432/phoneparty?sslmode=require

# Security
JWT_SECRET=<generated-with-openssl-rand-base64-48>

# Monitoring (recommended)
SENTRY_DSN=https://key@org.ingest.sentry.io/project

# Feature flags
ENABLE_PUBSUB=true  # Required for multi-instance
ENABLE_REACTION_HISTORY=true

# NEVER set these in production
# ALLOW_FALLBACK_IN_PRODUCTION=false  # Must stay false!
# DEBUG=false
# TEST_MODE=false
```

### C) Build/Run Steps

```bash
# Install production dependencies only
npm ci --production

# Verify environment configuration
node -e "require('./env-validator').validateAndFailFast()"

# Start with process manager (recommended)
pm2 start server.js --name phoneparty -i max

# OR start directly (not recommended for production)
node server.js
```

### D) Recommended Node Version

- **Node.js 18 LTS** (current recommendation)
- Node.js 20 LTS also supported
- Minimum: Node.js 14

Check version:
```bash
node --version  # Should be v18.x.x or higher
```

### E) Process Management

**PM2 (Recommended):**
```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start server.js --name phoneparty

# Or start in cluster mode (multiple instances)
pm2 start server.js --name phoneparty -i max

# Auto-restart on system reboot
pm2 startup
pm2 save

# Monitor
pm2 monit

# View logs
pm2 logs phoneparty

# Restart (zero-downtime with cluster mode)
pm2 reload phoneparty
```

**Systemd (Alternative):**
```ini
# /etc/systemd/system/phoneparty.service
[Unit]
Description=Phone Party Node.js Application
After=network.target

[Service]
Type=simple
User=phoneparty
WorkingDirectory=/opt/phoneparty
Environment=NODE_ENV=production
EnvironmentFile=/opt/phoneparty/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=phoneparty

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable phoneparty
sudo systemctl start phoneparty
sudo systemctl status phoneparty
```

---

## 3. Database & Migrations

### A) Initialize Schema (First Time)

**Local Development:**
```bash
createdb phoneparty
psql -d phoneparty -f db/schema.sql
```

**Production:**
```bash
# Using DATABASE_URL
psql $DATABASE_URL -f db/schema.sql

# Or with individual params
psql -h db.example.com -U phoneparty_user -d phoneparty -f db/schema.sql
```

### B) Apply Migrations

**Always test migrations on a staging environment first!**

```bash
# Check current schema version
psql $DATABASE_URL -c "SELECT * FROM schema_migrations;"

# Apply migration (with transaction)
psql $DATABASE_URL << EOF
BEGIN;
\i db/migrations/001_add_performance_indexes.sql
COMMIT;
EOF
```

**Migration Safety Checklist:**
- [ ] Test migration on staging/dev database first
- [ ] Backup database before migration
- [ ] Migrations are idempotent (can run multiple times)
- [ ] Use transactions for atomic migrations
- [ ] Monitor migration progress for large tables
- [ ] Have rollback plan ready

### C) Backup & Restore

**Backup:**
```bash
# Full database backup
pg_dump $DATABASE_URL > phoneparty_backup_$(date +%Y%m%d_%H%M%S).sql

# Schema only
pg_dump --schema-only $DATABASE_URL > phoneparty_schema.sql

# Data only
pg_dump --data-only $DATABASE_URL > phoneparty_data.sql
```

**Restore:**
```bash
# Restore from backup
psql $DATABASE_URL < phoneparty_backup_20260219_120000.sql

# Restore specific table
pg_restore -d phoneparty -t users phoneparty_backup.sql
```

**Automated Backups:**
- Set up daily automated backups via cron or platform tools
- Test restore process regularly
- Store backups in separate location from primary database
- Keep at least 30 days of backups
- Consider point-in-time recovery (PITR) for critical data

---

## 4. Redis Configuration

### A) Required Redis Settings

**Production Redis must have:**
- Persistence enabled (RDB or AOF)
- Password authentication
- TLS encryption (rediss://)
- Sufficient memory allocation
- Eviction policy configured

### B) TLS Configuration

**Always use TLS in production:**
```bash
# Correct: TLS enabled
REDIS_URL=rediss://default:password@redis.example.com:6379

# Wrong: No TLS
REDIS_URL=redis://default:password@redis.example.com:6379
```

**Certificate validation:**
```bash
# Strict validation (recommended for production with proper certs)
REDIS_TLS_REJECT_UNAUTHORIZED=true

# Relaxed validation (only for managed services with self-signed certs)
REDIS_TLS_REJECT_UNAUTHORIZED=false
```

### C) Redis Persistence

Choose persistence strategy based on needs:

**RDB (Snapshotting) - Good for:**
- Lower disk I/O
- Faster restarts
- Can tolerate losing recent data

**AOF (Append-Only File) - Good for:**
- Minimal data loss
- Higher durability
- Replay-based recovery

**Recommended for Phone Party: RDB with hourly saves**
```conf
# redis.conf
save 3600 1     # Save if at least 1 key changed in 3600 seconds
save 300 100    # Save if at least 100 keys changed in 300 seconds
save 60 10000   # Save if at least 10000 keys changed in 60 seconds
```

### D) Scaling with Multiple Instances

**Phone Party supports multi-instance deployments via Redis pub/sub.**

Requirements:
- All instances must connect to same Redis
- `ENABLE_PUBSUB=true` (default)
- Same `DATABASE_URL` for all instances
- Load balancer with sticky sessions (see WebSockets section)

**Instance configuration:**
```bash
# Each instance uses same Redis
REDIS_URL=rediss://same-redis-for-all-instances:6379

# Feature flag must be enabled
ENABLE_PUBSUB=true
```

---

## 5. WebSockets Behind Proxies

### A) Reverse Proxy Configuration

**Phone Party uses WebSockets for real-time communication.**

Key requirements:
- HTTP Upgrade header support
- Connection header forwarding
- Increased timeout values
- Optional: Sticky sessions

### B) NGINX Configuration

```nginx
upstream phoneparty_backend {
    # Multiple backend instances
    server 127.0.0.1:8080;
    server 127.0.0.1:8081;
    server 127.0.0.1:8082;
    
    # Sticky sessions based on IP (optional but recommended)
    ip_hash;
}

server {
    listen 443 ssl http2;
    server_name phoneparty.example.com;
    
    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/phoneparty.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/phoneparty.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Increased timeouts for WebSocket connections
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    
    location / {
        proxy_pass http://phoneparty_backend;
        proxy_http_version 1.1;
        
        # WebSocket upgrade headers (REQUIRED)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Disable buffering for real-time updates
        proxy_buffering off;
    }
}
```

### C) Traefik Configuration

```yaml
# docker-compose.yml
services:
  traefik:
    image: traefik:v2.10
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
    ports:
      - "80:80"
      - "443:443"
  
  phoneparty:
    image: phoneparty:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.phoneparty.rule=Host(`phoneparty.example.com`)"
      - "traefik.http.routers.phoneparty.entrypoints=websecure"
      - "traefik.http.services.phoneparty.loadbalancer.sticky.cookie=true"
```

### D) Sticky Sessions

**Do you need sticky sessions?**

Phone Party uses Redis for state synchronization, so sticky sessions are **optional but recommended** for:
- Reduced latency (same instance handles all client requests)
- Lower Redis traffic
- Simpler debugging

**Without sticky sessions:**
- Works fine due to Redis state sync
- Slightly higher latency
- More Redis pub/sub traffic
- Each request can hit different instance

**Implementing sticky sessions:**
- NGINX: `ip_hash` or `sticky cookie`
- HAProxy: `stick-table` or `cookie`
- AWS ALB: Enable stickiness with target group
- Traefik: `sticky.cookie=true`

### E) Timeout Configuration

Recommended timeouts:
```
Connection timeout: 60s
Read timeout: 3600s (1 hour for long WebSocket connections)
Send timeout: 3600s
Idle timeout: 300s (5 minutes)
```

---

## 6. Security Checklist

### A) Secrets Management

**Critical secrets to protect:**
- `JWT_SECRET` - Authentication token signing
- `DATABASE_URL` - Database credentials
- `REDIS_URL` - Redis credentials
- `STRIPE_SECRET_KEY` - Payment processing
- `STRIPE_WEBHOOK_SECRET` - Webhook validation

**Best practices:**
```bash
# ✅ DO: Use environment variables
export JWT_SECRET=$(openssl rand -base64 48)

# ✅ DO: Use secret management services
# - AWS Secrets Manager
# - HashiCorp Vault
# - Docker Secrets
# - Kubernetes Secrets

# ❌ DON'T: Hard-code secrets
const JWT_SECRET = 'my-secret-key';  // NEVER DO THIS

# ❌ DON'T: Commit .env files
# Add .env to .gitignore
```

### B) CORS Configuration

**Phone Party currently has permissive CORS (allow all origins).**

For production, restrict CORS:
```javascript
// In server.js, add CORS middleware
const cors = require('cors');

app.use(cors({
  origin: [
    'https://phoneparty.example.com',
    'https://www.phoneparty.example.com'
  ],
  credentials: true,
  optionsSuccessStatus: 200
}));
```

### C) Cookie Security

**Cookies are already configured securely:**
- `httpOnly: true` - Prevents JavaScript access
- `secure: true` (in production) - HTTPS only
- `sameSite: 'lax'` - CSRF protection

**Verify in production:**
```bash
curl -I https://phoneparty.example.com/api/auth/login
# Check Set-Cookie header includes:
# HttpOnly; Secure; SameSite=Lax
```

### D) Rate Limiting

**Rate limiting is implemented for auth endpoints.**

Current limits:
- Auth endpoints: 5 requests per 15 minutes per IP
- Can be adjusted in `auth-middleware.js`

**Monitor rate limit hits:**
```bash
# Check logs for rate limit events
pm2 logs phoneparty | grep "rate limit"
```

### E) Security Headers

**Add security headers via reverse proxy or Express:**
```nginx
# NGINX
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

Or in Express:
```javascript
const helmet = require('helmet');
app.use(helmet());
```

---

## 7. Operational Checklist

### A) Health Checks

**Endpoints available:**

**`GET /health`** - Basic health check
```bash
curl https://phoneparty.example.com/health
```

Response:
```json
{
  "status": "ok",
  "instanceId": "server-abc123",
  "redis": "ready",
  "version": "0.1.0-party-fix",
  "uptimeSeconds": 3600
}
```

**`GET /api/health`** - Detailed readiness check
- Performs active Redis ping
- Returns detailed diagnostics
- Use for load balancer health checks

**Load balancer configuration:**
```
Health check path: /health
Interval: 30 seconds
Timeout: 5 seconds
Healthy threshold: 2
Unhealthy threshold: 3
```

### B) Logging

**View logs:**
```bash
# PM2
pm2 logs phoneparty

# Systemd
journalctl -u phoneparty -f

# Docker
docker logs -f phoneparty
```

**Log levels:**
- Production: Minimal logging (errors, warnings, critical events)
- Development: Verbose logging (debug information)

**Log aggregation (recommended):**
- CloudWatch Logs (AWS)
- Datadog
- Splunk
- ELK Stack (Elasticsearch, Logstash, Kibana)

### C) Monitoring

**Key metrics to monitor:**
- Server uptime
- Response times
- Error rates
- Redis connectivity
- Database connection pool
- WebSocket connections
- Memory usage
- CPU usage

**Tools:**
- Sentry (error tracking)
- PM2 monitoring
- New Relic (APM)
- DataDog (infrastructure)
- Prometheus + Grafana (custom metrics)

### D) Common Issues & Troubleshooting

**Issue: "Production environment validation failed"**
```
Cause: Missing required environment variables
Solution: Check env-validator output, set missing variables
Command: node -e "require('./env-validator').validateAndFailFast()"
```

**Issue: WebSocket connections fail**
```
Cause: Missing Upgrade headers in proxy
Solution: Configure proxy for WebSocket support (see section 5)
Check: Browser console for WebSocket errors
```

**Issue: Multi-device sync not working**
```
Cause: Redis not connected or ENABLE_PUBSUB=false
Solution: Check /health endpoint, verify REDIS_URL
Verify: curl https://phoneparty.example.com/health
        Check redis field shows "ready"
```

**Issue: Authentication not working**
```
Cause: JWT_SECRET not set or using default
Solution: Generate secure JWT_SECRET with openssl
Check: Server logs for "Authentication is DISABLED" warning
```

**Issue: Database connection errors**
```
Cause: DATABASE_URL incorrect or database not accessible
Solution: Test connection: psql $DATABASE_URL
Check: Network access, firewall rules, SSL settings
```

---

## 8. Platform Examples

### A) Railway

See **[RAILWAY_DEPLOYMENT.md](../RAILWAY_DEPLOYMENT.md)** for complete Railway guide.

Quick start:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy
railway up
```

### B) Heroku

```bash
# Create app
heroku create phoneparty

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Add Redis
heroku addons:create heroku-redis:mini

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -base64 48)

# Deploy
git push heroku main

# Check logs
heroku logs --tail
```

### C) AWS (EC2 + RDS + ElastiCache)

**Setup overview:**
1. Launch EC2 instance (t3.small or larger)
2. Create RDS PostgreSQL instance
3. Create ElastiCache Redis cluster
4. Configure security groups
5. Install Node.js and application
6. Configure NGINX reverse proxy
7. Set up SSL with Let's Encrypt
8. Use PM2 for process management

**Detailed AWS setup:** See separate AWS deployment guide

### D) DigitalOcean

```bash
# Create Droplet (Ubuntu 22.04)
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL and Redis
sudo apt-get install -y postgresql redis-server

# Clone and setup application
git clone https://github.com/evansian456-alt/syncspeaker-prototype.git
cd syncspeaker-prototype
npm ci --production

# Configure environment
sudo nano /opt/phoneparty/.env

# Install PM2 and start
sudo npm install -g pm2
pm2 start server.js --name phoneparty
pm2 startup
pm2 save
```

### E) Docker (Generic)

See [Phase 4: Containerization](#phase-4) for Dockerfile and docker-compose.yml

---

## Additional Resources

- **[docs/ENVIRONMENT.md](./ENVIRONMENT.md)** - Complete environment variable reference
- **[docs/API_REFERENCE.md](./API_REFERENCE.md)** - API documentation
- **[README.md](../README.md)** - Project overview and quick start
- **[RAILWAY_DEPLOYMENT.md](../RAILWAY_DEPLOYMENT.md)** - Railway-specific guide

---

**Last Updated:** February 19, 2026  
**Version:** 2.0 (Enhanced)  
**Maintained by:** DevOps Team
