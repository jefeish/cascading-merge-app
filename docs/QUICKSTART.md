# Quick Start Guide

Get the Cascading Merge App running in **5 minutes**!

## Prerequisites (5 min)

- Node.js 20+ and npm
- Admin access to a GitHub org/repo

## Setup

### 1. Clone & Install (1 min)

```bash
git clone https://github.com/YOUR_ORG/cascading-merge-app.git
cd cascading-merge-app
npm install
``` 

### 2. Create GitHub App (2 min)

**Option A: Automated** ⚡
```bash
npm run dev
# Opens browser, creates app automatically, based on the 'app.yml' manifest
```

**Option B: Manual** 📝  
Go to: GitHub → Settings → Developer settings → GitHub Apps → New
- **Permissions**: Contents (R/W), Issues (R/W), Pull requests (R/W), Metadata (Read)
- **Events**: Pull request
- **Webhook**: https://smee.io/new (get URL first)
- **Secret**: `openssl rand -hex 20`
- Generate & download private key

### 3. Configure  The App (1 min)


:warning: NOTE: If you used 'option 1', automated App installation, the basic App `.env` settings have already been done for you. You can skip to **4. (Step 2)**

```bash
cp .env.example .env
```

Edit `.env`:
```bash
APP_ID=123456                              # From app settings
WEBHOOK_SECRET=abc...                      # Your secret
PRIVATE_KEY_PATH=./private-key.pem        # Downloaded key
WEBHOOK_PROXY_URL=https://smee.io/abc...  # Smee URL
```

### 4. Start (1 min)

Step 1
```bash
# Terminal 1: Webhook proxy
npx smee -u https://smee.io/YOUR_URL -t http://localhost:3000
```
Step 2
```bash
# Terminal 2: App
npm run dev
```

✅ You should see: `INFO Listening on http://localhost:3000`

### 5. Configure Repository (1 min)

In your test repo, create `.github/cascading-merge.yml`:

:warning: **NOTE:** See the `.github/cascading-merge.yml.example` for available content.

```yaml
prefixes:
  - 'release/'
ref_branch: 'main'
verbose: true  # Creates visual reports
```

:warning: Commit to your default branch.

## Test It!

1. Create branches: `release/1.0`, `release/2.0`
2. Make a change on `release/1.0`
3. Create `patch` branch and merge a PR
4. **Watch cascade PRs appear automatically!** 🎉

**Terminal shows:**
```
INFO  Starting cascade merge from release/1.0
INFO  Created PR #123: release/1.0 → release/2.0
INFO  Created PR #124: release/2.0 → main
```

**With `verbose: true`, check GitHub Issues** for a visual cascade report with Mermaid diagrams.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Webhook not received" | Check smee proxy is running |
| "Configuration not found" | Ensure `.github/cascading-merge.yml` is on default branch |
| "Authentication failed" | Verify `APP_ID` and `PRIVATE_KEY_PATH` |
| Port 3000 in use | `lsof -ti:3000 \| xargs kill -9` |

📖 **Detailed help**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## Next Steps

- **Production**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Configuration**: [README.md](../README.md#-repository-configuration)
- **Contributing**: [CONTRIBUTING.md](../CONTRIBUTING.md)

```yaml
# Handles: release/1.0, release/1.1-rc1, release/2.0-alpha
prefixes:
  - 'release/'
ref_branch: 'develop'
```

### Different Final Branch

```yaml
prefixes:
  - 'stable/'
ref_branch: 'production'
```

## 🎯 Testing Different Scenarios

### Test 1: Simple Cascade
```
release/1.0 → release/2.0 → main
```

### Test 2: With Conflicts
1. Make different changes to same file on two branches
2. Merge PR to earlier branch
3. App will detect conflict and create issue

### Test 3: Multiple Prefixes
```yaml
prefixes:
  - 'release/'
  - 'hotfix/'
ref_branch: 'main'
```

Create branches: `release/1.0`, `hotfix/1.0.1`, `release/2.0`

## 🔗 Resources

- [Full README](README.md) - Complete documentation
- [Probot Docs](https://probot.github.io) - Framework documentation
- [GitHub Apps Guide](https://docs.github.com/en/developers/apps) - GitHub Apps overview
- [Original Action](https://github.com/ActionsDesk/cascading-downstream-merge) - Source project

## 💬 Get Help

- 💡 [Discussions](https://github.com/YOUR_ORG/cascading-merge-app/discussions) - Ask questions
- 🐛 [Issues](https://github.com/YOUR_ORG/cascading-merge-app/issues) - Report bugs
- 📖 [Full Documentation](README.md) - Detailed guides

---

**Congratulations!** 🎉 You now have a working cascading merge automation!
