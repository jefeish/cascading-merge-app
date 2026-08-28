# Testing Guide

This document describes the test suite for the Cascading Merge App, including test structure, execution, and coverage.

## Quick Start

Run tests with:

```bash
npm run test          # Run all tests once
npm run test:watch   # Run tests in watch mode (re-runs on file changes)
```

## Test Setup

The project uses **Jest** as the test framework with TypeScript support via **ts-jest**.

**Configuration file:** [jest.config.js](../jest.config.js)

### How Tests Run

```bash
npm run test
# Executes: NODE_OPTIONS=--experimental-vm-modules NODE_NO_WARNINGS=1 jest
```

**Flags explained:**
- `NODE_OPTIONS=--experimental-vm-modules` — Enables ES module support in Node
- `NODE_NO_WARNINGS=1` — Suppresses Node warnings during test execution
- `jest` — Runs all tests matching `**/__tests__/**/*.test.ts`

### Coverage

Tests generate coverage reports in `coverage/` directory in three formats:
- **text** — Console output summary
- **lcov** — For IDE integration
- **html** — Visual report (open `coverage/index.html` in browser)

**Coverage includes:**
- All TypeScript files in `src/`
- **Excludes:** `.d.ts` files and anything in `__tests__/`

---

## Use Case / Test Case Matrix

Every test carries a stable ID (`UC-xx`, `CFG-xx`, `DEP-xx`) as a prefix in its name, so a Jest
failure maps directly back to a row in these tables. Filter a single case with
`npx jest -t "UC-05"`.

Jest runs in verbose mode, so `npm run test` prints the full suite tree. The subsections below
match the `describe` blocks in that output one for one.

### Cascade behaviour (`__tests__/cascading-branch-merge.test.ts`)

Branch fixture used by all cases:
`release/1.0`, `release/1.1`, `release/1.1-1`, `release/1.1-2`, `release/1.1-3`,
`release/1.1-rc1`, `release/1.2-a`, `release/1.2-b`, `release/1.3`, `release/2.0`, `develop`.

#### Cascade merge flow

| ID | Use case | Scenario | Expected outcome |
|----|----------|----------|------------------|
| UC-01 | Full cascade in semantic order | head `my-feature`, base `release/1.0`, ref `develop`, no depth limit | 10 PRs created and merged, `release/1.0` → … → `release/2.0` → `develop` |
| UC-02 | Re-run after a conflict is fixed | head `release/1.2`, base `release/1.3` | Cascade resumes from `release/1.3`, 2 PRs |
| UC-03 | Originating PR title and source | title and source label supplied | Downstream `commit_title` is `PR #1 from <source>: <title>` |

#### Depth limits and final ref_branch merge

| ID | Use case | Scenario | Expected outcome |
|----|----------|----------|------------------|
| UC-04 | Final ref merge after the limit | base `release/1.0`, ref `develop`, depth `2` | 2 normal hops, then a forced 3rd PR into `develop`; "Performed a final merge" comment |
| UC-05 | Limit lands on the last release branch | base `release/1.3`, ref `develop`, depth `1` | Forced final PR `release/2.0` → `develop` still happens (regression: previously skipped) |
| UC-06 | Global depth cap attribution | verbose on, depth `2`, source `global` | Report notes `maxMergeDepth reached (global cap: 2)` |
| UC-07 | No `ref_branch` configured | ref `undefined`, no depth limit | Cascade ends at the last release branch; no final merge |

#### Failure handling

| ID | Use case | Scenario | Expected outcome |
|----|----------|----------|------------------|
| UC-08 | No commits between branches | `pulls.create` → `422 No commits between` | Hop is skipped, cascade continues, run still succeeds |
| UC-09 | Duplicate PR already open | `pulls.create` → `422 A pull request already exists` | Cascade stops, warning comment, no issue created |
| UC-10 | Unhandled PR-creation error | `pulls.create` → `500` | Issue opened and assigned to the actor, cascade stops |
| UC-11 | Merge conflict | `pulls.merge` → `405` | Conflict issue opened and assigned, cascade stops |
| UC-12 | Unhandled merge error | `pulls.merge` → `500` | Issue opened, failure comment, cascade stops |

#### Merge list construction

