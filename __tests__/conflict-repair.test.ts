import { jest } from '@jest/globals'
import {
  buildCascadePrBody,
  CASCADE_METADATA_VERSION,
  parseRepairMetadata,
  type CascadeMetadata,
  type CascadeRepairMetadata
} from '../src/lib/cascade-metadata.js'
import {
  createOrReuseConflictRepair,
  handleRepairMerge
} from '../src/lib/conflict-repair.js'

const owner = 'octo'
const repo = 'repo'
const continuation: CascadeMetadata = {
  version: CASCADE_METADATA_VERSION,
  kind: 'cascade',
  originatingPr: 100,
  originatingPrTitle: 'Fix release behavior',
  originatingPrSource: 'octo/feature',
  sourceBranch: 'release/1.0',
  targetBranch: 'release/1.1',
  remainingDepth: 3,
  maxMergeDepth: 5,
  maxMergeDepthSource: 'repo',
  refBranch: 'develop'
}

const logger: any = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}

function createOctokit() {
  return {
    rest: {
      repos: {
        getBranch: jest.fn(({ branch }: { branch: string }) =>
          Promise.resolve({
            data: {
              commit: {
                sha:
                  branch === continuation.sourceBranch
                    ? 'aaaaaaaaaaaa'
                    : 'bbbbbbbbbbbb'
              }
            }
          })
        )
      },
      git: {
        getRef: jest.fn().mockRejectedValue({ status: 404 }),
        createRef: jest.fn(),
        deleteRef: jest.fn()
      },
      pulls: {
        list: jest.fn().mockResolvedValue({ data: [] }),
        create: jest.fn().mockResolvedValue({ data: { number: 102 } }),
        update: jest.fn(),
        get: jest.fn(),
        merge: jest.fn()
      },
      issues: {
        createComment: jest.fn()
      }
    }
  } as any
}

