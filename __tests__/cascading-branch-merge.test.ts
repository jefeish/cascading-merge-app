import { jest } from '@jest/globals'
import { RequestError } from '@octokit/request-error'
import { Endpoints } from '@octokit/types'

// Create a mock logger that matches Probot's Logger interface
const mockLogger: any = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
  level: 'info',
  silent: jest.fn(),
  msgPrefix: ''
}

// Create a mock octokit instance with proper typing
const mockOctokit: any = {
  paginate: jest.fn(),
  rest: {
    issues: {
      createComment: jest.fn(),
      create: jest.fn()
    },
    pulls: {
      create: jest.fn(),
      merge: jest.fn()
    },
    repos: {
      listBranches: jest.fn()
    }
  }
}

// Import the module to test
import { parseCascadeMetadata } from '../src/lib/cascade-metadata.js'
import { cascadingBranchMerge } from '../src/lib/cascading-branch-merge.js'

const noCommitsError = () =>
  new RequestError('Validation Failed', 422, {
    request: {
      method: 'POST',
      url: 'https://api.github.com/foo',
      body: { bar: 'baz' },
      headers: { authorization: 'token secret13' }
    },
    response: {
      status: 422,
      url: 'https://api.github.com/foo',
      headers: { 'x-github-request-id': '1:2:3:4' },
      data: {
        message: 'Validation Failed',
        errors: [{ message: 'No commits between develop and develop' }]
      }
    }
  })

