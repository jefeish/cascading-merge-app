# Testing Guide

This document describes the test suite for the Cascading Merge App, including test structure, execution, and coverage.

## Quick Start

```bash
npm run test            # Run all 37 tests once
npm run test:watch      # Watch mode (re-runs on file changes)
npm run test:coverage   # Run with a coverage report
npx jest -t "UC-05"     # Run a single case by its ID
```

Jest runs in verbose mode, so every case is printed with its `describe` group, ID, name, and
duration:

```text
Cascading Branch Merge
  Cascade merge flow
    ✓ UC-01: Performs a simple cascade (8 ms)
    ✓ UC-02: Fixing a conflict continues the cascade (2 ms)
  Depth limits and final ref_branch merge
    ✓ UC-04: Still performs final ref_branch merge when maxMergeDepth is reached (1 ms)
    ...
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

The `NODE_OPTIONS` flag is mandatory. Running bare `npx jest` fails every suite with
"Jest encountered an unexpected token", because the ESM transform cannot load without it.

`tsconfig.json` sets `isolatedModules: true`, which ts-jest requires alongside
`module: NodeNext`; without it ts-jest emits a `TS151002` warning on every run.

### Coverage

`npm run test:coverage` writes reports to `coverage/` in three formats:

- **text** — Console output summary
- **lcov** — For IDE integration
- **html** — Visual report (open `coverage/index.html` in browser)

**Coverage includes:**

- All TypeScript files in `src/`
- **Excludes:** `.d.ts` files and anything in `__tests__/`

Current state of the library code under test:

| File                                | Statements | Branches | Lines |
| ----------------------------------- | ---------- | -------- | ----- |
| `src/lib/cascading-branch-merge.ts` | 100%       | 90%      | 100%  |
| `src/lib/depth-control.ts`          | 100%       | 91%      | 100%  |
| `src/lib/config.ts`                 | 77%        | 78%      | 77%   |

`src/index.ts` (the Probot event wiring) has no unit tests; it is exercised manually or through
a real installation.

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

| ID    | Use case                         | Scenario                                                             | Expected outcome                                                         |
| ----- | -------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| UC-01 | Full cascade in semantic order   | head `my-feature`, base `release/1.0`, ref `develop`, no depth limit | 10 PRs created and merged, `release/1.0` → … → `release/2.0` → `develop` |
| UC-02 | Re-run after a conflict is fixed | head `release/1.2`, base `release/1.3`                               | Cascade resumes from `release/1.3`, 2 PRs                                |
| UC-03 | Originating PR title and source  | title and source label supplied                                      | Downstream `commit_title` is `PR #1 from <source>: <title>`              |

#### Depth limits and final ref_branch merge

| ID    | Use case                               | Scenario                                     | Expected outcome                                                                         |
| ----- | -------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| UC-04 | Final ref merge after the limit        | base `release/1.0`, ref `develop`, depth `2` | 2 normal hops, then a forced 3rd PR into `develop`; "Performed a final merge" comment    |
| UC-05 | Limit lands on the last release branch | base `release/1.3`, ref `develop`, depth `1` | Forced final PR `release/2.0` → `develop` still happens (regression: previously skipped) |
| UC-06 | Global depth cap attribution           | verbose on, depth `2`, source `global`       | Report notes `maxMergeDepth reached (global cap: 2)`                                     |
| UC-07 | No `ref_branch` configured             | ref `undefined`, no depth limit              | Cascade ends at the last release branch; no final merge                                  |

#### Failure handling

| ID    | Use case                    | Scenario                                             | Expected outcome                                      |
| ----- | --------------------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| UC-08 | No commits between branches | `pulls.create` → `422 No commits between`            | Hop is skipped, cascade continues, run still succeeds |
| UC-09 | Duplicate PR already open   | `pulls.create` → `422 A pull request already exists` | Cascade stops, warning comment, no issue created      |
| UC-10 | Unhandled PR-creation error | `pulls.create` → `500`                               | Issue opened and assigned to the actor, cascade stops |
| UC-11 | Merge conflict              | `pulls.merge` → `405`                                | Conflict issue opened and assigned, cascade stops     |
| UC-12 | Unhandled merge error       | `pulls.merge` → `500`                                | Issue opened, failure comment, cascade stops          |

#### Merge list construction

