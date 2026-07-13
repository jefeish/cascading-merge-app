#!/bin/bash
#
# Compare git state before and after cascade test
# Usage: ./cascade-compare.sh <repo-path> <pr-number>
#

REPO_PATH="${1:-.}"
PR_NUMBER="${2}"

if [ -z "$PR_NUMBER" ]; then
  echo "❌ Usage: ./cascade-compare.sh <repo-path> <pr-number>"
  echo "   Example: ./cascade-compare.sh ~/projects/test-repo 136"
  exit 1
fi

cd "$REPO_PATH" || exit 1

echo "🔍 Analyzing Cascade Chain for PR #$PR_NUMBER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Find the merge commit for this PR
MERGE_COMMIT=$(git log --all --grep="Merge pull request #$PR_NUMBER" --format="%H" | head -1)

if [ -z "$MERGE_COMMIT" ]; then
  echo "❌ Could not find PR #$PR_NUMBER"
  exit 1
fi

echo "✅ Found PR #$PR_NUMBER at commit: ${MERGE_COMMIT:0:8}"
echo ""

# Get PR details
PR_TITLE=$(git log --format=%s -n 1 "$MERGE_COMMIT")
PR_AUTHOR=$(git log --format=%an -n 1 "$MERGE_COMMIT")
PR_DATE=$(git log --format=%ar -n 1 "$MERGE_COMMIT")

echo "📌 PR Details:"
echo "   Title: $PR_TITLE"
echo "   Author: $PR_AUTHOR"
echo "   Date: $PR_DATE"
echo ""

# Find all subsequent cascade PRs
echo "🔄 Cascade Chain (PRs created by this merge):"
echo ""

# Look for PRs created after this one that mention cascading
git log --all --since="$PR_DATE" --grep="Automatic merge from" --format="%h - %s (%ar) <%an>" | head -20

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Show the graph around this PR
echo ""
echo "📊 Visual Graph (20 commits context):"
echo ""
git log --all --graph --format=format:'%C(auto)%h%d %s %C(green)(%cr)%Creset' --abbrev-commit "$MERGE_COMMIT"~10.."$MERGE_COMMIT"^10

echo ""
echo ""
echo "💡 TIP: Check the GitHub PR page for full details: "
REPO_URL=$(git remote get-url origin | sed 's/\.git$//')
echo "   $REPO_URL/pull/$PR_NUMBER"
