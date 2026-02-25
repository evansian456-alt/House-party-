# Railway Deployment Guide

Complete guide for deploying Phone Party on Railway with all required services.

## Prerequisites

- Railway account (https://railway.app)
- GitHub repository with your code
- Basic understanding of environment variables

## Required Railway Services

Phone Party requires three Railway services:

1. **PostgreSQL** - User data, subscriptions, leaderboards
2. **Redis** - Party state, session management
3. **Storage Bucket** (or Cloudflare R2) - Audio file storage

## Step-by-Step Deployment

### 1. Create Railway Project

1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Select your repository
4. Railway will create a new project

### 2. Add PostgreSQL Database

1. In your Railway project, click "New Service"
2. Select "Database" → "Add PostgreSQL"
3. Railway automatically creates the database and sets `DATABASE_URL`

#### Initialize Database Schema

After deploying, run the schema initialization:

```bash
# Connect to your Railway database
psql $DATABASE_URL

# Or via Railway CLI
railway run psql $DATABASE_URL
```

Then run the SQL from `db/schema.sql`.

### 3. Add Redis

1. In your Railway project, click "New Service"
2. Select "Database" → "Add Redis"
3. Railway automatically creates Redis and sets `REDIS_URL`

### 4. Configure Storage (Choose One)

#### Option A: Railway Storage Buckets (Recommended)

1. In your Railway project, click "New Service"
2. Select "Add Railway Bucket"
3. Set environment variables in your app service:

```bash
S3_BUCKET=your-bucket-name
S3_ENDPOINT=https://s3.railway.app
S3_REGION=auto
S3_ACCESS_KEY_ID=<from-bucket-settings>
S3_SECRET_ACCESS_KEY=<from-bucket-settings>
S3_FORCE_PATH_STYLE=true
S3_PREFIX=tracks/
```

#### Option B: Cloudflare R2

1. Create R2 bucket at https://dash.cloudflare.com/r2
2. Generate API tokens (Read & Write access)
3. Set environment variables in Railway:

```bash
S3_BUCKET=your-r2-bucket-name
S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=<r2-access-key>
S3_SECRET_ACCESS_KEY=<r2-secret-key>
S3_FORCE_PATH_STYLE=true
S3_PREFIX=tracks/
```

### 5. Configure Environment Variables

In your Railway app service, set these required variables:

#### Required

```bash
NODE_ENV=production
PUBLIC_BASE_URL=https://your-app.up.railway.app
JWT_SECRET=<generate-secure-random-string>
```

To generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### Optional

```bash
# Error tracking
SENTRY_DSN=https://key@org.ingest.sentry.io/project

# Analytics
GA_MEASUREMENT_ID=G-XXXXXXXXXX

# CORS (if using custom domain)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Debug mode
DEBUG=false
```

#### Railway Auto-Set Variables

These are automatically set by Railway plugins:
- `DATABASE_URL` - From PostgreSQL plugin
- `REDIS_URL` - From Redis plugin
- `PORT` - Railway assigns dynamically
- `RAILWAY_ENVIRONMENT` - Set by Railway

### 6. Update PUBLIC_BASE_URL

After your app deploys, Railway assigns a domain like:
```
https://syncspeaker-prototype-production.up.railway.app
```

Update the `PUBLIC_BASE_URL` environment variable with this domain:

```bash
PUBLIC_BASE_URL=https://your-app.up.railway.app
```

**Important**: Don't include a trailing slash.

### 7. Deploy

Railway automatically deploys when you:
- Push to your GitHub repo (if GitHub integration enabled)
- Or click "Deploy" in Railway dashboard

### 8. Custom Domain (Optional)

To use your own domain:

1. In Railway project, go to Settings → Domains
2. Click "Add Domain"
3. Add your domain (e.g., `phoneparty.example.com`)
4. Configure DNS with the CNAME record Railway provides
5. Update `PUBLIC_BASE_URL` to your custom domain:

```bash
PUBLIC_BASE_URL=https://phoneparty.example.com
```

6. Add domain to CORS if needed:

```bash
CORS_ORIGINS=https://phoneparty.example.com
```

## Verification Checklist

After deployment, verify everything works:

### 1. Check Health Endpoint

```bash
curl https://your-app.up.railway.app/health
```

Should return:
```json
{
  "status": "healthy",
  "uptime": ...,
  "redis": { "status": "connected" },
  "database": { "status": "connected" }
}
```

### 2. Test Audio Upload

1. Open your app in browser
2. Create a party (host)
3. Select an audio file
4. **Wait for upload to complete** (status shows "Ready")
5. Join from another browser/device (guest)
6. Press Play on host
7. **Verify guest hears audio in sync**

### 3. Check Railway Logs

Watch for any errors:

```bash
# Via Railway CLI
railway logs

# Or in Railway dashboard
Project → Your Service → Logs
```

Look for:
- ✅ "Storage provider ready"
- ✅ "Redis connected"
- ✅ "PostgreSQL connected"
- ❌ Any configuration errors

## Troubleshooting

### "Storage service not available"

**Cause**: S3 storage not configured or credentials invalid.

**Fix**:
1. Verify all S3 environment variables are set correctly
2. Check bucket exists and credentials have read/write access
3. For Railway Buckets, ensure bucket is in same project
4. Check Railway logs for storage initialization errors

### "Track not found" after upload

**Cause**: PUBLIC_BASE_URL mismatch or storage issue.

**Fix**:
1. Verify `PUBLIC_BASE_URL` matches your Railway domain exactly
2. Check storage logs for upload success
3. Test storage directly:
   ```bash
   # Should show uploaded tracks
   railway run node -e "require('./storage').initStorage().then(p => p.getMetadata('TEST'))"
   ```

### "Party not found" or guests can't join

**Cause**: Redis not connected or configuration issue.

**Fix**:
1. Check `REDIS_URL` is set by Railway Redis plugin
2. Verify Redis service is running in Railway dashboard
3. Check `/health` endpoint shows Redis connected
4. Restart app service if Redis was added after initial deploy

### Mixed content errors (HTTP vs HTTPS)

**Cause**: PUBLIC_BASE_URL not set or incorrect.

**Fix**:
1. Ensure `PUBLIC_BASE_URL` starts with `https://` (not `http://`)
2. Verify domain matches Railway-assigned domain
3. Clear browser cache after fixing

### Authentication errors

**Cause**: JWT_SECRET not set or using default value.

**Fix**:
1. Generate secure random string:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. Set as `JWT_SECRET` environment variable
3. Restart app service

## Scaling Considerations

### Horizontal Scaling

Railway supports multiple instances. With S3 storage and Redis, the app is ready for horizontal scaling:

1. In Railway, go to Settings → Scaling
2. Increase replicas as needed
3. All instances share:
   - Redis (party state)
   - PostgreSQL (user data)
   - S3 Storage (audio files)

### Database Connections

If scaling to many instances, consider:

```bash
# Increase PostgreSQL connection pool
DB_MAX_CONNECTIONS=20  # Default is 10
```

### Cost Optimization

- **Storage**: Enable lifecycle policies in S3/R2 to auto-delete old tracks
- **Redis**: Use Railway Redis (more cost-effective than external)
- **Database**: Start with Railway's smallest plan, scale as needed

## Monitoring

### Built-in Monitoring

Check `/health` endpoint for system status:

```bash
curl https://your-app.up.railway.app/health
```

### Railway Metrics

Railway provides:
- CPU usage
- Memory usage  
- Network traffic
- Request logs

Access via Railway dashboard → Metrics

### External Monitoring (Recommended)

Set up external monitoring for production:

1. **Sentry** for error tracking:
   ```bash
   SENTRY_DSN=https://key@org.ingest.sentry.io/project
   ```

2. **Uptime monitoring** (UptimeRobot, Pingdom, etc.):
   - Monitor `/health` endpoint
   - Alert on 5xx errors

## Backup & Recovery

### Database Backups

Railway PostgreSQL includes automatic backups. To manually backup:

```bash
# Via Railway CLI
railway run pg_dump $DATABASE_URL > backup.sql
```

### Restore from Backup

```bash
railway run psql $DATABASE_URL < backup.sql
```

### Storage Backups

S3/R2 buckets should have versioning enabled:

**Railway Buckets**: Contact Railway support for versioning
**Cloudflare R2**: Enable in R2 dashboard → Bucket Settings

## Environment Variables Summary

### Required in Production

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PUBLIC_BASE_URL` | Your Railway domain | `https://your-app.up.railway.app` |
| `JWT_SECRET` | Secure random string | (64-char hex) |
| `S3_BUCKET` | Storage bucket name | `phoneparty-tracks` |
| `S3_ACCESS_KEY_ID` | Storage access key | (from bucket settings) |
| `S3_SECRET_ACCESS_KEY` | Storage secret key | (from bucket settings) |
| `S3_ENDPOINT` | Storage endpoint URL | `https://s3.railway.app` |

### Auto-Set by Railway

| Variable | Set By | Description |
|----------|--------|-------------|
| `DATABASE_URL` | PostgreSQL plugin | Database connection string |
| `REDIS_URL` | Redis plugin | Redis connection string |
| `PORT` | Railway | HTTP server port |
| `RAILWAY_ENVIRONMENT` | Railway | Deployment environment |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `S3_REGION` | AWS region | `auto` |
| `S3_FORCE_PATH_STYLE` | Path-style URLs | `true` |
| `S3_PREFIX` | Folder prefix | `tracks/` |
| `CORS_ORIGINS` | Allowed origins | (same-origin) |
| `SENTRY_DSN` | Error tracking | (none) |
| `DEBUG` | Verbose logging | `false` |

## Next Steps

- [ENVIRONMENT.md](./ENVIRONMENT.md) - Detailed environment variable documentation
- [AUDIO_SYNC_VALIDATION.md](./AUDIO_SYNC_VALIDATION.md) - Audio sync testing guide
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - General deployment guide

## Support

For Railway-specific issues:
- Railway Discord: https://discord.gg/railway
- Railway Docs: https://docs.railway.app

For app-specific issues:
- Check GitHub Issues
- Review server logs in Railway dashboard
