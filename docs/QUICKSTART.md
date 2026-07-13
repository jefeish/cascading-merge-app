# Quick Start Guide

Get the Cascading Merge App running in under 10 minutes!

## 🎯 Goal

Set up the app locally to test cascade merging on your repository.

## ⏱️ Time Required

~10 minutes (5 min if you already have a GitHub App)

## 📋 Prerequisites Checklist

- [ ] Node.js 20+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] Admin access to a GitHub organization or repository
- [ ] A test repository with multiple branches

## 🚀 Step-by-Step Setup

### Step 1: Create GitHub App (3 minutes)

1. Go to: **GitHub.com → Settings → Developer settings → GitHub Apps → New GitHub App**

2. Fill in **basic info**:
   ```
   Name: cascading-merge-test
   Homepage URL: https://github.com
   Webhook URL: https://smee.io/new (click to generate)
   Webhook Secret: (run: openssl rand -hex 20)
   ```

3. Set **permissions**:
   - Repository permissions:
     - ✅ Contents: Read & Write
     - ✅ Issues: Read & Write  
     - ✅ Metadata: Read-only
     - ✅ Pull requests: Read & Write

4. Subscribe to **events**:
   - ✅ Pull request

5. **Create the app** → Generate and download private key

6. **Install the app** on your test repository

### Step 2: Clone and Setup (2 minutes)

```bash
# Clone the repository
git clone https://github.com/YOUR_ORG/cascading-merge-app.git
cd cascading-merge-app

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Step 3: Configure Environment (2 minutes)

Edit `.env` file:

```bash
# From GitHub App settings page
APP_ID=123456                              # Top of settings page
WEBHOOK_SECRET=abc123...                   # Your generated secret
PRIVATE_KEY_PATH=./private-key.pem        # Path to downloaded key

# From smee.io page
WEBHOOK_PROXY_URL=https://smee.io/abc123  # Your smee channel URL

# Development settings
LOG_LEVEL=debug
NODE_ENV=development
```

Save the downloaded private key as `private-key.pem` in the project root.

### Step 4: Start the App (1 minute)

```bash
# Terminal 1: Start webhook proxy
npx smee -u https://smee.io/YOUR_URL -t http://localhost:3000

# Terminal 2: Start the app
npm run dev
```

You should see:
```
INFO  Listening on http://localhost:3000
INFO  Connected to GitHub App ID: 123456
```

### Step 5: Configure Repository (2 minutes)

In your test repository, create: `.github/cascading-merge.yml`

```yaml
prefixes:
  - 'release/'
ref_branch: 'main'
```

Commit and push this file to your `main` branch.

### Step 6: Test It! (2 minutes)

1. **Create test branches**:
   ```bash
   git checkout -b release/1.0
   git push origin release/1.0
   
   git checkout -b release/2.0  
   git push origin release/2.0
   
   git checkout main
   ```

2. **Create and merge a test PR**:
   ```bash
   # Make a change on release/1.0
   git checkout release/1.0
   echo "test" > test.txt
   git add test.txt
   git commit -m "test change"
   git push origin release/1.0
   ```

3. **Open PR**: `release/1.0` → `release/1.0` (or create a feature branch)

4. **Merge the PR** on GitHub

5. **Watch the magic**! 🎉
   - Check your terminal for logs
   - Look for new PRs created automatically
   - See cascade progress in PR comments

## ✅ Success Indicators

You know it's working when you see:

**In Terminal:**
```
DEBUG Configuration loaded: prefixes=[release/], ref_branch=main
INFO  Starting cascade merge from release/1.0
INFO  Created PR #123: release/1.0 → release/2.0
INFO  Auto-merged PR #123
INFO  Created PR #124: release/2.0 → main
INFO  Auto-merged PR #124
INFO  Cascade completed successfully
```

**On GitHub:**
- New PRs appear automatically
- PRs are auto-merged if no conflicts
- Original PR has comment: "✅ Auto-merge was successful."

## 🐛 Common Issues

### "Webhook not received"
**Fix**: Ensure smee proxy is running and URL matches your GitHub App webhook URL

### "Configuration not found"  
**Fix**: Make sure `.github/cascading-merge.yml` is in repository root on main branch

### "Authentication failed"
**Fix**: Verify `APP_ID` and `PRIVATE_KEY_PATH` in `.env` are correct

### "Port 3000 already in use"
**Fix**: `lsof -ti:3000 | xargs kill -9` or change port: `PORT=3001 npm run dev`

### Still stuck?
See [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for detailed solutions.

## 🎓 Next Steps

Now that it's working:

1. **Production deployment**: See [DEPLOYMENT.md](docs/DEPLOYMENT.md)
2. **Customize configuration**: See [Configuration Examples](#configuration-examples) below  
3. **Contribute**: See [CONTRIBUTING.md](CONTRIBUTING.md)
4. **Integrate with CI/CD**: Configure branch protection rules

## 💡 Configuration Examples

### Multiple Branch Prefixes

```yaml
prefixes:
  - 'release/'
  - 'hotfix/'
  - 'staging/'
ref_branch: 'main'
```

### Complex Version Branches

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