| ID | Use case | Scenario | Expected outcome |
|----|----------|----------|------------------|
| UC-13 | Head list runs before base list | head `release/1.3`, base `release/2.0` | `release/1.3` → `release/2.0`, then `release/2.0` → `develop` |
| UC-14 | `ref_branch` already terminates the list | base `release/1.3`, ref `release/2.0` | `ref_branch` is not appended twice; 1 PR only |
| UC-15 | No branch matches the prefixes | prefixes `['hotfix/']` | No PRs, only the success comment |

#### Depth limit edge cases

| ID | Use case | Scenario | Expected outcome |
|----|----------|----------|------------------|
| UC-16 | Limit reached on the head list | head `release/1.0`, base `release/1.3`, depth `2` | Stops after 2 PRs; "Stopping cascade early" comment, no forced ref merge |
| UC-17 | `maxMergeDepth: 0` with `ref_branch` | base `release/1.0`, ref `develop`, depth `0` | Single PR straight into `develop` |
| UC-18 | `maxMergeDepth: 0` without `ref_branch` | ref `undefined`, depth `0` | No PRs; "Stopping cascade early" comment |
| UC-19 | Forced final merge has no commits | depth `1`, forced hop returns `422 No commits between` | Skip is recorded and still counts as the final ref merge |

#### Verbose cascade report

| ID | Use case | Scenario | Expected outcome |
|----|----------|----------|------------------|
| UC-20 | Repo depth cap attribution | verbose on, depth `2`, source `repo` | Report notes `maxMergeDepth reached (repo-level setting: 2)` |
| UC-21 | Cascade within the limit | verbose on, depth `5`, 1 hop needed | Report contains no depth note |
| UC-22 | Report issue cannot be created | verbose on, `issues.create` rejects | Error is swallowed; the cascade is still reported successful |

#### Downstream merge commit metadata

| ID | Use case | Scenario | Expected outcome |
|----|----------|----------|------------------|
| UC-23 | Originating title only | title supplied, no source label | `commit_title` is the bare title |
| UC-24 | No originating metadata | neither supplied | `pulls.merge` is called without `commit_title` / `commit_message` |

### Configuration loading (`__tests__/config.test.ts`)

| ID | Use case | Input | Expected outcome |
|----|----------|-------|------------------|
| CFG-01 | Depth omitted | `prefixes: [release/]` | `maxMergeDepth` is `undefined` (unlimited) |
| CFG-02 | Depth provided | `maxMergeDepth: 3` | Parsed as `3` |
| CFG-03 | Invalid depth | `maxMergeDepth: 0` | Throws `"maxMergeDepth" must be an integer greater than or equal to 1` |
| CFG-04 | Blank ref branch | `ref_branch: '   '` | Throws `"ref_branch" must be a non-empty string when provided` |

### Depth resolution (`__tests__/depth-control.test.ts`)

| ID | Use case | Input | Expected outcome |
|----|----------|-------|------------------|
| DEP-01 | No global env var | `{}` | `undefined` |
| DEP-02 | `MAX_MERGE_DEPTH` set | `{ MAX_MERGE_DEPTH: '5' }` | `5` |
| DEP-03 | `maxMergeDepth` set | `{ maxMergeDepth: '4' }` | `4` |
| DEP-04 | Invalid global values | `'0'`, `'2.5'`, `'abc'` | Throws a validation error |
| DEP-05 | Repo only | `(3, undefined)` | `3` |
| DEP-06 | Global only | `(undefined, 5)` | `5` |
| DEP-07 | Global caps repo | `(10, 5)` / `(2, 5)` | `5` / `2` |

---

## Test Suites

### 1. Cascading Branch Merge Tests

**File:** `__tests__/cascading-branch-merge.test.ts`

**Purpose:** Validates the core merge cascade logic that creates pull requests up the version chain.

#### What It Tests

The `cascadingBranchMerge()` function is the heart of the app. This test verifies it:
- Fetches all branches from the repository
- Filters branches by configured prefix(es)
- Sorts branches by semantic version in ascending order
- Creates pull requests in the correct sequence

#### Test Setup

The test mocks the entire Octokit GitHub API client:

```typescript
mockOctokit.paginate.mockResolvedValue([
  { name: 'release/1.0' },
  { name: 'release/1.1-3' },
  { name: 'release/1.1-rc1' },
  { name: 'release/1.1-2' },
  { name: 'release/1.1' },
  // ... more branches
  { name: 'release/2.0' },
  { name: 'develop' }
])
```