| ID    | Use case                                 | Scenario                               | Expected outcome                                              |
| ----- | ---------------------------------------- | -------------------------------------- | ------------------------------------------------------------- |
| UC-13 | Head list runs before base list          | head `release/1.3`, base `release/2.0` | `release/1.3` → `release/2.0`, then `release/2.0` → `develop` |
| UC-14 | `ref_branch` already terminates the list | base `release/1.3`, ref `release/2.0`  | `ref_branch` is not appended twice; 1 PR only                 |
| UC-15 | No branch matches the prefixes           | prefixes `['hotfix/']`                 | No PRs, only the success comment                              |

#### Depth limit edge cases

| ID    | Use case                                | Scenario                                               | Expected outcome                                                         |
| ----- | --------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| UC-16 | Limit reached on the head list          | head `release/1.0`, base `release/1.3`, depth `2`      | Stops after 2 PRs; "Stopping cascade early" comment, no forced ref merge |
| UC-17 | `maxMergeDepth: 0` with `ref_branch`    | base `release/1.0`, ref `develop`, depth `0`           | Single PR straight into `develop`                                        |
| UC-18 | `maxMergeDepth: 0` without `ref_branch` | ref `undefined`, depth `0`                             | No PRs; "Stopping cascade early" comment                                 |
| UC-19 | Forced final merge has no commits       | depth `1`, forced hop returns `422 No commits between` | Skip is recorded and still counts as the final ref merge                 |
| UC-25 | Cascade shorter than the cap            | base `release/1.3` (2 hops), ref `develop`, depth `5`  | Both hops run, last PR targets `develop`, no depth-limit comment         |
| UC-26 | Cascade length exactly equals the cap   | base `release/1.3` (2 hops), ref `develop`, depth `2`  | Both hops run, last PR targets `develop`, no depth-limit comment         |

#### Verbose cascade report

| ID    | Use case                       | Scenario                             | Expected outcome                                             |
| ----- | ------------------------------ | ------------------------------------ | ------------------------------------------------------------ |
| UC-20 | Repo depth cap attribution     | verbose on, depth `2`, source `repo` | Report notes `maxMergeDepth reached (repo-level setting: 2)` |
| UC-21 | Cascade within the limit       | verbose on, depth `5`, 1 hop needed  | Report contains no depth note                                |
| UC-22 | Report issue cannot be created | verbose on, `issues.create` rejects  | Error is swallowed; the cascade is still reported successful |

#### Downstream merge commit metadata

| ID    | Use case                | Scenario                        | Expected outcome                                                  |
| ----- | ----------------------- | ------------------------------- | ----------------------------------------------------------------- |
| UC-23 | Originating title only  | title supplied, no source label | `commit_title` is the bare title                                  |
| UC-24 | No originating metadata | neither supplied                | `pulls.merge` is called without `commit_title` / `commit_message` |

### Configuration loading (`__tests__/config.test.ts`)

| ID     | Use case         | Input                  | Expected outcome                                                       |
| ------ | ---------------- | ---------------------- | ---------------------------------------------------------------------- |
| CFG-01 | Depth omitted    | `prefixes: [release/]` | `maxMergeDepth` is `undefined` (unlimited)                             |
| CFG-02 | Depth provided   | `maxMergeDepth: 3`     | Parsed as `3`                                                          |
| CFG-03 | Invalid depth    | `maxMergeDepth: 0`     | Throws `"maxMergeDepth" must be an integer greater than or equal to 1` |
| CFG-04 | Blank ref branch | `ref_branch: '   '`    | Throws `"ref_branch" must be a non-empty string when provided`         |

### Depth resolution (`__tests__/depth-control.test.ts`)

| ID     | Use case              | Input                      | Expected outcome          |
| ------ | --------------------- | -------------------------- | ------------------------- |
| DEP-01 | No global env var     | `{}`                       | `undefined`               |
| DEP-02 | `MAX_MERGE_DEPTH` set | `{ MAX_MERGE_DEPTH: '5' }` | `5`                       |
| DEP-03 | `maxMergeDepth` set   | `{ maxMergeDepth: '4' }`   | `4`                       |
| DEP-04 | Invalid global values | `'0'`, `'2.5'`, `'abc'`    | Throws a validation error |
| DEP-05 | Repo only             | `(3, undefined)`           | `3`                       |
| DEP-06 | Global only           | `(undefined, 5)`           | `5`                       |
| DEP-07 | Global caps repo      | `(10, 5)` / `(2, 5)`       | `5` / `2`                 |

