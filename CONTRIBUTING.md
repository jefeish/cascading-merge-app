# Contributing to Cascading Merge App

Thank you for your interest in contributing to the Cascading Merge App! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)
- [Debugging](#debugging)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

### Prerequisites

- Node.js >= 20
- npm >= 10
- Git
- A GitHub account
- Basic understanding of TypeScript and GitHub Apps

### Initial Setup

1. Fork the repository on GitHub

2. Clone your fork:

   ```bash
   git clone https://github.com/YOUR_USERNAME/cascading-merge-app.git
   cd cascading-merge-app
   ```

3. Add the upstream remote:

   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/cascading-merge-app.git
   ```

4. Install dependencies:

   ```bash
   npm install
   ```

5. Create a test GitHub App (see [README.md](README.md#installation))

6. Set up your `.env` file:

   ```bash
   cp .env.example .env
   # Edit .env with your GitHub App credentials
   ```

7. Build the project:

   ```bash
   npm run build
   ```

8. Run tests to verify setup:
   ```bash
   npm test
   ```

## Development Workflow

### Branch Strategy

- `main` - Stable production code
- `develop` - Development integration branch
- Feature branches: `feature/description`
- Bug fixes: `fix/description`
- Documentation: `docs/description`

### Making Changes

1. Create a feature branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes with clear, focused commits:

   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

3. Keep your branch up to date:

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

4. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

## Testing

### Running Tests

Run all tests:

```bash
npm test
```

Run tests in watch mode during development:

```bash
npm test -- --watch
```

Run tests with coverage:

```bash
npm test -- --coverage
```

### Writing Tests

- Place test files in `__tests__/` directory
- Name test files with `.test.ts` suffix
- Follow the existing test patterns using Jest
- Aim for >80% code coverage on new code

Example test structure:

```typescript
import { jest } from '@jest/globals'
import { functionToTest } from '../src/lib/module.js'

describe('Module Name', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should do something specific', () => {
    // Arrange
    const input = 'test'

    // Act
    const result = functionToTest(input)

    // Assert
    expect(result).toBe('expected')
  })
})
```

## Code Style

### TypeScript Guidelines

- Use TypeScript strict mode (already configured)
- Prefer `interface` over `type` for object shapes
- Use explicit return types for functions
- Avoid `any` type unless absolutely necessary

### Formatting

We use Prettier for code formatting:

```bash
# Format all files
npm run format

# Check formatting without making changes
npm run format:check
```

### Linting

We use ESLint for code quality:

```bash
# Lint all files
npm run lint

# Auto-fix issues where possible
npm run lint -- --fix
```

### Commit Messages

Follow conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or changes
- `chore`: Build process or auxiliary tool changes

Examples:

```
feat(config): add support for multiple ref branches

Allows configuration of multiple final branches for cascade.
Closes #123

fix(merge): handle rate limit errors gracefully

Previously the app would crash on rate limit errors.
Now it retries with exponential backoff.

docs: update installation instructions
```

## Pull Request Process

### Before Submitting

1. ✅ All tests pass: `npm test`
2. ✅ Code is formatted: `npm run format`
3. ✅ No linting errors: `npm run lint`
4. ✅ Build succeeds: `npm run build`
5. ✅ Update documentation if needed
6. ✅ Add tests for new features

### Submitting a PR

1. Push your changes to your fork

2. Create a Pull Request on GitHub with:
   - Clear title following conventional commits format
   - Description of what changed and why
   - Reference to related issues
   - Screenshots/logs if applicable

3. PR template checklist:

   ```markdown
   ## Description

   Brief description of changes

   ## Type of Change

   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing

   - [ ] Tests pass locally
   - [ ] New tests added
   - [ ] Tested with real GitHub App

   ## Checklist

   - [ ] Code follows style guidelines
   - [ ] Self-reviewed code
   - [ ] Commented hard-to-understand areas
   - [ ] Updated documentation
   - [ ] No new warnings
   ```

4. Respond to review feedback promptly

5. Once approved, a maintainer will merge your PR

## Project Structure

```
cascading-merge-app/
├── src/
│   ├── index.ts              # Main app entry point
│   ├── lib/                  # Core library code
│   │   ├── cascading-branch-merge.ts  # Cascade logic
│   │   └── config.ts         # Configuration loader
│   └── types/                # TypeScript type definitions
│       └── config.ts         # Config interfaces
├── __tests__/                # Test files
│   └── cascading-branch-merge.test.ts
├── docs/                     # Documentation
│   ├── adr-001-github-app-architecture.md
│   ├── DEPLOYMENT.md
│   └── TROUBLESHOOTING.md
├── .github/                  # GitHub configs
│   └── cascading-merge.yml.example
├── dist/                     # Compiled JavaScript (generated)
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript config
├── jest.config.js            # Jest test config
├── .eslintrc.json           # ESLint config
└── .prettierrc              # Prettier config
```

### Key Files to Know

- **src/index.ts**: Webhook handlers, app initialization
- **src/lib/cascading-branch-merge.ts**: Core cascade algorithm (preserve carefully!)
- **src/lib/config.ts**: YAML configuration loading
- **src/types/config.ts**: TypeScript interfaces for config

## Debugging

### Local Development

1. Start the app in dev mode:

   ```bash
   npm run dev
   ```

2. Set debug logging:

   ```bash
   LOG_LEVEL=debug npm run dev
   ```

3. Use the webhook proxy to test with real events:
   ```bash
   # Terminal 1: Start smee proxy
   npx smee -u https://smee.io/YOUR_URL -t http://localhost:3000

   # Terminal 2: Start app
   npm run dev
   ```

### Testing Webhook Payloads

1. Create a webhook payload JSON file:

   ```json
   {
     "action": "closed",
     "pull_request": {
       "merged": true,
       "number": 1
     }
   }
   ```

2. Send it to your local app:
   ```bash
   curl -X POST \
     -H "Content-Type: application/json" \
     -H "X-GitHub-Event: pull_request" \
     -d @webhook-payload.json \
     http://localhost:3000
   ```

### Common Issues

- **TypeScript errors**: Run `npm run build` to see detailed errors
- **Test failures**: Check mock setup in `__tests__/`
- **Webhook not triggering**: Verify smee proxy is running and URL matches `.env`
- **Authentication errors**: Regenerate GitHub App credentials

## Getting Help

- 📖 Read the [README.md](README.md)
- 🔍 Check [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- 💬 Open a [GitHub Discussion](https://github.com/YOUR_ORG/cascading-merge-app/discussions)
- 🐛 Report bugs via [GitHub Issues](https://github.com/YOUR_ORG/cascading-merge-app/issues)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Cascading Merge App! 🎉