This simulates a repository with branches in random order, which the function must sort and cascade.

#### Test Case: "Performs a simple cascade"

**Input:**
- Prefixes: `['release/']`
- Reference branch: `'develop'`
- Current branch: `'release/1.0'`
- Owner: `'test-owner'`
- Repo: `'test-repo'`

**Expected behavior:**
The function should create 10 pull requests in this exact order:

1. `release/1.0` → `release/1.1` (merge 1.0 into 1.1)
2. `release/1.1` → `release/1.1-1` (merge 1.1 into 1.1-1)
3. `release/1.1-1` → `release/1.1-2` (merge 1.1-1 into 1.1-2)
4. `release/1.1-2` → `release/1.1-3` (merge 1.1-2 into 1.1-3)
5. `release/1.1-3` → `release/1.1-rc1` (merge 1.1-3 into 1.1-rc1)
6. `release/1.1-rc1` → `release/1.2-a` (merge 1.1-rc1 into 1.2-a)
7. `release/1.2-a` → `release/1.2-b` (merge 1.2-a into 1.2-b)
8. `release/1.2-b` → `release/1.3` (merge 1.2-b into 1.3)
9. `release/1.3` → `release/2.0` (merge 1.3 into 2.0)
10. `release/2.0` → `develop` (merge 2.0 into develop)

**Assertions:**
```typescript
expect(mockOctokit.paginate).toHaveBeenCalledWith(
  mockOctokit.rest.repos.listBranches,
  { owner: mockOwner, repo: mockRepo }
)

expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(10)

// Verify each PR was created with correct base and head
expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(1, {
  owner: mockOwner,
  repo: mockRepo,
  base: 'release/1.1',
  head: 'release/1.0',
  title: expect.anything(),
  body: expect.anything()
})
// ... and so on for all 10 calls
```

**Why this matters:** This test ensures the cascade respects semantic versioning and merges in the correct direction (oldest → newest).

---

### 2. Configuration Loading Tests

**File:** `__tests__/config.test.ts`

**Purpose:** Validates parsing and validation of the `cascading-merge.yml` configuration file.

#### What It Tests

The `loadConfig()` function reads and validates the YAML configuration:

```yaml
# cascading-merge.yml
prefixes:
  - release/
ref_branch: develop
maxMergeDepth: 3
verbose: false
```

#### Test Cases

**Test 1: "uses unlimited depth when maxMergeDepth is omitted"**
- Input YAML: `prefixes: [release/]`
- Expected result: `{ prefixes: ['release/'], maxMergeDepth: undefined }`
- **Purpose:** Verify default behavior allows unlimited cascades

**Test 2: "parses maxMergeDepth when provided"**
- Input YAML: `prefixes: [release/]\nref_branch: develop\nmaxMergeDepth: 3`
- Expected result: `{ maxMergeDepth: 3 }`
- **Purpose:** Verify explicit depth limits are parsed correctly

**Test 3: "rejects invalid maxMergeDepth values"**
- Input: `maxMergeDepth: 0`
- Expected: Throws error `'Configuration error: "maxMergeDepth" must be an integer greater than or equal to 1 when provided'`
- **Purpose:** Prevent invalid configurations at load time

**Test 4: "rejects empty ref_branch when explicitly provided"**
- Input: `ref_branch: '   '` (whitespace-only)
- Expected: Throws error `'Configuration error: "ref_branch" must be a non-empty string when provided'`
- **Purpose:** Catch configuration mistakes early

#### Why This Matters

Configuration errors should fail fast with clear messages. These tests ensure:
- Invalid configs are rejected before they cause cascades to fail
- Users get helpful error messages
- Defaults are sensible (unlimited depth, no ref_branch requirement)

---

### 3. Depth Control Tests

**File:** `__tests__/depth-control.test.ts`

**Purpose:** Validates cascade depth limit resolution between environment variables and repo-level config.

#### What It Tests

Two key functions:
1. `parseGlobalMaxMergeDepth()` — Parses environment variables
2. `resolveEffectiveMaxMergeDepth()` — Resolves which depth limit applies

#### Test Cases

**Global Environment Variable Parsing:**