---

## Test Suites

### 1. Cascading Branch Merge Tests

**File:** `__tests__/cascading-branch-merge.test.ts` — 26 cases, `UC-01` through `UC-26`

**Purpose:** Validates `cascadingBranchMerge()`, the core logic that walks the version chain and
creates one pull request per hop.

Individual cases are listed in the matrix above. The suite covers branch discovery and ordering,
merge list construction, depth limiting and the final `ref_branch` merge, GitHub API failure
paths, the verbose cascade report, and downstream merge commit metadata.

#### Test Setup

The whole Octokit client is mocked, so no network calls are made:

```typescript
mockOctokit.paginate.mockResolvedValue([
  { name: 'release/1.0' },
  { name: 'release/1.1-3' },
  { name: 'release/1.1-rc1' },
  // ... deliberately unordered
  { name: 'release/2.0' },
  { name: 'develop' }
])
```

The fixture is deliberately unordered, so the ordering algorithm is exercised on every run.
`UC-01` asserts that the full 10-hop chain `release/1.0` → … → `release/2.0` → `develop` is created
in exactly that order, which pins both the semantic ordering and the merge direction.

---

### 2. Configuration Loading Tests

**File:** `__tests__/config.test.ts` — 4 cases, `CFG-01` through `CFG-04`

**Purpose:** Validates that `loadConfig()` parses and validates `cascading-merge.yml`:

```yaml
# cascading-merge.yml
prefixes:
  - release/
ref_branch: develop
maxMergeDepth: 3
verbose: false
```

#### Why This Matters

Configuration errors should fail fast with clear messages. These tests ensure:

- Invalid configs are rejected before they cause cascades to fail
- Users get helpful error messages
- Defaults are sensible (unlimited depth, no ref_branch requirement)

---

### 3. Depth Control Tests

**File:** `__tests__/depth-control.test.ts` — 7 cases, `DEP-01` through `DEP-07`

**Purpose:** Validates cascade depth limit resolution between environment variables and
repo-level config, across two functions:

1. `parseGlobalMaxMergeDepth()` — Parses the `MAX_MERGE_DEPTH` / `maxMergeDepth` environment
   variables (`DEP-01` … `DEP-04`)
2. `resolveEffectiveMaxMergeDepth()` — Resolves which depth limit applies (`DEP-05` … `DEP-07`)

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
    }
    // ...
  }
}
```

**Benefits:**

- Tests run in **milliseconds** (not seconds)
- No rate limiting or network dependency
- Deterministic results
- Safe to run in CI/CD

**Before each test:** `jest.clearAllMocks()` ensures no test pollution. Cases that need a
different API response override a single mock in the test body, for example
`mockOctokit.rest.pulls.create.mockRejectedValueOnce(...)` in `UC-19`.

---

## Running Tests Locally

```bash
# Run all tests once
npm run test

# Watch mode: re-run tests on file changes
npm run test:watch

# Generate coverage report
npm run test:coverage
# View: open coverage/index.html

# Run a single case by ID or a whole group by describe name
npx jest -t "UC-05"
npx jest -t "Depth limit edge cases"
```

## Continuous Integration

[.github/workflows/test.yml](../.github/workflows/test.yml) runs `npm ci`, `npm run build`, and
`npm test` on every push and pull request against `main`, and on manual dispatch. Because verbose
mode is set in `jest.config.js` rather than as a CLI flag, the Actions log shows the same
per-case tree you see locally.

---

## Adding New Tests

When adding new features:

1. **Create test file** in `__tests__/` with `.test.ts` suffix
2. **Mock external dependencies** (GitHub API, file system, etc.)
3. **Test behavior, not implementation** — verify outputs given inputs
4. **Keep tests focused** — one test per logical scenario
5. **Prefix the name with the next free ID** — `UC-xx` for cascade behaviour, `CFG-xx` for config
   loading, `DEP-xx` for depth resolution
6. **Add a row to the matrix** in this file, under the `describe` block the test belongs to

Example:

```typescript
import { jest } from '@jest/globals'
import { myNewFunction } from '../src/lib/my-module.js'

describe('My New Feature', () => {
  it('UC-27: does X when given Y', async () => {
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
   npm run test:watch -- --testNamePattern="UC-01"
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
   it.only('UC-01: Performs a simple cascade', async () => { ... })
   ```

5. **Read the error message** carefully — Jest provides detailed assertion diffs.
