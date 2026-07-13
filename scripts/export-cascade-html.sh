#!/bin/bash
#
# Export git log to HTML with clickable links
# Usage: ./export-cascade-html.sh <repo-path> <output-file.html>
#

REPO_PATH="${1:-.}"
OUTPUT_FILE="${2:-cascade-report.html}"

cd "$REPO_PATH" || exit 1

REPO_URL=$(git remote get-url origin | sed 's/\.git$//' | sed 's/git@github.com:/https:\/\/github.com\//')
REPO_NAME=$(basename "$(git rev-parse --show-toplevel)")

cat > "$OUTPUT_FILE" <<'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Cascading Merge App - Visual Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: #0d1117;
            color: #c9d1d9;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: #161b22;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        }
        h1 {
            color: #58a6ff;
            border-bottom: 2px solid #21262d;
            padding-bottom: 15px;
            margin-top: 0;
        }
        h2 {
            color: #79c0ff;
            margin-top: 30px;
            border-left: 4px solid #58a6ff;
            padding-left: 15px;
        }
        .meta {
            background: #0d1117;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 25px;
            font-size: 14px;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .stat-card {
            background: #0d1117;
            padding: 20px;
            border-radius: 6px;
            border-left: 4px solid #58a6ff;
        }
        .stat-card h3 {
            margin: 0 0 10px 0;
            color: #79c0ff;
            font-size: 16px;
        }
        .stat-card .value {
            font-size: 32px;
            font-weight: bold;
            color: #58a6ff;
        }
        pre {
            background: #0d1117;
            padding: 20px;
            border-radius: 6px;
            overflow-x: auto;
            border: 1px solid #21262d;
            line-height: 1.6;
            font-size: 13px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: #0d1117;
            border-radius: 6px;
            overflow: hidden;
        }
        th {
            background: #21262d;
            padding: 12px;
            text-align: left;
            color: #79c0ff;
            font-weight: 600;
        }
        td {
            padding: 12px;
            border-top: 1px solid #21262d;
        }
        tr:hover {
            background: #161b22;
        }
        a {
            color: #58a6ff;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        .branch-list {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin: 15px 0;
        }
        .branch-tag {
            background: #1f6feb;
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 13px;
            font-family: 'Monaco', 'Courier New', monospace;
        }
        code {
            background: #0d1117;
            padding: 2px 6px;
            border-radius: 3px;
            color: #79c0ff;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔄 Cascading Merge App - Visual Test Report</h1>
        
        <div class="meta">
EOF

echo "            <strong>Repository:</strong> <a href=\"$REPO_URL\" target=\"_blank\">$REPO_NAME</a><br>" >> "$OUTPUT_FILE"
echo "            <strong>Generated:</strong> $(date)<br>" >> "$OUTPUT_FILE"
echo "            <strong>Report URL:</strong> <a href=\"$REPO_URL\" target=\"_blank\">$REPO_URL</a>" >> "$OUTPUT_FILE"

cat >> "$OUTPUT_FILE" <<EOF
        </div>

        <div class="stats">
            <div class="stat-card">
                <h3>Total Commits</h3>
                <div class="value">$(git rev-list --all --count)</div>
            </div>
            <div class="stat-card">
                <h3>Cascade PRs</h3>
                <div class="value">$(git log --all --grep='Automatic merge from' --oneline | wc -l | tr -d ' ')</div>
            </div>
            <div class="stat-card">
                <h3>Release Branches</h3>
                <div class="value">$(git branch -r --list 'origin/release/*' | wc -l | tr -d ' ')</div>
            </div>
            <div class="stat-card">
                <h3>Original PRs</h3>
                <div class="value">$(git log --all --grep='JIRA-\|fixed\|feat\|bug' --grep='Automatic merge' --invert-grep --oneline | wc -l | tr -d ' ')</div>
            </div>
        </div>

        <h2>🌳 Branch Structure</h2>
        <div class="branch-list">
EOF

git branch -r --list 'origin/release/*' --sort=-committerdate | sed 's/origin\///' | while read -r branch; do
  echo "            <span class=\"branch-tag\">$branch</span>" >> "$OUTPUT_FILE"
done

cat >> "$OUTPUT_FILE" <<EOF
        </div>

        <h2>📊 Commit Graph</h2>
        <pre>$(git log --all --graph --pretty=format:'%h %s (%cr) <%an>' --abbrev-commit --date=relative -40 | sed 's/</\&lt;/g' | sed 's/>/\&gt;/g')</pre>

        <h2>🔄 Cascade Merge PRs</h2>
        <table>
            <thead>
                <tr>
                    <th>PR Message</th>
                    <th>Commit</th>
                    <th>Author</th>
                    <th>Date</th>
                    <th>Link</th>
                </tr>
            </thead>
            <tbody>
EOF

git log --all --grep="Automatic merge from" --pretty=format:'%s|%h|%H|%an|%ar' -30 | while IFS='|' read -r subject short full author date; do
  PR_NUM=$(echo "$subject" | grep -o '#[0-9]\+' | head -1)
  echo "                <tr>" >> "$OUTPUT_FILE"
  echo "                    <td>$subject</td>" >> "$OUTPUT_FILE"
  echo "                    <td><code>$short</code></td>" >> "$OUTPUT_FILE"
  echo "                    <td>$author</td>" >> "$OUTPUT_FILE"
  echo "                    <td>$date</td>" >> "$OUTPUT_FILE"
  echo "                    <td><a href=\"$REPO_URL/pull/${PR_NUM#\#}\" target=\"_blank\">View PR</a></td>" >> "$OUTPUT_FILE"
  echo "                </tr>" >> "$OUTPUT_FILE"
done

cat >> "$OUTPUT_FILE" <<EOF
            </tbody>
        </table>

        <h2>🎯 Original PRs (Triggered Cascades)</h2>
        <table>
            <thead>
                <tr>
                    <th>Message</th>
                    <th>Commit</th>
                    <th>Author</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>
EOF

git log --all --grep="JIRA-\|fixed\|feat\|bug" --grep="Automatic merge" --invert-grep --pretty=format:'%s|%h|%H|%an|%ar' -20 | while IFS='|' read -r subject short full author date; do
  echo "                <tr>" >> "$OUTPUT_FILE"
  echo "                    <td>$subject</td>" >> "$OUTPUT_FILE"
  echo "                    <td><code><a href=\"$REPO_URL/commit/$full\" target=\"_blank\">$short</a></code></td>" >> "$OUTPUT_FILE"
  echo "                    <td>$author</td>" >> "$OUTPUT_FILE"
  echo "                    <td>$date</td>" >> "$OUTPUT_FILE"
  echo "                </tr>" >> "$OUTPUT_FILE"
done

cat >> "$OUTPUT_FILE" <<EOF
            </tbody>
        </table>
    </div>
</body>
</html>
EOF

echo "✅ HTML report generated: $OUTPUT_FILE"
echo "   Open in browser: open '$OUTPUT_FILE'"
