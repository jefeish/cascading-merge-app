# Troubleshooting Guide

Common issues and solutions for the Cascading Merge App.

> **📦 Built with Probot**: This app uses the [Probot](https://probot.github.io/) framework. For framework-level troubleshooting (webhooks, authentication, middleware), consult the [Probot documentation](https://probot.github.io/docs/).

## Table of Contents

- [Installation Issues](#installation-issues)
- [Configuration Problems](#configuration-problems)
- [Webhook Issues](#webhook-issues)
- [API and Rate Limiting](#api-and-rate-limiting)
- [Merge Failures](#merge-failures)
- [Performance Issues](#performance-issues)
- [Debugging Tools](#debugging-tools)

## Installation Issues

### GitHub App Creation Fails

**Problem:** Can't create GitHub App or missing permissions

**Solutions:**

1. Verify you have admin access to the organization
2. Check required permissions:
   - Contents: Read & Write ✅
   - Issues: Read & Write ✅
   - Metadata: Read-only ✅
   - Pull requests: Read & Write ✅
3. Ensure you've subscribed to "Pull request" events

### App Won't Start

**Problem:** `npm start` fails or app crashes immediately

**Check these:**

1. **Environment variables**

   ```bash
   # Verify required vars are set
   echo $APP_ID
   echo $WEBHOOK_SECRET
   # Should show values, not empty
   ```

2. **Private key format**

   ```bash
   # Should include header/footer and newlines
   echo "$PRIVATE_KEY" | head -1
   # Should show: -----BEGIN RSA PRIVATE KEY-----
   ```

3. **Dependencies installed**

   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Build errors**
   ```bash
   npm run build
   # Check for TypeScript errors
   ```

**Common error messages:**

- `Error: Missing required environment variable: APP_ID`
  → Set APP_ID in `.env` file

- `Error: error:0909006C:PEM routines:get_name:no start line`
  → Private key format is wrong. Should be multi-line with proper headers

- `Port 3000 already in use`
  → Another process is using port 3000
  ```bash
  # Kill the process
  lsof -ti:3000 | xargs kill -9
  # Or use different port
  PORT=3001 npm start
  ```

## Configuration Problems

### Config File Not Loading

**Problem:** App says "Configuration not found" or uses defaults

**Solutions:**

1. **Check file location**

   ```bash
   # Must be at: .github/cascading-merge.yml
   git ls-files .github/
   ```

2. **Verify YAML syntax**

   ```bash
   # Install yamllint
   brew install yamllint  # macOS
   sudo apt install yamllint  # Linux

   # Check syntax
   yamllint .github/cascading-merge.yml
   ```

3. **Check file permissions**
   ```bash
   ls -la .github/cascading-merge.yml
   # Should be readable
   ```

**Valid config example:**

```yaml
prefixes:
  - 'release/'
  - 'hotfix/'
ref_branch: 'main'
```

**Invalid examples:**

```yaml
# ❌ Wrong: Uses tabs instead of spaces
prefixes:
	- 'release/'

# ❌ Wrong: Missing quotes
prefixes:
  - release/

# ❌ Wrong: Incorrect indentation
prefixes:
- 'release/'
  - 'hotfix/'
```

### Branches Not Being Cascaded

**Problem:** PR merged but no cascade happens

**Check:**

1. **Branch matches prefix**

   ```yaml
   # Config has:
   prefixes:
     - 'release/'

   # Branch must start with 'release/'
   # ✅ release/1.0
   # ❌ releases/1.0 (wrong prefix)
   ```

2. **PR was actually merged (not just closed)**
   - GitHub shows "Merged" badge, not "Closed"

3. **App is installed on repository**

   ```bash
   # Check GitHub App installations
   # Go to: Settings → Installed GitHub Apps
   ```

4. **Check logs**
   ```bash
   # Look for:
   # "Configuration loaded"
   # "Starting cascade merge"
   LOG_LEVEL=debug npm run dev
   ```

## Webhook Issues

### Webhooks Not Received

**Problem:** No cascade triggered when PR is merged

**Debugging steps:**

1. **Verify webhook is configured**
   - GitHub App Settings → Webhook → Recent Deliveries
   - Should show delivery attempts

2. **Check webhook URL**

   ```bash
   # For local dev, should use smee.io or ngrok
   # For production, should be your public URL

   # Test if app is reachable
   curl http://your-webhook-url/probot
   # Should return: GET request to /probot is not supported
   ```

3. **Firewall/Network issues**

   ```bash
   # If using smee.io proxy
   npx smee -u https://smee.io/YOUR_URL -t http://localhost:3000

   # If using ngrok
   ngrok http 3000
   ```

4. **Check webhook secret**
   ```bash
   # Must match between:
   # - GitHub App webhook secret
   # - .env WEBHOOK_SECRET

   # Probot will reject mismatched signatures
   ```

### Webhook Delivery Failures

**Problem:** GitHub shows failed webhook deliveries

**Check recent deliveries:**

1. Go to GitHub App Settings → Advanced → Recent Deliveries
2. Click on failed delivery
3. Check Response tab for error

**Common responses:**

- `502 Bad Gateway` → App is down or unreachable
- `401 Unauthorized` → Webhook secret mismatch
- `500 Internal Server Error` → Check app logs for crash

## API and Rate Limiting

### Rate Limit Exceeded

**Problem:** "API rate limit exceeded" errors

**Solutions:**

1. **Check current rate limit**

   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.github.com/rate_limit
   ```

2. **Implement backoff** (already in code)

   ```typescript
   // App already retries with exponential backoff
   // Check logs for retry attempts
   ```

3. **Upgrade to GitHub Enterprise**
   - Free/Team: 5,000 requests/hour
   - Enterprise: 15,000 requests/hour

4. **Optimize requests**
   - Reduce number of parallel cascades
   - Use conditional requests (ETags)

### Authentication Errors

**Problem:** "Bad credentials" or 401 errors

**Solutions:**

1. **Regenerate installation token**

   ```bash
   # App automatically manages tokens
   # If persisting, regenerate private key:
   # GitHub App Settings → Private keys → Generate
   ```

2. **Check APP_ID**

   ```bash
   # Must match GitHub App ID (numeric)
   echo $APP_ID
   # Go to GitHub App → General → About
   # App ID shown at top
   ```

3. **Verify private key**
   ```bash
   # Test private key validity
   openssl rsa -in private-key.pem -check
   # Should output: RSA key ok
   ```

## Merge Failures

### Cascade Stops Midway

**Problem:** Some PRs created but cascade doesn't complete

**Check logs for:**

1. **Merge conflicts**

   ```
   "Could not auto merge PR #123 due to merge conflicts"
   ```

   → Manual intervention required

2. **No commits between branches**

   ```
   "There are no commits between branch1 and branch2"
   ```

   → Expected behavior, cascade continues

3. **PR already exists**
   ```
   "There is already a pull request open"
   ```
   → Close or merge existing PR first

### PRs Not Auto-Merging

**Problem:** PRs created but not merged automatically

**Possible causes:**

1. **Branch protection rules**
   - Required reviews
   - Required status checks
   - Solution: Configure app to bypass or satisfy requirements

2. **Merge conflicts**
   - Check PR for conflicts
   - Resolve manually and cascade will continue

3. **Permission issues**
   ```bash
   # Verify app has "Contents: Write" permission
   # GitHub App Settings → Permissions & events
   ```

### Wrong Branch Order

**Problem:** Branches merged in incorrect order

**Debug:**

1. **Check branch names**

   ```bash
   # App expects semantic versioning
   # Correct: release/1.0, release/1.1, release/2.0
   # Incorrect: release-1.0, 1.0-release
   ```

2. **Test ordering algorithm**
   ```typescript
   // The algorithm hasn't changed from original Action
   // If order is wrong, it was likely wrong in Action too

   // Test locally:
   npm test -- --verbose
   // Check "Performs a simple cascade" test
   ```

## Performance Issues

### Slow Cascade Execution

**Problem:** Takes too long to cascade

**Optimize:**

1. **Reduce number of branches**
   - Consider consolidating old release branches

2. **Check API latency**

   ```bash
   # Monitor GitHub API response times
   curl -w "@curl-format.txt" -o /dev/null -s \
     -H "Authorization: Bearer TOKEN" \
     https://api.github.com/repos/owner/repo
   ```

3. **Review logs for retries**
   ```bash
   LOG_LEVEL=debug npm run dev | grep retry
   ```

### High Memory Usage

**Problem:** App consuming too much memory

**Solutions:**

1. **Monitor memory**

   ```bash
   # Docker
   docker stats cascading-merge-app

   # Node.js
   node --max-old-space-size=512 dist/index.js
   ```

2. **Check for memory leaks**

   ```bash
   npm install -g clinic
   clinic doctor -- node dist/index.js
   ```

3. **Restart app periodically**
   ```bash
   # Add to crontab or systemd timer
   0 2 * * * systemctl restart cascading-merge-app
   ```

## Debugging Tools

### Enable Debug Logging

```bash
LOG_LEVEL=debug npm run dev
```

### Test with curl

```bash
# Simulate webhook
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -H "X-Hub-Signature-256: sha256=..." \
  -d @webhook-payload.json \
  http://localhost:3000
```

### Check GitHub API Status

```bash
# GitHub status
curl https://www.githubstatus.com/api/v2/status.json

# API rate limit
curl -H "Authorization: Bearer TOKEN" \
  https://api.github.com/rate_limit
```

### Inspect Webhook Payloads

1. Go to GitHub App Settings → Advanced → Recent Deliveries
2. Click on delivery
3. Check Request/Response tabs
4. Use "Redeliver" button to replay events

### Test Configuration Locally

```typescript
// Create test script: test-config.js
import { loadConfig } from './dist/lib/config.js'

const mockContext = {
  octokit: {
    repos: {
      getContent: async () => ({
        data: {
          content: Buffer.from(
            `
prefixes:
  - 'release/'
ref_branch: 'main'
          `
          ).toString('base64')
        }
      })
    }
  },
  repo: { owner: 'test', repo: 'test' }
}

const config = await loadConfig(mockContext)
console.log('Config loaded:', config)
```

Run:

```bash
node test-config.js
```

### Validate Branch Ordering

```bash
# Test the ordering algorithm
npm test -- --testNamePattern="simple cascade"
```

## Getting More Help

If these solutions don't resolve your issue:

1. **Enable debug logging** and capture full logs

   ```bash
   LOG_LEVEL=debug npm run dev 2>&1 | tee debug.log
   ```

2. **Check GitHub Status**: https://www.githubstatus.com

3. **Review recent changes**

   ```bash
   git log --oneline -10
   ```

4. **Open an issue** with:
   - Detailed problem description
   - Relevant log excerpts (redact secrets!)
   - Configuration files (redact sensitive data)
   - Steps to reproduce
   - Expected vs actual behavior

5. **Search existing issues**:
   https://github.com/YOUR_ORG/cascading-merge-app/issues

---

**Still stuck?** Open a discussion: https://github.com/YOUR_ORG/cascading-merge-app/discussions
