# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
