# Deployment Guide

This guide covers deploying the Cascading Merge App to production environments.

## Table of Contents

- [Deployment Options](#deployment-options)
- [Environment Variables](#environment-variables)
- [Docker Deployment](#docker-deployment)
- [Cloud Platform Deployments](#cloud-platform-deployments)
- [Monitoring & Logging](#monitoring--logging)
- [Security Best Practices](#security-best-practices)
- [Scaling Considerations](#scaling-considerations)

## Deployment Options

### Option 1: VM/Server Deployment

Best for: Self-hosted infrastructure, maximum control

**Pros:**
- Full control over environment
- No vendor lock-in
- Predictable costs

**Cons:**
- Requires server maintenance
- Manual scaling
- Need to manage SSL/HTTPS

### Option 2: Container Platforms (Docker)

Best for: Modern infrastructure, easy scaling

**Pros:**
- Consistent environments
- Easy horizontal scaling
- Platform independent

**Cons:**
- Container orchestration complexity
- Requires container knowledge

### Option 3: Platform-as-a-Service (Heroku, Azure, AWS)

Best for: Rapid deployment, minimal DevOps

**Pros:**
- Easy deployment
- Managed infrastructure
- Auto-scaling options

**Cons:**
- Vendor lock-in
- Higher costs
- Limited customization

## Environment Variables

### Required Variables

```bash
# GitHub App Credentials
APP_ID=123456
PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----"
WEBHOOK_SECRET=your_webhook_secret_here

# Optional but recommended
GITHUB_CLIENT_ID=Iv1.abc123
GITHUB_CLIENT_SECRET=def456
```

### Optional Variables

```bash
# Logging
LOG_LEVEL=info              # debug, info, warn, error
LOG_FORMAT=json             # json or pretty

# Server
PORT=3000                   # Default: 3000
NODE_ENV=production         # production or development

# Webhook proxy (development only)
WEBHOOK_PROXY_URL=https://smee.io/your-channel

# Rate Limiting
GITHUB_API_TIMEOUT=30000    # API timeout in ms
MAX_RETRIES=3               # Max API retry attempts
```

## Docker Deployment

### 1. Create Dockerfile

```dockerfile
# Use official Node.js LTS image
FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app source
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/probot', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start app
CMD ["npm", "start"]
```

### 2. Create .dockerignore

```
node_modules
npm-debug.log
dist
.env
.git
.github
__tests__
*.md
.prettierrc
.eslintrc.json
```

### 3. Build and Run

```bash
# Build image
docker build -t cascading-merge-app:latest .

# Run container
docker run -d \
  --name cascading-merge-app \
  -p 3000:3000 \
  -e APP_ID=your_app_id \
  -e PRIVATE_KEY="$(cat private-key.pem)" \
  -e WEBHOOK_SECRET=your_secret \
  --restart unless-stopped \
  cascading-merge-app:latest
```

### 4. Docker Compose (Recommended)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - APP_ID=${APP_ID}
      - PRIVATE_KEY=${PRIVATE_KEY}
      - WEBHOOK_SECRET=${WEBHOOK_SECRET}
      - NODE_ENV=production
      - LOG_LEVEL=info
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/probot', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
    volumes:
      - ./logs:/usr/src/app/logs

  # Optional: Nginx reverse proxy for HTTPS
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
```

## Cloud Platform Deployments

### Heroku

1. **Install Heroku CLI**
   ```bash
   npm install -g heroku
   ```

2. **Create Heroku App**
   ```bash
   heroku create cascading-merge-app
   ```

3. **Set Environment Variables**
   ```bash
   heroku config:set APP_ID=your_app_id
   heroku config:set WEBHOOK_SECRET=your_secret
   heroku config:set PRIVATE_KEY="$(cat private-key.pem)"
   ```

4. **Create Procfile**
   ```
   web: npm start
   ```

5. **Deploy**
   ```bash
   git push heroku main
   ```

6. **Scale**
   ```bash
   heroku ps:scale web=1
   ```

### Azure App Service

1. **Create App Service**
   ```bash
   az webapp create \
     --resource-group myResourceGroup \
     --plan myAppServicePlan \
     --name cascading-merge-app \
     --runtime "NODE|20-lts"
   ```

2. **Configure Settings**
   ```bash
   az webapp config appsettings set \
     --resource-group myResourceGroup \
     --name cascading-merge-app \
     --settings \
       APP_ID=your_app_id \
       WEBHOOK_SECRET=your_secret \
       PRIVATE_KEY="$(cat private-key.pem)"
   ```

3. **Deploy**
   ```bash
   az webapp deployment source config-zip \
     --resource-group myResourceGroup \
     --name cascading-merge-app \
     --src app.zip
   ```

### AWS Elastic Beanstalk

1. **Install EB CLI**
   ```bash
   pip install awsebcli
   ```

2. **Initialize**
   ```bash
   eb init -p node.js-20 cascading-merge-app
   ```

3. **Create Environment**
   ```bash
   eb create production
   ```

4. **Set Environment Variables**
   ```bash
   eb setenv \
     APP_ID=your_app_id \
     WEBHOOK_SECRET=your_secret \
     PRIVATE_KEY="$(cat private-key.pem)"
   ```

5. **Deploy**
   ```bash
   eb deploy
   ```

### Google Cloud Run

1. **Build Container**
   ```bash
   gcloud builds submit --tag gcr.io/PROJECT_ID/cascading-merge-app
   ```

2. **Deploy**
   ```bash
   gcloud run deploy cascading-merge-app \
     --image gcr.io/PROJECT_ID/cascading-merge-app \
     --platform managed \
     --region us-central1 \
     --set-env-vars APP_ID=your_app_id \
     --set-env-vars WEBHOOK_SECRET=your_secret \
     --set-secrets PRIVATE_KEY=private-key:latest
   ```

## Monitoring & Logging

### Health Checks

The app exposes a health check endpoint at `/probot`.

```bash
curl http://your-app-url/probot
# Should return 200 OK
```

### Logging Configuration

**JSON Logging (Production)**
```bash
LOG_FORMAT=json LOG_LEVEL=info npm start
```

**Pretty Logging (Development)**
```bash
LOG_FORMAT=pretty LOG_LEVEL=debug npm run dev
```

### Log Management

**With Docker + ELK Stack:**

```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

**With Cloud Providers:**
- Azure: Application Insights
- AWS: CloudWatch Logs
- GCP: Cloud Logging
- Heroku: Built-in logging

### Monitoring Metrics

Monitor these key metrics:

1. **Webhook Processing Time**: Track cascade execution duration
2. **API Rate Limits**: Monitor GitHub API usage
3. **Error Rates**: Track failed merges and API errors
4. **Memory Usage**: Ensure no memory leaks
5. **CPU Usage**: Monitor for performance issues

## Security Best Practices

### 1. Private Key Management

**Never commit private keys!**

Use secrets management:

```bash
# Docker secrets
docker secret create github_private_key private-key.pem

# Kubernetes secrets
kubectl create secret generic github-app \
  --from-file=private-key=./private-key.pem

# Cloud provider secrets
# AWS: Secrets Manager
# Azure: Key Vault
# GCP: Secret Manager
```

### 2. Webhook Security

Verify webhook signatures (Probot handles this automatically):

```typescript
// Already handled by Probot framework
// Ensure WEBHOOK_SECRET is set
```

### 3. Network Security

- Use HTTPS only in production
- Configure firewall rules
- Implement rate limiting
- Use reverse proxy (nginx/Traefik)

Example nginx config:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }
}
```

### 4. Dependency Security

```bash
# Regular security audits
npm audit

# Fix vulnerabilities
npm audit fix

# Update dependencies
npm update
```

## Scaling Considerations

### Horizontal Scaling

The app is stateless and can be scaled horizontally:

```bash
# Docker Swarm
docker service scale cascading-merge-app=3

# Kubernetes
kubectl scale deployment cascading-merge-app --replicas=3

# Heroku
heroku ps:scale web=3
```

### Rate Limiting

GitHub API has rate limits:
- **5,000 requests/hour** for authenticated apps
- **15,000 requests/hour** for Enterprise

Monitor usage:
```bash
# Check rate limit
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.github.com/rate_limit
```

### Load Balancing

Use a load balancer for multiple instances:

```yaml
# docker-compose.yml
services:
  loadbalancer:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx-lb.conf:/etc/nginx/nginx.conf
    depends_on:
      - app1
      - app2
      - app3
      
  app1:
    build: .
    environment:
      - APP_ID=${APP_ID}
      
  app2:
    build: .
    environment:
      - APP_ID=${APP_ID}
      
  app3:
    build: .
    environment:
      - APP_ID=${APP_ID}
```

## Troubleshooting Deployments

### Common Issues

**1. App won't start**
```bash
# Check logs
docker logs cascading-merge-app
heroku logs --tail
kubectl logs deployment/cascading-merge-app
```

**2. Webhook not receiving events**
- Verify webhook URL in GitHub App settings
- Check firewall/security group rules
- Ensure app is publicly accessible
- Test with webhook proxy (smee.io)

**3. Authentication failures**
- Verify APP_ID matches GitHub App
- Check PRIVATE_KEY format (include newlines)
- Ensure WEBHOOK_SECRET matches GitHub App

**4. Memory issues**
```bash
# Increase memory limit (Docker)
docker run -m 512m cascading-merge-app

# Kubernetes
resources:
  limits:
    memory: "512Mi"
```

## Maintenance

### Backup Strategy

No database, but backup:
1. GitHub App credentials
2. Configuration files
3. Deployment scripts

### Update Process

1. Test in staging environment
2. Build new version
3. Deploy with zero-downtime:
   ```bash
   # Rolling update
   docker-compose up -d --no-deps --build app
   ```
4. Monitor logs and metrics
5. Rollback if needed:
   ```bash
   docker-compose up -d --no-deps app:previous-version
   ```

---

For more help, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
