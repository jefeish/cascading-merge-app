import {
  buildCascadePrBody,
  buildRepairPrBody,
  CASCADE_METADATA_VERSION,
  type CascadeMetadata,
  type CascadeRepairMetadata
} from '../src/lib/cascade-metadata.js'
import {
  classifyPullRequest,
  shouldProcessCascadeBase
} from '../src/lib/pull-request-routing.js'

const repository = 'octo/repo'
const continuation: CascadeMetadata = {
  version: CASCADE_METADATA_VERSION,
  kind: 'cascade',
  originatingPr: 10,
  sourceBranch: 'release/1.0',
  targetBranch: 'release/1.1',
  remainingDepth: 2,
  maxMergeDepth: 5
}
const repair: CascadeRepairMetadata = {
  version: CASCADE_METADATA_VERSION,
  kind: 'repair',
  originatingPr: 10,
  stalledPr: 11,
  repairBranch: 'cascade-fix/11-aaaaaaa-bbbbbbb',
  protectedSourceBranch: 'release/1.0',
  stalledTargetBranch: 'release/1.1'
}

function pullRequest(
  overrides: Partial<{
    body: string
    title: string
    userType: string
    head: string
    base: string
    headRepository: string
  }> = {}
) {
  return {
    body: overrides.body ?? 'Human-authored PR',
    title: overrides.title ?? 'Fix release conflict',
    user: { type: overrides.userType ?? 'User' },
    head: {
      ref: overrides.head ?? 'feature/fix',
      repo: { full_name: overrides.headRepository ?? repository }
    },
    base: { ref: overrides.base ?? 'release/1.0' }
  }
}

describe('Pull request routing', () => {
  it('ROUTE-01: routes a trusted app-created repair before normal cascade logic', () => {
    expect(
      classifyPullRequest(
        pullRequest({
          body: buildRepairPrBody(repair),
          userType: 'Bot',
          head: repair.repairBranch,
          base: repair.protectedSourceBranch
        }),
        repository
      )
    ).toEqual({ kind: 'repair', metadata: repair })
  })

  it('ROUTE-02: rejects repair metadata on a human-created PR', () => {
    expect(
      classifyPullRequest(
        pullRequest({
          body: buildRepairPrBody(repair),
          head: repair.repairBranch,
          base: repair.protectedSourceBranch
        }),
        repository
      )
    ).toEqual({ kind: 'normal', rejectedRepairMetadata: true })
  })

  it('ROUTE-03: routes a stalled cascade PR as a continuation', () => {
    expect(
      classifyPullRequest(
        pullRequest({
          body: buildCascadePrBody(continuation),
          title: 'Automatic merge from release/1.0 -> release/1.1',
          userType: 'Bot',
          head: continuation.sourceBranch,
          base: continuation.targetBranch
        }),
        repository
      )
    ).toEqual({ kind: 'resume', metadata: continuation })
  })

  it('ROUTE-04: skips ordinary bot-created cascade PRs', () => {
    expect(
      classifyPullRequest(
        pullRequest({
          title: 'Automatic merge from release/1.0 -> release/1.1',
          userType: 'Bot'
        }),
        repository
      )
    ).toEqual({ kind: 'skip-bot' })
  })

  it('ROUTE-05: accepts a resumed final hop into ref_branch', () => {
    expect(
      shouldProcessCascadeBase(['release/'], 'develop', {
        ...continuation,
        targetBranch: 'develop',
        refBranch: 'develop'
      })
    ).toBe(true)
  })
})
