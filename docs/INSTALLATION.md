# Installation Guide

This guide covers two methods for creating and installing the Cascading Merge App.

> **📦 Built with Probot**: This app uses the [Probot](https://probot.github.io/) framework for GitHub Apps. The automated setup leverages Probot's built-in manifest registration flow. For advanced framework configuration, refer to the [Probot documentation](https://probot.github.io/docs/).

## 📋 Prerequisites

- Node.js 20 or higher
- npm 8 or higher
- Admin access to a GitHub organization or repository
- (For local development) smee.io account or webhook proxy

## 🚀 Method 1: Automated Setup (Recommended)

The easiest way to create a GitHub App using Probot's built-in manifest flow.

### Step 1: Clone and Install

```bash
git clone https://github.com/YOUR_ORG/cascading-merge-app.git
cd cascading-merge-app
npm install
```

### Step 2: Start Without an `.env` File

```bash
npm start
```

Probot detects that no `.env` file exists and automatically uses the `app.yml` manifest to pre-configure the GitHub App.

#### Step 2.1: Complete GitHub App Registration

1. Open `http://localhost:3000` in your browser
2. Click "Register GitHub App"
3. You'll be redirected to GitHub to complete the app creation
4. Choose your organization or personal account
5. Review the permissions from `app.yml` and click "Create GitHub App"
6. GitHub redirects back and Probot automatically writes credentials to `.env`
7. Check your local `.env` to see the configured settings and add any custom parameters, if required.
8. Restart the App!

**NOTE:** By default the automated installation creates a local development setup, which uses a webhook proxy (smee.io)

### Step 3: Install the App (on an Org)

After setup completes, you can use the GitHub UI to install the App.

```
https://github.com/apps/YOUR_APP_NAME/installations/new
```

Select the repositories where you want the app to run.

### Step 4: Start the App

```bash
npm run dev
```

or

```bash
npm start
```

## 🔧 Method 2: Manual Setup

Create the GitHub App manually through the GitHub UI.

### Step 1: Create GitHub App

1. Go to **GitHub Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**

2. **Basic Information:**
   - **App name:** `cascading-merge-app` (or your preferred name)
   - **Homepage URL:** `https://github.com/YOUR_ORG/cascading-merge-app`
   - **Webhook URL:**
     - For local dev: `https://smee.io/YOUR_CHANNEL` (get from https://smee.io/new)
     - For production: Your deployed app URL + `/api/github/webhooks`
   - **Webhook secret:** Generate with `openssl rand -hex 20`

3. **Permissions (Repository permissions):**
   - **Contents:** Read & write ✅
   - **Issues:** Read & write ✅
   - **Metadata:** Read-only ✅
   - **Pull requests:** Read & write ✅

4. **Subscribe to events:**
   - **Pull request** ✅

5. **Where can this GitHub App be installed:**
   - Choose based on your needs:
     - "Only on this account" (private)
     - "Any account" (public)

6. Click **Create GitHub App**

### Step 2: Generate Private Key

1. After creating the app, scroll down to **Private keys**
2. Click **Generate a private key**
3. Download the `.pem` file
4. Save it as `private-key.pem` in your project root

### Step 3: Note Your App ID

At the top of the app settings page, note your **App ID**.

### Step 4: Configure Environment

Create `.env` file:

```bash
# Copy template
cp .env.example .env
```

Edit `.env`:

```bash
# Your App ID from step 3
APP_ID=123456

# Your webhook secret from step 1
WEBHOOK_SECRET=your_generated_secret

# Path to your private key from step 2
PRIVATE_KEY_PATH=./private-key.pem

# For local development
WEBHOOK_PROXY_URL=https://smee.io/YOUR_CHANNEL
LOG_LEVEL=debug
NODE_ENV=development
```

### Step 5: Install the App

1. Go to your GitHub App settings page
2. Click **Install App** in the left sidebar
3. Click **Install** next to your organization
4. Choose:
   - **All repositories** or
   - **Only select repositories** (choose test repos)
5. Click **Install**

### Step 6: Start Development

```bash
# Terminal 1: Start webhook proxy (for local dev)
npx smee -u https://smee.io/YOUR_CHANNEL -t http://localhost:3000

# Terminal 2: Start the app
npm run dev
```

You should see:

```
INFO  Listening on http://localhost:3000
INFO  Connected to GitHub App ID: 123456
INFO  Cascading Merge App loaded!
```

---

## 🧪 Verify Installation

### Test the Webhook

1. Create a test PR in a repository where the app is installed
2. Merge the PR
3. Check the terminal logs - you should see:
   ```
   INFO  Processing merged PR #123: Your PR title
   INFO  Configuration loaded: prefixes=[release/], ref_branch=main
   ```

### Check GitHub App

Visit: `https://github.com/apps/YOUR_APP_NAME`

You should see:

- ✅ App is active
- ✅ Installed on X repositories
- ✅ Recent webhook deliveries

## 🔍 Troubleshooting

### "Webhook delivery failed"

**Cause:** App not reachable at webhook URL

**Solutions:**

- For local dev: Ensure smee.io proxy is running
- For production: Verify your app is deployed and accessible
- Check firewall/network settings

### "Missing permissions"

**Cause:** App doesn't have required permissions

**Solution:**

1. Go to App settings → Permissions & events
2. Update repository permissions
3. Click **Save changes**
4. Reinstall the app on affected repositories

### "Authentication failed"

**Cause:** Invalid credentials in `.env`

**Solutions:**

- Verify APP_ID matches your GitHub App
- Check WEBHOOK_SECRET matches app settings
- Ensure PRIVATE_KEY or PRIVATE_KEY_PATH is correct
- For multi-line keys, use PRIVATE_KEY with `\n` escaping

### "App not receiving webhooks"

**Cause:** Webhook configuration issue

**Checklist:**

- [ ] smee.io proxy running (local dev)
- [ ] WEBHOOK_PROXY_URL set in `.env` (local dev)
- [ ] Webhook URL correct in GitHub App settings
- [ ] App is actually installed on the repository
- [ ] Pull request event is subscribed

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for more issues.

## 📦 Production Deployment

For production deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

Key differences for production:

- No webhook proxy needed
- Set `NODE_ENV=production`
- Use actual HTTPS endpoint for webhook URL
- Secure your PRIVATE_KEY
- Set up monitoring and logging

## 🔒 Security Best Practices

1. **Never commit** `.env` or `private-key.pem`
2. **Rotate** webhook secrets periodically
3. **Use separate apps** for dev/staging/production
4. **Limit permissions** to only what's needed
5. **Monitor** webhook deliveries for unusual activity
6. **Enable** 2FA on GitHub account with app ownership

## 📚 Next Steps

- ✅ App installed → Configure repositories: [Configuration Guide](../README.md#️-repository-configuration)
- ✅ Need help? → Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- ✅ Ready to deploy? → See [DEPLOYMENT.md](DEPLOYMENT.md)
- ✅ Want to contribute? → Read [CONTRIBUTING.md](../CONTRIBUTING.md)