Test 1: "returns undefined when global env var is not set"
```typescript
parseGlobalMaxMergeDepth({})  // No env vars
// → undefined (no limit)
```

Test 2: "parses MAX_MERGE_DEPTH when provided"
```typescript
parseGlobalMaxMergeDepth({ MAX_MERGE_DEPTH: '5' })
// → 5
```

Test 3: "parses maxMergeDepth when provided"
```typescript
parseGlobalMaxMergeDepth({ maxMergeDepth: '4' })
// → 4
```

Test 4: "rejects invalid global depth values"
```typescript
parseGlobalMaxMergeDepth({ MAX_MERGE_DEPTH: '0' })
// → Throws: "must be >= 1"

parseGlobalMaxMergeDepth({ MAX_MERGE_DEPTH: '2.5' })
// → Throws: "must be integer"

parseGlobalMaxMergeDepth({ MAX_MERGE_DEPTH: 'abc' })
// → Throws: "must be integer"
```

**Depth Resolution Logic:**

Test 5: "uses repo-level depth when global cap is not set"
```typescript
resolveEffectiveMaxMergeDepth(3, undefined)
// → 3 (repo setting wins)
```

Test 6: "uses global cap when repo-level depth is not set"
```typescript
resolveEffectiveMaxMergeDepth(undefined, 5)
// → 5 (global setting wins)
```

Test 7: "applies global cap as hard upper bound"
```typescript
resolveEffectiveMaxMergeDepth(10, 5)
// → 5 (global 5 caps repo's 10)

resolveEffectiveMaxMergeDepth(2, 5)
// → 2 (repo's 2 is lower than global 5)
```

#### Why This Matters

The depth control system prevents runaway cascades:
- **Global limit** (`MAX_MERGE_DEPTH` env var) — Set by app operator as safety net
- **Repo-level limit** (`maxMergeDepth` in config) — Set per-repository
- **Resolution rule:** Global limit is a hard cap; repo can be lower but not higher

These tests ensure the safety mechanism works correctly across both configuration sources.

---

## Mock Strategy

All tests use **Jest mocks** instead of hitting the real GitHub API:

```typescript
const mockOctokit = {
  rest: {
    repos: {
      listBranches: jest.fn()
    },
    pulls: {
      create: jest.fn()
    },
    // ...
  }
}
```

**Benefits:**
- Tests run in **milliseconds** (not seconds)
- No rate limiting or network dependency
- Deterministic results
- Safe to run in CI/CD

**Before each test:** `jest.clearAllMocks()` ensures no test pollution.

---

## Running Tests Locally

```bash
# Run all tests once
npm run test

# Watch mode: re-run tests on file changes
npm run test:watch

# Generate coverage report
npm run test
# View: open coverage/index.html
```

## Continuous Integration

The app uses GitHub Actions to run tests on every push and pull request. Configuration typically lives in `.github/workflows/test.yml`.

---

## Adding New Tests

When adding new features:

1. **Create test file** in `__tests__/` with `.test.ts` suffix
2. **Mock external dependencies** (GitHub API, file system, etc.)
3. **Test behavior, not implementation** — verify outputs given inputs
4. **Keep tests focused** — one test per logical scenario
5. **Use descriptive names** — `it('should merge branches in semantic version order', () => {})`

Example:
```typescript
import { jest } from '@jest/globals'
import { myNewFunction } from '../src/lib/my-module.js'

describe('My New Feature', () => {
  it('should do X when given Y', async () => {
    const mockDep = jest.fn().mockResolvedValue(expectedValue)
    
    const result = await myNewFunction(mockDep)
    
    expect(result).toBe(expectedValue)
    expect(mockDep).toHaveBeenCalledWith(expectedArgs)
  })
})
```

---

## Debugging Failed Tests

If a test fails:

1. **Run in watch mode** with filtered test name:
   ```bash
   npm run test:watch -- --testNamePattern="Performs a simple cascade"
   ```

2. **Add debug logging**:
   ```typescript
   console.log('Debug info:', someVariable)
   ```

3. **Check mock calls**:
   ```typescript
   console.log(mockOctokit.rest.pulls.create.mock.calls)
   ```

4. **Temporarily focus** on one test:
   ```typescript
   it.only('Performs a simple cascade', async () => { ... })
   ```

5. **Read the error message** carefully — Jest provides detailed assertion diffs.
