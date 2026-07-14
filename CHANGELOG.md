# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-07-14

### ⚠️ BREAKING CHANGES

- **Removed MISSING_CONFIG_BEHAVIOR environment variable**: The app now **always skips** cascade merge processing for repositories without a `.github/cascading-merge.yml` file
  - **Migration**: Remove `MISSING_CONFIG_BEHAVIOR` from your `.env` file
  - **Behavior change**: If you were relying on `use-defaults` behavior, you must now create `.github/cascading-merge.yml` files in each repository where you want cascade merging enabled
  - **Why**: This change enforces explicit opt-in, making org-wide installations safer and eliminating magic default values

### Removed

- `MISSING_CONFIG_BEHAVIOR` environment variable (no longer needed)
- `DEFAULT_CONFIG` constant from `src/types/config.ts` (no longer used)
- Fallback to default configuration values when config file is missing

### Changed

- **Explicit configuration required**: Repositories must have `.github/cascading-merge.yml` to enable cascade merging
- Simplified configuration loading logic - always returns `null` when config is missing
- Updated all documentation to reflect the new behavior
- Clearer log messages when skipping repositories without configuration

### Benefits

- ✅ **Safe org-wide installations**: Install across all repos without unexpected cascades
- ✅ **Explicit opt-in**: Only repos with config files are processed
- ✅ **No magic defaults**: No assumptions about branch names or prefixes
- ✅ **Clearer behavior**: Config file = cascades enabled, no config = skipped

## [1.1.0] - 2026-07-13

### Added

- **Verbose Reporting**: Optional `verbose: true` config creates GitHub Issues with:
  - Cascade trigger information (original PR details)
  - Table of all created cascade PRs with status
  - Mermaid gitGraph diagram visualizing the cascade flow
  - Issues are labeled with `cascade-report` for easy filtering
- **MISSING_CONFIG_BEHAVIOR Environment Variable**: Control app behavior for repos without config files
  - `use-defaults`: Use default settings (prefixes=['release/'], ref_branch='develop')
  - `skip`: Skip cascade processing for repos without explicit config
- Comprehensive sequence diagram documentation in `docs/cascade-sequence.md`

### Fixed

- **Bot PR Detection**: Cascade PRs created by the app no longer re-trigger cascade logic
  - Prevents "PR already exists" errors
  - Prevents cascade loop scenarios
  - Detection checks: PR author type === 'Bot' OR title starts with 'Automatic merge from'
- **Config Loading Bug**: `verbose` field now properly read from repository `.github/cascading-merge.yml`
- **Mermaid Diagram Rendering**: Visual flow now correctly shows feature branch as starting point (not "main")

### Changed

- Improved error logging with INFO/WARN/ERROR levels for better troubleshooting
- Quick Start Guide condensed to 5 minutes (from 10)
- Updated all documentation to reflect verbose reporting feature

## [1.0.0] - 2026-07-13

### Added

- Initial release of Cascading Merge GitHub App
- Translation from cascading-downstream-merge GitHub Action to GitHub App architecture
- Automatic cascade merging for release branches
- Repository-scoped configuration via `.github/cascading-merge.yml`
- Semantic version branch ordering algorithm (preserved from original Action)
- Automatic PR creation and merging
- Merge conflict detection and handling
- Issue creation for manual intervention scenarios
- Comprehensive error handling with user feedback
- Support for multiple branch prefixes (e.g., `release/`, `hotfix/`)
- Configurable reference branch (final merge target)
- Test suite with 7 comprehensive test cases
- Complete documentation:
  - Installation and setup guide
  - Configuration examples
  - Architecture Decision Record (ADR)
  - Deployment guide
  - Troubleshooting guide
  - Contributing guidelines

### Technical Details

- Built with Probot v13.3.8 framework
- TypeScript v5.9.3 with strict mode
- Node.js >= 20 required
- Jest testing framework with ts-jest
- ESLint and Prettier for code quality
- Docker support with health checks
- Multiple deployment options (VM, Docker, PaaS)

### Core Features

- **Probot Framework**: Modern GitHub App framework with TypeScript support
- **Repository Configuration**: Each repo controls its own cascade rules
- **Standard Installation Tokens**: No separate merge token required
- **Semantic Versioning Support**: Correctly orders branches like `1.1-rc1`, `1.2-a`, `2.0`
- **Error Recovery**: Graceful handling of conflicts, rate limits, and API errors
- **Issue Tracking**: Automatic issue creation with PR author assignment

### Documentation

- `README.md`: Complete installation, usage, and configuration guide
- `CONTRIBUTING.md`: Developer contribution guidelines
- `docs/adr-001-github-app-architecture.md`: Architecture decisions and rationale
- `docs/DEPLOYMENT.md`: Production deployment guide for multiple platforms
- `docs/TROUBLESHOOTING.md`: Comprehensive troubleshooting reference
- `.github/cascading-merge.yml.example`: Example configuration with detailed comments

### Known Limitations

- Does not bypass branch protection rules (by design)
- Requires public webhook URL for production deployment
- GitHub API rate limits apply (5,000/hour for standard apps)

---

## Future Considerations

### Potential Features for v2.0

- [ ] Web UI for configuration management
- [ ] Dashboard for cascade status across multiple repositories
- [ ] Advanced branch protection rule integration
- [ ] Custom merge strategies (squash, rebase)
- [ ] Scheduled cascade dry-runs
- [ ] Metrics and analytics dashboard
- [ ] Slack/Teams notification integration
- [ ] Custom merge commit messages
- [ ] Rollback capabilities
- [ ] Support for cross-repository cascades

### Under Consideration

- [ ] Multi-branch reference support (cascade to multiple final branches)
- [ ] Conditional cascades based on labels or paths
- [ ] Integration with CI/CD pipelines
- [ ] Custom webhook triggers beyond PR merge
- [ ] GraphQL API support for improved performance
- [ ] Caching layer for configuration and branch lists

---

[Unreleased]: https://github.com/YOUR_ORG/cascading-merge-app/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/YOUR_ORG/cascading-merge-app/releases/tag/v1.0.0
