# Cascading Merge App - Visual Testing Scripts

This directory contains scripts for generating visual reports and analyzing cascade merge behavior.

## 📊 Available Scripts

### 1. **generate-cascade-report.sh** - Comprehensive Markdown Report

Generates a detailed markdown report with graphs, tables, and statistics.

**Usage:**
```bash
./scripts/generate-cascade-report.sh <repo-path> [output-file.md]
```

**Example:**
```bash
./scripts/generate-cascade-report.sh ~/test-repo my-report.md
```

**Output Includes:**
- 🌳 Branch structure list
- 📊 ASCII commit graph (last 50 commits)
- 🔄 Table of cascade merge PRs with links
- 🎯 Table of original (trigger) PRs  
- 📈 Statistics (commits, cascades, branches)
- 🔀 Mermaid diagram (renders in GitHub/VS Code)

**Best For:** Documentation, GitHub README, comprehensive test reports

---

### 2. **cascade-visual-log.sh** - Quick Terminal Graph

Displays a colorful, formatted git log in the terminal.

**Usage:**
```bash
./scripts/cascade-visual-log.sh [repo-path] [num-commits]
```

**Example:**
```bash
./scripts/cascade-visual-log.sh ~/test-repo 100
```

**Output:** Colored ASCII graph with commit hashes, authors, dates, and PR numbers

**Best For:** Quick visual check during testing, debugging cascade flow

---

### 3. **export-cascade-html.sh** - Interactive HTML Report

Generates a styled, interactive HTML report with clickable links.

**Usage:**
```bash
./scripts/export-cascade-html.sh <repo-path> [output-file.html]
```

**Example:**
```bash
./scripts/export-cascade-html.sh ~/test-repo visual-report.html
open visual-report.html  # Opens in default browser
```

**Output Includes:**
- 📊 Statistics dashboard with cards
- 🌳 Visual branch tags
- 📈 Commit graph
- 🔄 Interactive tables with GitHub links
- 🎯 Clickable commit hashes

**Best For:** Presentations, sharing with stakeholders, visual demos

---

### 4. **cascade-compare.sh** - Single PR Analysis

Analyzes a specific PR and its cascade chain.

**Usage:**
```bash
./scripts/cascade-compare.sh <repo-path> <pr-number>
```

**Example:**
```bash
./scripts/cascade-compare.sh ~/test-repo 136
```

**Output:**
- ✅ PR details (title, author, date)
- 🔄 List of cascade PRs triggered by this merge
- 📊 Visual graph showing context around the PR
- 💡 Direct link to GitHub PR page

**Best For:** Debugging specific cascade chains, understanding PR impact

---

## 🚀 Quick Start

### Run a Full Test Cycle

```bash
# 1. Make changes in test repo and merge a PR
cd ~/cascading-auto-merge-test
# ... merge PR #150 ...

# 2. Generate visual report
cd ~/cascading-merge-app
./scripts/generate-cascade-report.sh ~/cascading-auto-merge-test test-report-$(date +%Y%m%d).md

# 3. Analyze specific cascade chain
./scripts/cascade-compare.sh ~/cascading-auto-merge-test 150

# 4. Create HTML for presentation
./scripts/export-cascade-html.sh ~/cascading-auto-merge-test demo-$(date +%Y%m%d).html
open demo-*.html
```

---

## 📝 Sample Output Locations

All scripts output files to the **repository being analyzed** (not the app repo).

**Example:** If you analyze `/Users/john/test-repo`, files are created in:
```
/Users/john/test-repo/
├── cascade-report.md         # From generate-cascade-report.sh
├── cascade-visual-test.html  # From export-cascade-html.sh
└── (terminal output only)     # cascade-visual-log.sh, cascade-compare.sh
```

---

## 🎯 Choosing the Right Script

| Goal | Script | Output Format |
|------|--------|--------------|
| Quick terminal check | `cascade-visual-log.sh` | Terminal (colored) |
| Full documentation | `generate-cascade-report.sh` | Markdown |
| Share with team | `export-cascade-html.sh` | HTML |
| Debug specific PR | `cascade-compare.sh` | Terminal |
| Integration test report | `generate-cascade-report.sh` + `export-cascade-html.sh` | Both |

---

## 🔧 Requirements

- **Git** (all scripts)
- **Bash** 4.0+ (macOS/Linux)
- **Browser** (for HTML reports)

---

## 💡 Tips

1. **Combine Reports:** Generate both Markdown and HTML for comprehensive documentation
2. **Automation:** Add these scripts to your CI/CD pipeline for automated test reporting
3. **Comparison:** Run reports before/after changes to visualize differences
4. **Archiving:** Save reports with timestamps for historical tracking

---

## 📚 Related Documentation

- [Main README](../README.md) - App setup and configuration
- [TROUBLESHOOTING](../TROUBLESHOOTING.md) - Common issues
- [DEPLOYMENT](../DEPLOYMENT.md) - Production setup

---

**Questions?** Open an issue on GitHub or check the main documentation.