describe('Conflict repair', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('REPAIR-01: creates a target-based draft PR into the protected source', async () => {
    const octokit = createOctokit()

    const result = await createOrReuseConflictRepair({
      owner,
      repo,
      octokit,
      log: logger,
      stalledPr: 101,
      continuation
    })

    expect(result).toEqual({
      branch: 'cascade-fix/101-aaaaaaa-bbbbbbb',
      pullNumber: 102
    })
    expect(octokit.rest.git.createRef).toHaveBeenCalledWith({
      owner,
      repo,
      ref: 'refs/heads/cascade-fix/101-aaaaaaa-bbbbbbb',
      sha: 'bbbbbbbbbbbb'
    })
    expect(octokit.rest.pulls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        head: 'cascade-fix/101-aaaaaaa-bbbbbbb',
        base: continuation.sourceBranch,
        draft: true
      })
    )

    const body = octokit.rest.pulls.create.mock.calls[0][0].body
    expect(parseRepairMetadata(body)).toMatchObject({
      kind: 'repair',
      originatingPr: 100,
      stalledPr: 101
    })
  })

  it('REPAIR-02: reuses an existing open repair PR for the same branch state', async () => {
    const octokit = createOctokit()
    octokit.rest.pulls.list.mockResolvedValue({
      data: [{ number: 109 }]
    })

    await expect(
      createOrReuseConflictRepair({
        owner,
        repo,
        octokit,
        log: logger,
        stalledPr: 101,
        continuation
      })
    ).resolves.toEqual({
      branch: 'cascade-fix/101-aaaaaaa-bbbbbbb',
      pullNumber: 109
    })
    expect(octokit.rest.git.createRef).not.toHaveBeenCalled()
    expect(octokit.rest.pulls.create).not.toHaveBeenCalled()
    expect(octokit.rest.pulls.update).toHaveBeenCalledWith(
      expect.objectContaining({ pull_number: 109 })
    )
  })

  it('REPAIR-03: merges the validated stalled PR without starting a new cascade', async () => {
    const octokit = createOctokit()
    const repairMetadata: CascadeRepairMetadata = {
      version: CASCADE_METADATA_VERSION,
      kind: 'repair',
      originatingPr: 100,
      stalledPr: 101,
      repairBranch: 'cascade-fix/101-aaaaaaa-bbbbbbb',
      protectedSourceBranch: continuation.sourceBranch,
      stalledTargetBranch: continuation.targetBranch
    }
    octokit.rest.pulls.get.mockResolvedValue({
      data: {
        number: 101,
        state: 'open',
        merged_at: null,
        title: 'Automatic merge from release/1.0 -> release/1.1',
        body: buildCascadePrBody(continuation),
        user: { type: 'Bot' },
        mergeable: false,
        mergeable_state: 'dirty',
        head: { ref: continuation.sourceBranch },
        base: { ref: continuation.targetBranch }
      }
    })
    octokit.rest.pulls.merge.mockResolvedValue({
      data: { merged: true, message: 'Pull Request successfully merged' }
    })
    octokit.rest.git.getRef.mockResolvedValue({
      data: { object: { sha: 'cccccccccccc' } }
    })

    await handleRepairMerge({
      owner,
      repo,
      octokit,
      log: logger,
      repairMetadata,
      repairPullNumber: 102,
      repairHeadSha: 'cccccccccccc'
    })

    expect(octokit.rest.pulls.merge).toHaveBeenCalledWith(
      expect.objectContaining({
        pull_number: 101,
        commit_title: 'PR #100 from octo/feature: Fix release behavior'
      })
    )
    expect(octokit.rest.git.deleteRef).toHaveBeenCalledWith({
      owner,
      repo,
      ref: 'heads/cascade-fix/101-aaaaaaa-bbbbbbb'
    })
  })

  it('REPAIR-04: creates another repair attempt when the stalled PR still conflicts', async () => {
    const octokit = createOctokit()
    const repairMetadata: CascadeRepairMetadata = {
      version: CASCADE_METADATA_VERSION,
      kind: 'repair',
      originatingPr: 100,
      stalledPr: 101,
      repairBranch: 'cascade-fix/101-old-old',
      protectedSourceBranch: continuation.sourceBranch,
      stalledTargetBranch: continuation.targetBranch
    }
    octokit.rest.pulls.get.mockResolvedValue({
      data: {
        state: 'open',
        merged_at: null,
        title: 'Automatic merge from release/1.0 -> release/1.1',
        body: buildCascadePrBody(continuation),
        user: { type: 'Bot' },
        mergeable: false,
        mergeable_state: 'dirty',
        head: { ref: continuation.sourceBranch },
        base: { ref: continuation.targetBranch }
      }
    })
    octokit.rest.pulls.merge.mockRejectedValue({ status: 405 })

    await handleRepairMerge({
      owner,
      repo,
      octokit,
      log: logger,
      repairMetadata,
      repairPullNumber: 102,
      repairHeadSha: 'cccccccccccc'
    })

    expect(octokit.rest.pulls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        head: 'cascade-fix/101-aaaaaaa-bbbbbbb',
        draft: true
      })
    )
    expect(octokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_number: continuation.originatingPr,
        body: expect.stringContaining('still conflicts')
      })
    )
  })

  it('REPAIR-05: rejects a mismatched stalled pull request', async () => {
    const octokit = createOctokit()
    const repairMetadata: CascadeRepairMetadata = {
      version: CASCADE_METADATA_VERSION,
      kind: 'repair',
      originatingPr: 100,
      stalledPr: 101,
      repairBranch: 'cascade-fix/101-aaaaaaa-bbbbbbb',
      protectedSourceBranch: continuation.sourceBranch,
      stalledTargetBranch: continuation.targetBranch
    }
    octokit.rest.pulls.get.mockResolvedValue({
      data: {
        state: 'open',
        title: 'Unrelated PR',
        body: 'No cascade state',
        user: { type: 'User' },
        head: { ref: continuation.sourceBranch },
        base: { ref: continuation.targetBranch }
      }
    })

    await expect(
      handleRepairMerge({
        owner,
        repo,
        octokit,
        log: logger,
        repairMetadata,
        repairPullNumber: 102,
        repairHeadSha: 'cccccccccccc'
      })
    ).rejects.toThrow('does not reference a valid stalled cascade PR')
    expect(octokit.rest.pulls.merge).not.toHaveBeenCalled()
  })
})
