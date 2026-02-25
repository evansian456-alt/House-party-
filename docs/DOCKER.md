# Docker Deployment Guide

**Complete guide for running Phone Party in Docker containers**

This guide covers both local development with Docker Compose and production Docker deployment.

---

## Quick Start (Docker Compose)

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+

### Start All Services
```bash
# Start PostgreSQL, Redis, and Phone Party
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (deletes data!)
docker-compose down -v
```

### Access Services
- **Application:** http://localhost:8080
- **PostgreSQL:** localhost:5432
- **Redis:** localhost:6379

---

## Production Docker Deployment

### Build Image
```bash
# Build production image
docker build -t phoneparty:latest .

# Build with specific version
docker build -t phoneparty:1.0.0 .

# Build with build args (if needed)
docker build --build-arg NODE_ENV=production -t phoneparty:latest .
```

### Run Container
```bash
# Run with environment variables
docker run -d \
  --name phoneparty \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e REDIS_URL=rediss://redis.example.com:6379 \
  -e DATABASE_URL=postgresql://user:pass@db.example.com:5432/phoneparty \
  -e JWT_SECRET=your-secure-random-secret \
  --restart unless-stopped \
  phoneparty:latest

# Run with env file
docker run -d \
  --name phoneparty \
  -p 8080:8080 \
  --env-file .env.production \
  --restart unless-stopped \
  phoneparty:latest
```

### View Logs
```bash
# Follow logs
docker logs -f phoneparty

# Last 100 lines
docker logs --tail 100 phoneparty

# With timestamps
docker logs -t phoneparty
```

### Health Check
```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' phoneparty

# Manual health check
docker exec phoneparty curl -f http://localhost:8080/health
```

---

## Docker Compose (Development)

### Configuration

**docker-compose.yml includes:**
- PostgreSQL 14 (with schema auto-init)
- Redis 7 (with persistence)
- Phone Party app (with volume mount for development)

### Commands
```bash
# Start in foreground (see logs)
docker-compose up

# Start in background
docker-compose up -d

# Rebuild and start
docker-compose up -d --build

# View logs
docker-compose logs -f app
docker-compose logs -f postgres
docker-compose logs -f redis

# Execute command in container
docker-compose exec app node -v
docker-compose exec postgres psql -U phoneparty -d phoneparty

# Stop services
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop, remove containers, and delete volumes
docker-compose down -v
```

### Database Access
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U phoneparty -d phoneparty

# Run SQL file
docker-compose exec -T postgres psql -U phoneparty -d phoneparty < db/schema.sql

# Backup database
docker-compose exec -T postgres pg_dump -U phoneparty phoneparty > backup.sql

# Restore database
docker-compose exec -T postgres psql -U phoneparty -d phoneparty < backup.sql
```

### Redis Access
```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli -a phoneparty_dev_password

# Check Redis keys
docker-compose exec redis redis-cli -a phoneparty_dev_password KEYS '*'

# Monitor Redis commands
docker-compose exec redis redis-cli -a phoneparty_dev_password MONITOR
```

---

## Production Best Practices

### 1. Use Specific Tags
```bash
# Don't use 'latest' in production
# ❌ Bad
docker pull phoneparty:latest

# ✅ Good
docker pull phoneparty:1.0.0
```

### 2. Limit Resources
```bash
docker run -d \
  --name phoneparty \
  --memory="512m" \
  --cpus="0.5" \
  -p 8080:8080 \
  --env-file .env.production \
  phoneparty:1.0.0
```

### 3. Use Docker Secrets
```bash
# Create secret
echo "your-jwt-secret" | docker secret create jwt_secret -

# Use in service (Docker Swarm)
docker service create \
  --name phoneparty \
  --secret jwt_secret \
  -e JWT_SECRET_FILE=/run/secrets/jwt_secret \
  phoneparty:1.0.0
```

### 4. Health Checks
```yaml
# In docker-compose.yml or Dockerfile
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 40s
```

### 5. Logging
```bash
# Use JSON logging driver
docker run -d \
  --name phoneparty \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  phoneparty:1.0.0
```

---

## Multi-Container Production

### Docker Compose Production
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    image: phoneparty:1.0.0
    environment:
      - NODE_ENV=production
      - REDIS_URL=${REDIS_URL}
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    ports:
      - "8080:8080"
    restart: always
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

Deploy:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## Kubernetes Deployment

### Deployment Manifest
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: phoneparty
  labels:
    app: phoneparty
spec:
  replicas: 3
  selector:
    matchLabels:
      app: phoneparty
  template:
    metadata:
      labels:
        app: phoneparty
    spec:
      containers:
      - name: phoneparty
        image: phoneparty:1.0.0
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: phoneparty-secrets
              key: redis-url
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: phoneparty-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: phoneparty-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: phoneparty
spec:
  selector:
    app: phoneparty
  ports:
  - port: 80
    targetPort: 8080
  type: LoadBalancer
```

Deploy:
```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

---

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker logs phoneparty

# Check if environment validation failing
docker logs phoneparty 2>&1 | grep "CRITICAL ERROR"

# Inspect container
docker inspect phoneparty
```

### Health Check Fails
```bash
# Manual health check
docker exec phoneparty curl -f http://localhost:8080/health

# Check if Redis/DB accessible from container
docker exec phoneparty curl -v telnet://redis:6379
docker exec phoneparty curl -v telnet://postgres:5432
```

### Network Issues
```bash
# Check container network
docker network inspect phoneparty_phoneparty-network

# Test connectivity between containers
docker-compose exec app ping postgres
docker-compose exec app ping redis
```

### Permission Issues
```bash
# Check if running as non-root (security best practice)
docker exec phoneparty whoami
# Should return: phoneparty

# If permission errors on volume mounts, check ownership
docker exec phoneparty ls -la /app
```

---

## Image Optimization

### Check Image Size
```bash
docker images phoneparty
```

### Reduce Image Size
1. Use Alpine base image ✅ (already in Dockerfile)
2. Multi-stage builds ✅ (already implemented)
3. Remove dev dependencies ✅ (only production deps)
4. .dockerignore file ✅ (already created)

### Scan for Vulnerabilities
```bash
# Using Trivy
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image phoneparty:latest

# Using Docker Scout (if available)
docker scout cves phoneparty:latest
```

---

## Registry & Distribution

### Push to Registry
```bash
# Docker Hub
docker tag phoneparty:latest username/phoneparty:1.0.0
docker push username/phoneparty:1.0.0

# GitHub Container Registry
docker tag phoneparty:latest ghcr.io/username/phoneparty:1.0.0
docker push ghcr.io/username/phoneparty:1.0.0

# AWS ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
docker tag phoneparty:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/phoneparty:1.0.0
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/phoneparty:1.0.0
```

---

## Additional Resources

- **[docs/DEPLOYMENT.md](./DEPLOYMENT.md)** - General deployment guide
- **[docs/ENVIRONMENT.md](./ENVIRONMENT.md)** - Environment variables
- **[docs/HEALTH_CHECKS.md](./HEALTH_CHECKS.md)** - Health check documentation
- **[Dockerfile](../Dockerfile)** - Production Dockerfile
- **[docker-compose.yml](../docker-compose.yml)** - Local development setup

---

**Last Updated:** February 19, 2026  
**Version:** 1.0  
**Maintained by:** DevOps Team
