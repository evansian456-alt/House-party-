# Production Deployment Guide

**Step-by-step guide to deploying Phone Party to production**

This guide walks you through deploying Phone Party to a production environment with proper security, monitoring, and performance configurations.

---

## 📋 Pre-Deployment Checklist

Before deploying to production, ensure you've completed these critical items:

### Security ✅
- [ ] Set strong `JWT_SECRET` environment variable (min 32 characters, random)
- [ ] Enable HTTPS/TLS for all connections
- [ ] Set `NODE_ENV=production`
- [ ] Configure `REDIS_REJECT_UNAUTHORIZED=true` (do NOT disable TLS validation)
- [ ] Review and test rate limiting configuration
- [ ] Enable secure cookies (`secure: true` in production)
- [ ] Disable test mode (`TEST_MODE=false`)

### Database ✅
- [ ] PostgreSQL database created and accessible
- [ ] Run `db/schema.sql` to create tables
- [ ] Run `db/migrations/*.sql` to add indexes
- [ ] Database credentials stored securely (environment variables)
- [ ] Database backups configured

### Redis ✅
- [ ] Redis instance accessible
- [ ] Redis password set (if applicable)
- [ ] Redis connection URL in `REDIS_URL` environment variable
- [ ] TLS enabled for Redis connections
- [ ] Redis persistence configured (RDB or AOF)

### Monitoring ✅
- [ ] Error tracking service configured (e.g., Sentry)
- [ ] Analytics configured (e.g., Google Analytics)
- [ ] Uptime monitoring configured (e.g., UptimeRobot)
- [ ] Log aggregation configured (e.g., CloudWatch, Datadog)

---

## 🚀 Deployment Steps

### Step 1: Environment Configuration

Create a `.env` file or configure environment variables:

```bash
# Server Configuration
NODE_ENV=production
PORT=8080

# Security
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-random
TEST_MODE=false

# Database (PostgreSQL)
PGHOST=your-db-host.example.com
PGPORT=5432
PGDATABASE=phoneparty
PGUSER=phoneparty_user
PGPASSWORD=secure-database-password

# Redis
REDIS_URL=rediss://your-redis-host.example.com:6379
REDIS_REJECT_UNAUTHORIZED=true

# Optional: Payment Integration
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional: Monitoring
SENTRY_DSN=https://...@sentry.io/...
GA_TRACKING_ID=G-...
```

### Step 2: Install Dependencies

```bash
npm ci --production
```

**Note**: Use `npm ci` instead of `npm install` for faster, reproducible builds.

### Step 3: Database Setup

```bash
# Create database tables
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f db/schema.sql

# Apply performance indexes
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f db/migrations/001_add_performance_indexes.sql
```

### Step 4: Start the Server

```bash
# Option 1: Direct start
node server.js

# Option 2: Process manager (recommended)
pm2 start server.js --name phone-party

# Option 3: Docker
docker run -p 8080:8080 --env-file .env phone-party
```

### Step 5: Verify Deployment

Test these critical endpoints:

```bash
# Health check
curl https://your-domain.com/

# API availability
curl https://your-domain.com/api/health

# WebSocket availability (requires browser or wscat)
wscat -c wss://your-domain.com
```

---

## 🐳 Docker Deployment

### Dockerfile

```dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --production

# Copy application files
COPY . .

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "require('http').get('http://localhost:8080/', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
CMD ["node", "server.js"]
```

### Build and Run

```bash
# Build image
docker build -t phone-party:latest .

# Run container
docker run -d \
  --name phone-party \
  -p 8080:8080 \
  --env-file .env \
  --restart unless-stopped \
  phone-party:latest
```

---

## ☁️ Cloud Platform Deployment

### Railway

See **[RAILWAY_DEPLOYMENT.md](../RAILWAY_DEPLOYMENT.md)** for detailed Railway deployment instructions.

Quick start:
```bash
railway login
railway init
railway up
```

### Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Add Redis
heroku addons:create heroku-redis:mini

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret-key

# Deploy
git push heroku main
```

### AWS (EC2 + RDS + ElastiCache)

1. **Launch EC2 Instance** (t3.small or larger)
2. **Create RDS PostgreSQL Database**
3. **Create ElastiCache Redis Cluster**
4. **Configure Security Groups** (allow ports 80, 443, 8080)
5. **Install Node.js and dependencies**
6. **Use PM2 for process management**
7. **Configure NGINX as reverse proxy**
8. **Set up SSL with Let's Encrypt**

---

## 🔧 Process Management (PM2)

### Install PM2

```bash
npm install -g pm2
```

### Start Application

```bash
pm2 start server.js --name phone-party
```

### Configure for Auto-Restart

```bash
# Save PM2 process list
pm2 save

# Enable PM2 to start on boot
pm2 startup
# Follow the instructions provided by the command
```

### Monitor Application

```bash
# View logs
pm2 logs phone-party

# View status
pm2 status

# Restart application
pm2 restart phone-party

# Stop application
pm2 stop phone-party
```

---

## 🔒 SSL/TLS Configuration

### Option 1: Let's Encrypt (Free)

```bash
# Install Certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d your-domain.com

# Certificates saved to:
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem
```

### Option 2: NGINX Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 📊 Monitoring & Logging

### Error Tracking (Sentry)

```bash
npm install @sentry/node
```

In `server.js`:
```javascript
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});
```

### Analytics (Google Analytics 4)

Add GA4 tracking ID to environment variables and initialize in client-side code.

### Uptime Monitoring

Configure uptime monitoring with services like:
- **UptimeRobot** (free, 50 monitors)
- **Pingdom** (paid, advanced features)
- **StatusCake** (free tier available)

Monitor these endpoints:
- `https://your-domain.com/` (HTTP 200)
- `https://your-domain.com/api/health` (if implemented)

---

## 🔄 CI/CD Pipeline

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Deploy to Railway
        run: |
          npm install -g @railway/cli
          railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

---

## 📈 Performance Optimization

### Enable Gzip Compression

```javascript
const compression = require('compression');
app.use(compression());
```

### Serve Static Files Efficiently

```javascript
app.use(express.static('public', {
  maxAge: '1d',
  etag: true
}));
```

### Database Connection Pooling

Already configured in `database.js` with `max: 20` connections.

---

## 🧪 Post-Deployment Testing

### Smoke Tests

- [ ] Homepage loads successfully
- [ ] User can create account
- [ ] User can log in
- [ ] User can create party
- [ ] User can join party
- [ ] WebSocket connection works
- [ ] Audio playback works
- [ ] Multi-device sync works

### Load Testing

```bash
# Install artillery
npm install -g artillery

# Run load test
artillery quick --count 10 --num 100 https://your-domain.com
```

---

## 🚨 Troubleshooting

### Common Issues

**WebSocket connection fails**
- Check firewall allows WebSocket connections
- Verify NGINX upgrade headers configured correctly
- Check browser console for errors

**Database connection fails**
- Verify `PGHOST`, `PGUSER`, `PGPASSWORD` are correct
- Check database allows remote connections
- Verify SSL/TLS settings

**Redis connection fails**
- Verify `REDIS_URL` is correct
- Check Redis instance is accessible
- Verify TLS settings

---

## 📚 Additional Resources

- **[DEPLOYMENT_READINESS_CHECKLIST.md](../DEPLOYMENT_READINESS_CHECKLIST.md)** - Complete pre-launch checklist
- **[RAILWAY_DEPLOYMENT.md](../RAILWAY_DEPLOYMENT.md)** - Railway-specific deployment guide
- **[MISSING_FEATURES.md](../MISSING_FEATURES.md)** - Features to add before production

---

**Last Updated**: February 16, 2026  
**Status**: Production deployment guide  
**Audience**: DevOps, system administrators
