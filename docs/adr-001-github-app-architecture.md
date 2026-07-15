---
description: 'Architecture Decision Record for translating cascading-downstream-merge GitHub Action to a GitHub App'
date: 2026-07-10
status: Accepted
---

# ADR-001: GitHub Action to GitHub App Translation Architecture

**Date:** 2026-07-10
**Status:** Accepted
**Deciders:** Development Team

## Context

The `cascading-downstream-merge` GitHub Action successfully automates cascading merges across release branches using semantic versioning. However, GitHub Actions have inherent limitations, the one that concerns us most is the limit on Rulesets support for **Bypass-Actors** :

- **Token Management**: Complex handling of tokens for bypass permissions
- **PAT Token Rate Limits**: PAT's have a 5000 requests/hour limit
- **Requirement of Service Accounts**: PAT's should not be associated to specific user 
~~- **Workflow Dependency**: Requires users to configure workflows in each repository~~
~~- **Installation**: Each repository needs workflow file setup~~

We need to translate this functionality into a GitHub App to provide:

- One-time installation per organization/repository
- Centralized management and monitoring capabilities
- **Native GitHub App authentication with installation tokens (15000 requests/hour)**
- Simplified user experience with configuration-file-based setup (Yaml)

The core business logic must be preserved, including:

- Bitbucket branch ordering algorithm for semantic versioning
- Cascade merge orchestration
- Error handling and user feedback mechanisms

## Decision

### Framework Selection: Probot

**Decision:** Use Probot as the GitHub App framework.

**Rationale:**

- Most popular and mature GitHub App framework with TypeScript support
- Built-in webhook handling and routing
- Excellent developer experience with hot reloading
- Strong community and documentation
- Opinionated structure reduces boilerplate

**Alternatives Considered:**

- **Octokit App.js**: Lower-level, more control, but requires more boilerplate for webhook handling
- **Custom Express + Octokit**: Maximum control, but significant development overhead for webhook verification, routing, and error handling

### Configuration Strategy: Repository Config File

**Decision:** Use repository-scoped `.github/cascading-merge.yml` configuration file.

**Rationale:**

- Configuration versioned with code (GitOps approach)
- Easy to review and audit via pull requests
- No external configuration management needed
- Simple for users to understand and modify
- Follows GitHub conventions (`.github/` directory)

**Alternatives Considered:**

- **GitHub App Settings UI**: Would require building and hosting a separate configuration interface
- **Repository Variables/Secrets**: Less discoverable, not version-controlled, harder to review

### Deployment Target: Local Development First

**Decision:** Focus on local development environment with smee.io/ngrok for webhook forwarding.

**Rationale:**

- Faster iteration during initial development
- No cloud infrastructure costs during development phase
- Easier debugging and testing
- Cloud deployment can be added later without architecture changes

**Alternatives Considered:**

- **Cloud Service First**: Premature optimization; adds deployment complexity before core functionality is validated
- **Both Simultaneously**: Would split focus and slow down initial development

### Test Strategy: Full Migration

**Decision:** Migrate all existing Jest tests from the Action to the App architecture.

**Rationale:**

- Existing tests provide comprehensive coverage of edge cases
- Validates business logic preservation during translation
- Maintains quality bar from original Action
- Reduces regression risk

**Alternatives Considered:**

- **Tests Later**: Would risk introducing bugs during translation without validation
- **Minimal Tests Only**: Would lose coverage of edge cases already captured in Action tests

### Authentication Strategy: Standard Installation Token

**Decision:** Use standard GitHub App installation tokens only; remove support for separate merge tokens.

**Rationale:**

- Simpler architecture with single authentication mechanism
- GitHub App installation tokens can be granted appropriate permissions
- Reduces configuration complexity for users
- Modern GitHub best practice

**Alternatives Considered:**

- **Configurable PAT per Repository**: Adds complexity, security concerns, and user configuration burden
- **App Token + Optional PAT**: Maintains dual authentication paths, increases testing surface

## Consequences

### Positive

1. **Simplified Installation**: Users install App once instead of configuring workflows in each repository
2. **Better Authentication**: Native GitHub App tokens eliminate manual token management
3. **Improved Developer Experience**: Probot framework reduces boilerplate and provides excellent tooling
4. **Version-Controlled Config**: Configuration changes go through standard PR review process
5. **Preserved Business Logic**: All cascade merge functionality, semantic versioning, and error handling remains intact
6. **Comprehensive Testing**: Full test migration ensures behavior parity with Action

### Negative

1. **Hosting Requirement**: App requires a running server (unlike Actions which are serverless from user perspective)
2. **Learning Curve**: Team needs to learn Probot and GitHub App development patterns
3. **Initial Setup Overhead**: Users must configure webhook forwarding for local development
4. **Branch Protection Complexity**: App needs explicit bypass permissions or branch protection configuration

### Risks

1. **API Rate Limits**: Webhook-based Apps may hit rate limits differently than Actions; monitoring needed
2. **Webhook Delivery**: Dependent on GitHub webhook reliability; need retry/recovery strategy
3. **Installation Token Permissions**: Some edge cases may require permissions not granted during initial installation

## Implementation Notes

### Architecture Translation Map

```text
GitHub Action → GitHub App
├─ @actions/core → app.log (Probot logger)
├─ @actions/github.context → context (Probot context)
├─ github.context.payload → context.payload
├─ new Octokit({ auth: token }) → context.octokit
└─ core.getInput() → Config parser + webhook payload
```

### Preserved Components (No Changes)

- `bitbucketBranchOrderingAlgorithm()` - Semantic version sorting
- `getBranchMergeOrder()` - Branch ordering logic
- Overall cascade flow structure
- Error handling patterns (adapted for Probot logging)

### Required GitHub App Permissions

- **Contents**: Read & Write (access config file, create branches)
- **Pull Requests**: Read & Write (create and merge PRs)
- **Issues**: Read & Write (create issues and comments)
- **Metadata**: Read (standard)
- **Optional**: Bypass branch protections (for auto-merge on protected branches)

### Webhook Subscriptions

- `pull_request` event with `closed` action filter

## References

- Original Action: [cascading-downstream-merge](https://github.com/ActionsDesk/cascading-downstream-merge)
- Probot Framework: <https://probot.github.io/>
- Bitbucket Cascade Merge Algorithm: <https://confluence.atlassian.com/bitbucketserver/cascading-merge-776639993.html>
- GitHub App Documentation: <https://docs.github.com/en/apps>

## Future Considerations

Post-MVP enhancements to consider:

- Dashboard UI for monitoring cascade status across repositories
- Slack/Teams notification integrations
- Dry-run mode for preview before execution
- Cascade history tracking and analytics
- Multi-organization deployment tooling
- Cloud deployment guides (Azure, AWS, GCP)
