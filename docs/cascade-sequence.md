# Cascading Merge App - Sequence Diagram

This document illustrates how the Cascading Merge App processes pull requests and creates cascading merges across release branches.

## Complete Cascade Flow

```mermaid
sequenceDiagram
    participant User
    participant GitHub
    participant App as Cascading Merge App
    participant Repo as Repository

    Note over User,Repo: User merges a PR into a release branch

    User->>GitHub: Merge PR #100 into release/1.0
    GitHub->>App: Webhook: pull_request.closed

    Note over App: Check if PR was merged
    App->>App: if (!pull_request.merged) return

    Note over App: Check if this is a bot-created PR
    App->>App: Is PR created by bot?

    alt Bot PR
        Note over App: Skip cascade logic (already processed)
        App->>GitHub: Exit
    else Human PR
        Note over App: Load configuration
        App->>Repo: GET .github/cascading-merge.yml
        Repo-->>App: prefixes, ref_branch, verbose

        Note over App: Validate base branch
        App->>App: Does release/1.0 match configured prefixes?

        Note over App: Calculate cascade order
        App->>Repo: GET branches
        Repo-->>App: Branch list
        App->>App: Sort by semantic version
        App->>App: Build cascade list

        loop Each target branch
            App->>GitHub: Create cascade PR
            GitHub-->>App: PR created

            App->>GitHub: Comment on PR #100

            App->>GitHub: Merge cascade PR

            alt Merge succeeded
                GitHub-->>App: PR merged
                App->>GitHub: Update comment
            else Merge conflict (405)
                GitHub-->>App: Merge conflict
                App->>GitHub: Create issue
                App->>GitHub: Comment "Cascade stopped"
            else PR already exists (422)
                GitHub-->>App: PR already exists
                App->>GitHub: Comment "Cascade stopped"
            end
        end

        App->>GitHub: Comment "Auto-merge successful"

        opt Verbose mode
            App->>GitHub: Create report issue
        end
    end

    Note over GitHub: Cascade PRs merge automatically

    GitHub->>App: Webhook for bot PR #101
    App->>App: Detect bot PR
    Note over App: Skip cascade

    GitHub->>App: Webhook for bot PR #102
    App->>App: Detect bot PR
    Note over App: Skip cascade

    Note over User,Repo: All changes cascaded
```

## Configuration Example

```yaml
# .github/cascading-merge.yml
prefixes:
  - 'release/'
  - 'hotfix/'

ref_branch: 'main'

verbose: true  # Creates report issue with Mermaid diagram
```

## Verbose Report Output

When `verbose: true`, the app creates a GitHub Issue after cascade completion:

### Sample Report
---

## 🔄 Cascade Merge Report

## Trigger Information
- **Original PR**: #100
- **Merged Branch**: `feature/xyz` → `release/1.0`
- **Total Cascade PRs**: 3 created, 0 skipped

## Cascade PRs
| PR # | Source Branch | Target Branch | Status |
|------|---------------|---------------|--------|
| #101 | `release/1.0` | `release/1.1` | ✅ Created & Merged |
| #102 | `release/1.1` | `release/2.0` | ✅ Created & Merged |
| #103 | `release/2.0` | `main` | ✅ Created & Merged |

## Visual Flow

```mermaid
%%{init: {'gitGraph': {'mainBranchName': 'jefeish-patch-16'}}}%%
gitGraph
  commit id: "PR #100"

  branch "release/1.0"
  checkout "release/1.0"
  commit id: "Merged feature/xyz"

  branch "release/1.1"
  checkout "release/1.1"
  commit id: "PR #101"

  branch "release/2.0"
  checkout "release/2.0"
  commit id: "PR #102"

  checkout "main"
  commit id: "PR #103"
```
---

## Branch Ordering Algorithm

The app uses **semantic version sorting** to determine cascade order:

```
release/1.0
release/1.1
release/1.1-rc.1
release/1.2
release/2.0
release/2.0.1-alpha
release/2.0.1-beta
main (ref_branch)
```

This ensures changes flow from oldest to newest versions, ending at the final reference branch.
