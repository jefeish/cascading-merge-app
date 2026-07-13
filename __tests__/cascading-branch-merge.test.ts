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
import { cascadingBranchMerge } from '../src/lib/cascading-branch-merge.js'

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

  it('Performs a simple cascade', async () => {
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

  it('Fixing a conflict continues the cascade', async () => {
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

  it('Adds a comment if there are no commits for a PR', async () => {
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

  it('Breaks if a PR already exists', async () => {
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

  it('Opens an issue if an unhandled error occurs', async () => {
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

  it('Adds a comment and breaks if a merge conflict exists', async () => {
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

  it('Breaks if an unhandled error occurs merging a PR', async () => {
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