describe('Cascading Branch Merge', () => {
  const mockOwner = 'test-owner'
  const mockRepo = 'test-repo'
  const mockActor = 'mona'
  const mockPullNumber = 1

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()

    // Setup default mock responses
    mockOctokit.paginate.mockResolvedValue([
      { name: 'release/1.0' },
      { name: 'release/1.1-3' },
      { name: 'release/1.1-rc1' },
      { name: 'release/1.1-2' },
      { name: 'release/1.1' },
      { name: 'release/1.1-1' },
      { name: 'release/1.2-a' },
      { name: 'release/1.2-b' },
      { name: 'release/1.3' },
      { name: 'release/2.0' },
      { name: 'develop' }
    ])

    mockOctokit.rest.pulls.create.mockResolvedValue({
      data: { number: 1 }
    } as Endpoints['POST /repos/{owner}/{repo}/pulls']['response'])

    mockOctokit.rest.issues.create.mockResolvedValue({
      data: { number: 1 }
    } as Endpoints['POST /repos/{owner}/{repo}/issues']['response'])

    mockOctokit.rest.pulls.merge.mockResolvedValue({
      data: { merged: true }
    } as any)
  })

  describe('Cascade merge flow', () => {
    it('UC-01: Performs a simple cascade', async () => {
      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/1.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger
      )

      expect(mockOctokit.paginate).toHaveBeenCalledWith(
        mockOctokit.rest.repos.listBranches,
        {
          owner: mockOwner,
          repo: mockRepo
        }
      )

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(10)
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(1, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'release/1.1',
        head: 'release/1.0',
        title: expect.anything(),
        body: expect.anything()
      })
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(2, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'release/1.1-1',
        head: 'release/1.1',
        title: expect.anything(),
        body: expect.anything()
      })
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(3, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'release/1.1-2',
        head: 'release/1.1-1',
        title: expect.anything(),
        body: expect.anything()
      })
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(4, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'release/1.1-3',
        head: 'release/1.1-2',
        title: expect.anything(),
        body: expect.anything()
      })
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(5, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'release/1.1-rc1',
        head: 'release/1.1-3',
        title: expect.anything(),
        body: expect.anything()
      })
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(6, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'release/1.2-a',
        head: 'release/1.1-rc1',
        title: expect.anything(),
        body: expect.anything()
      })
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(7, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'release/1.2-b',
        head: 'release/1.2-a',
        title: expect.anything(),
        body: expect.anything()
      })
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(8, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'release/1.3',
        head: 'release/1.2-b',
        title: expect.anything(),
        body: expect.anything()
      })
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(9, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'release/2.0',
        head: 'release/1.3',
        title: expect.anything(),
        body: expect.anything()
      })
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(10, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'develop',
        head: 'release/2.0',
        title: expect.anything(),
        body: expect.anything()
      })

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledTimes(11)
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: ':white_check_mark: Auto-merge was successful.'
      })

      expect(mockOctokit.rest.issues.create).not.toHaveBeenCalled()
    })

    it('UC-02: Fixing a conflict continues the cascade', async () => {
      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'release/1.2',
        'release/1.3',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger
      )

      expect(mockOctokit.paginate).toHaveBeenCalledWith(
        mockOctokit.rest.repos.listBranches,
        {
          owner: mockOwner,
          repo: mockRepo
        }
      )

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(2)
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(1, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'release/2.0',
        head: 'release/1.3',
        title: expect.anything(),
        body: expect.anything()
      })
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(2, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'develop',
        head: 'release/2.0',
        title: expect.anything(),
        body: expect.anything()
      })

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledTimes(3)
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: ':white_check_mark: Auto-merge was successful.'
      })

      expect(mockOctokit.rest.issues.create).not.toHaveBeenCalled()
    })

    it('UC-03: Carries originating PR title into downstream merge commits', async () => {
      const originatingTitle = 'ABC-1234 Improve release notes'
      const originatingSource = 'jefeish/release/2026-01-20'

      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/2.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger,
        false,
        undefined,
        originatingTitle,
        originatingSource
      )

      expect(mockOctokit.rest.pulls.merge).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: mockOwner,
          repo: mockRepo,
          pull_number: 1,
          commit_title: `PR #1 from ${originatingSource}: ${originatingTitle}`,
          commit_message: expect.stringContaining('Originating PR #1')
        })
      )
    })
  })

  describe('Depth limits and final ref_branch merge', () => {
    it('UC-04: Still performs final ref_branch merge when maxMergeDepth is reached', async () => {
      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/1.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger,
        false,
        2
      )

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(3)
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(1, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'release/1.1',
        head: 'release/1.0',
        title: expect.anything(),
        body: expect.anything()
      })
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(2, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'release/1.1-1',
        head: 'release/1.1',
        title: expect.anything(),
        body: expect.anything()
      })
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(3, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'develop',
        head: 'release/1.1-1',
        title: expect.anything(),
        body: expect.anything()
      })

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: 'Reached configured max merge depth (2). Performed a final merge to __develop__ and stopped.'
      })
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: ':white_check_mark: Auto-merge was successful.'
      })
    })

    it('UC-05: Still performs final ref_branch merge when the depth limit lands on the last release branch', async () => {
      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/1.3',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger,
        false,
        1
      )

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(2)
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(2, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'develop',
        head: 'release/2.0',
        title: expect.anything(),
        body: expect.anything()
      })

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: 'Reached configured max merge depth (1). Performed a final merge to __develop__ and stopped.'
      })
    })

    it('UC-06: Includes maxMergeDepth source note in verbose report when depth is reached', async () => {
      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/1.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger,
        true,
        2,
        undefined,
        undefined,
        'global'
      )

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: mockOwner,
          repo: mockRepo,
          title: `🔄 Cascade Merge Report: PR #${mockPullNumber}`,
          body: expect.stringContaining(
            'Total Cascade PRs**: 3 created, 0 skipped (maxMergeDepth reached (app-level cap: 2))'
          )
        })
      )
    })

    it('UC-07: Does not perform a final merge when ref_branch is omitted', async () => {
      await cascadingBranchMerge(
        ['release/'],
        undefined,
        'release/1.2',
        'release/1.3',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger
      )

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(1)
      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        base: 'release/2.0',
        head: 'release/1.3',
        title: expect.anything(),
        body: expect.anything()
      })
    })
  })

  describe('Failure handling', () => {
    it('UC-08: Adds a comment if there are no commits for a PR', async () => {
      const error = new RequestError('Validation Failed', 422, {
        request: {
          method: 'POST',
          url: 'https://api.github.com/foo',
          body: {
            bar: 'baz'
          },
          headers: {
            authorization: 'token secret13'
          }
        },
        response: {
          status: 422,
          url: 'https://api.github.com/foo',
          headers: {
            'x-github-request-id': '1:2:3:4'
          },
          data: {
            message: 'Validation Failed',
            errors: [
              {
                message: 'No commits between develop and develop'
              }
            ]
          }
        }
      })

      mockOctokit.rest.pulls.create.mockRejectedValue(error)

      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/2.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger
      )

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(1)
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: expect.stringMatching(/.*There are no commits between.*/)
      })
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: ':white_check_mark: Auto-merge was successful.'
      })
      expect(mockOctokit.rest.issues.create).not.toHaveBeenCalled()
    })

    it('UC-09: Breaks if a PR already exists', async () => {
      const error = new RequestError('Validation Failed', 422, {
        request: {
          method: 'POST',
          url: 'https://api.github.com/foo',
          body: {
            bar: 'baz'
          },
          headers: {
            authorization: 'token secret13'
          }
        },
        response: {
          status: 422,
          url: 'https://api.github.com/foo',
          headers: {
            'x-github-request-id': '1:2:3:4'
          },
          data: {
            message: 'Validation Failed',
            errors: [
              {
                message: 'A pull request already exists'
              }
            ]
          }
        }
      })

      mockOctokit.rest.pulls.create.mockRejectedValue(error)

      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/1.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger
      )

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(1)

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: expect.stringMatching(/.*already a pull request open/)
      })
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: ':bangbang: Auto-merge action did not complete successfully. Please review issues.'
      })

      expect(mockOctokit.rest.issues.create).not.toHaveBeenCalled()
    })

    it('UC-10: Opens an issue if an unhandled error occurs', async () => {
      const error = new RequestError('Validation Failed', 500, {
        request: {
          method: 'POST',
          url: 'https://api.github.com/foo',
          body: {
            bar: 'baz'
          },
          headers: {
            authorization: 'token secret13'
          }
        },
        response: {
          status: 500,
          url: 'https://api.github.com/foo',
          headers: {
            'x-github-request-id': '1:2:3:4'
          },
          data: {
            message: 'Some Unhandled Error',
            errors: [
              {
                message: 'Unhandled Exception'
              }
            ]
          }
        }
      })

      mockOctokit.rest.pulls.create.mockRejectedValue(error)

      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/1.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        'handle',
        mockLogger
      )

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledTimes(1)
      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        assignees: ['handle'],
        title: expect.any(String),
        body: expect.stringMatching(/^Unknown issue when creating.*/)
      })

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: expect.stringMatching(/.*encountered an issue.*/)
      })
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: ':bangbang: Auto-merge action did not complete successfully. Please review issues.'
      })

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(1)
    })

    it('UC-11: Adds a comment and breaks if a merge conflict exists', async () => {
      const error = new RequestError('Validation Failed', 405, {
        request: {
          method: 'POST',
          url: 'https://api.github.com/merge',
          body: {
            bar: 'baz'
          },
          headers: {
            authorization: 'token secret13'
          }
        },
        response: {
          status: 405,
          url: 'https://api.github.com/merge',
          headers: {
            'x-github-request-id': '1:2:3:4'
          },
          data: {
            message: 'Merge conflict',
            errors: [
              {
                message: 'Merge conflict'
              }
            ]
          }
        }
      })

      mockOctokit.rest.pulls.merge.mockRejectedValue(error)

      mockOctokit.rest.pulls.create.mockResolvedValue({
        data: { number: 13 }
      } as Endpoints['POST /repos/{owner}/{repo}/pulls']['response'])

      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/1.2',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        'handle',
        mockLogger
      )

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledTimes(1)
      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        assignees: ['handle'],
        title: expect.any(String),
        body: expect.stringMatching(/.*PR #13.*/)
      })

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: expect.stringMatching(
          /.*Could not auto merge PR #13 due to merge conflicts.*/
        )
      })
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: ':bangbang: Auto-merge action did not complete successfully. Please review issues.'
      })

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(1)

      expect(mockOctokit.rest.pulls.merge).toHaveBeenCalledTimes(1)
    })

    it('UC-12: Breaks if an unhandled error occurs merging a PR', async () => {
      const error = new RequestError('Validation Failed', 500, {
        request: {
          method: 'POST',
          url: 'https://api.github.com/foo',
          body: {
            bar: 'baz'
          },
          headers: {
            authorization: 'token secret13'
          }
        },
        response: {
          status: 500,
          url: 'https://api.github.com/foo',
          headers: {
            'x-github-request-id': '1:2:3:4'
          },
          data: {
            message: 'Some Unhandled Error',
            errors: [
              {
                message: 'Unhandled Exception'
              }
            ]
          }
        }
      })

      mockOctokit.rest.pulls.merge.mockRejectedValue(error)

      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/1.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        'handle',
        mockLogger
      )

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledTimes(1)
      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        assignees: ['handle'],
        title: expect.any(String),
        body: expect.stringMatching(/^Issue with auto-merging a PR*/)
      })

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: expect.any(String)
      })
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: ':bangbang: Auto-merge action did not complete successfully. Please review issues.'
      })

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(1)
    })
  })

  describe('Merge list construction', () => {
    it('UC-13: Cascades the head list before the base list', async () => {
      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'release/1.3',
        'release/2.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger
      )

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(2)
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(1, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'release/2.0',
        head: 'release/1.3',
        title: expect.anything(),
        body: expect.anything()
      })
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(2, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'develop',
        head: 'release/2.0',
        title: expect.anything(),
        body: expect.anything()
      })
    })

    it('UC-14: Does not duplicate ref_branch when it is already the last merge list entry', async () => {
      await cascadingBranchMerge(
        ['release/'],
        'release/2.0',
        'my-feature',
        'release/1.3',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger
      )

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(1)
      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        base: 'release/2.0',
        head: 'release/1.3',
        title: expect.anything(),
        body: expect.anything()
      })
    })

    it('UC-15: Does nothing when no branch matches the configured prefixes', async () => {
      await cascadingBranchMerge(
        ['hotfix/'],
        'develop',
        'my-feature',
        'release/1.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger
      )

      expect(mockOctokit.rest.pulls.create).not.toHaveBeenCalled()
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledTimes(1)
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: ':white_check_mark: Auto-merge was successful.'
      })
    })
  })

  describe('Depth limit edge cases', () => {
    it('UC-16: Stops without a final ref merge when the limit is reached on the head list', async () => {
      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'release/1.0',
        'release/1.3',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger,
        false,
        2
      )

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(2)
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(2, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'release/1.1-1',
        head: 'release/1.1',
        title: expect.anything(),
        body: expect.anything()
      })
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: 'Reached configured max merge depth (2). Stopping cascade early.'
      })
    })

    it('UC-17: Merges straight into ref_branch when maxMergeDepth is 0', async () => {
      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/1.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger,
        false,
        0
      )

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(1)
      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        base: 'develop',
        head: 'release/1.0',
        title: expect.anything(),
        body: expect.anything()
      })
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: 'Reached configured max merge depth (0). Performed a final merge to __develop__ and stopped.'
      })
    })

    it('UC-18: Creates no PRs when maxMergeDepth is 0 and ref_branch is omitted', async () => {
      await cascadingBranchMerge(
        ['release/'],
        undefined,
        'my-feature',
        'release/1.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger,
        false,
        0
      )

      expect(mockOctokit.rest.pulls.create).not.toHaveBeenCalled()
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: 'Reached configured max merge depth (0). Stopping cascade early.'
      })
    })

    it('UC-19: Treats a skipped final ref merge as the final ref merge', async () => {
      mockOctokit.rest.pulls.create
        .mockResolvedValueOnce({ data: { number: 1 } } as any)
        .mockRejectedValueOnce(noCommitsError())

      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/1.3',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger,
        false,
        1
      )

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(2)
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(2, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'develop',
        head: 'release/2.0',
        title: expect.anything(),
        body: expect.anything()
      })
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: 'Reached configured max merge depth (1). Performed a final merge to __develop__ and stopped.'
      })
    })

    it('UC-25: Completes naturally when the cascade is shorter than the depth cap', async () => {
      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/1.3',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger,
        false,
        5
      )

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(2)
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(2, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'develop',
        head: 'release/2.0',
        title: expect.anything(),
        body: expect.anything()
      })
      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('Reached configured max merge depth')
        })
      )
    })

    it('UC-26: Completes naturally when the cascade length exactly equals the depth cap', async () => {
      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/1.3',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger,
        false,
        2
      )

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(2)
      expect(mockOctokit.rest.pulls.create).toHaveBeenNthCalledWith(2, {
        owner: mockOwner,
        repo: mockRepo,
        base: 'develop',
        head: 'release/2.0',
        title: expect.anything(),
        body: expect.anything()
      })
      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('Reached configured max merge depth')
        })
      )
    })
  })

  describe('Verbose cascade report', () => {
    it('UC-20: Reports a repo-level maxMergeDepth source', async () => {
      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/1.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger,
        true,
        2,
        undefined,
        undefined,
        'repo'
      )

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining(
            'maxMergeDepth reached (repo-level setting: 2)'
          )
        })
      )
    })

    it('UC-27: Reports an org-level maxMergeDepth source', async () => {
      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/1.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger,
        true,
        2,
        undefined,
        undefined,
        'org'
      )

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining(
            'maxMergeDepth reached (org-level setting: 2)'
          )
        })
      )
    })

    it('UC-21: Omits the depth note when the cascade completes within the limit', async () => {
      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/2.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger,
        true,
        5
      )

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: ['cascade-report'],
          body: expect.stringContaining(
            '**Total Cascade PRs**: 1 created, 0 skipped\n'
          )
        })
      )
    })

    it('UC-28: Reports the configured final branch and max depth even when the limit is not reached', async () => {
      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/2.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger,
        true,
        5,
        undefined,
        undefined,
        'org'
      )

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: ['cascade-report'],
          body: expect.stringContaining('**Final Branch**: `develop`')
        })
      )
      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: ['cascade-report'],
          body: expect.stringContaining(
            '**Max Merge Depth**: `5` (org-level setting)'
          )
        })
      )
    })

    it('UC-29: Reports no final branch when ref_branch is not configured', async () => {
      await cascadingBranchMerge(
        ['release/'],
        undefined,
        'release/1.2',
        'release/1.3',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger,
        true
      )

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: ['cascade-report'],
          body: expect.stringContaining('**Final Branch**: `none`')
        })
      )
      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: ['cascade-report'],
          body: expect.stringContaining('**Max Merge Depth**: `unlimited`')
        })
      )
    })

    it('UC-22: Does not fail the cascade when the report issue cannot be created', async () => {
      mockOctokit.rest.issues.create.mockRejectedValue(new Error('boom'))

      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/2.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger,
        true
      )

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        issue_number: mockPullNumber,
        body: ':white_check_mark: Auto-merge was successful.'
      })
    })
  })

  describe('Downstream merge commit metadata', () => {
    it('UC-23: Uses the originating title alone when no source label is provided', async () => {
      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/2.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger,
        false,
        undefined,
        'ABC-1234 Improve release notes'
      )

      expect(mockOctokit.rest.pulls.merge).toHaveBeenCalledWith(
        expect.objectContaining({
          commit_title: 'ABC-1234 Improve release notes'
        })
      )
    })

    it('UC-24: Leaves the merge commit message to GitHub when no originating title is provided', async () => {
      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/2.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger
      )

      expect(mockOctokit.rest.pulls.merge).toHaveBeenCalledWith({
        owner: mockOwner,
        repo: mockRepo,
        pull_number: 1
      })
    })
  })

  describe('Interrupted cascade resume', () => {
    it('UC-30: Stamps resumable cascade metadata with the remaining depth on each PR', async () => {
      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/1.3',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger,
        false,
        2,
        'ABC-1234 Improve release notes',
        'octo/my-feature',
        'repo'
      )

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(2)

      const first = parseCascadeMetadata(
        mockOctokit.rest.pulls.create.mock.calls[0][0].body
      )
      const second = parseCascadeMetadata(
        mockOctokit.rest.pulls.create.mock.calls[1][0].body
      )

      expect(first).toMatchObject({
        originatingPr: mockPullNumber,
        originatingPrTitle: 'ABC-1234 Improve release notes',
        originatingPrSource: 'octo/my-feature',
        sourceBranch: 'release/1.3',
        targetBranch: 'release/2.0',
        remainingDepth: 1,
        maxMergeDepth: 2,
        maxMergeDepthSource: 'repo',
        refBranch: 'develop'
      })
      expect(second).toMatchObject({
        sourceBranch: 'release/2.0',
        targetBranch: 'develop',
        remainingDepth: 0
      })
    })

    it('UC-31: Resumes downstream only, without restarting the depth budget', async () => {
      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'release/1.3',
        'release/2.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger,
        false,
        2,
        undefined,
        undefined,
        'repo',
        { remainingDepth: 1, resumedFromPr: 99 }
      )

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledTimes(1)
      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith(
        expect.objectContaining({
          head: 'release/2.0',
          base: 'develop'
        })
      )
    })

    it('UC-32: Records an unlimited remaining depth as null', async () => {
      await cascadingBranchMerge(
        ['release/'],
        'develop',
        'my-feature',
        'release/2.0',
        mockOwner,
        mockRepo,
        mockOctokit,
        mockPullNumber,
        mockActor,
        mockLogger
      )

      expect(
        parseCascadeMetadata(
          mockOctokit.rest.pulls.create.mock.calls[0][0].body
        )
      ).toMatchObject({ remainingDepth: null, maxMergeDepth: null })
    })
  })
})
