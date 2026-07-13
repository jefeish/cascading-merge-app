#!/bin/bash
#
# Quick visual git log for cascade testing
# Shows colored graph with PR numbers and cascade flow
#

REPO_PATH="${1:-.}"
LINES="${2:-50}"

cd "$REPO_PATH" || exit 1

echo "🔍 Cascading Merge Visual Log (Last $LINES commits)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Custom format with colors and detailed info
git log --all \
  --graph \
  --abbrev-commit \
  --decorate \
  --format=format:'%C(bold blue)%h%C(reset) - %C(bold green)(%ar)%C(reset) %C(white)%s%C(reset) %C(dim white)- %an%C(reset)%C(auto)%d%C(reset)' \
  --date=relative \
  -"$LINES"

echo ""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 TIP: Use 'cascade-visual-log.sh <repo-path> <num-lines>' for different views"
