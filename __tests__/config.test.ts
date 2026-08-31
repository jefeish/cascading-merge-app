import { jest } from '@jest/globals'
import { loadConfig, loadOrgMaxMergeDepth } from '../src/lib/config.js'

describe('Config loading', () => {
  const baseContext = {
    payload: {
      repository: {
        owner: { login: 'test-owner' },
        name: 'test-repo'
      }
    },
    log: {
      info: jest.fn()
    }
  }

  function makeContext(yamlContent: string): any {
    return {
      ...baseContext,
      octokit: {
        repos: {
          getContent: async () => ({
            data: {
              content: Buffer.from(yamlContent, 'utf-8').toString('base64')
            }
          })
        }
      }
    }
  }

  function makeOrgContext(responses: Record<string, string>): any {
    return {
      ...baseContext,
      octokit: {
        repos: {
          getContent: async (request: {
            owner: string
            repo: string
            path: string
          }) => {
            const key = `${request.owner}/${request.repo}/${request.path}`
            const response = responses[key]

            if (response === undefined) {
              const error = new Error('Not Found') as Error & { status: number }
              error.status = 404
              throw error
            }

            return {
              data: {
                content: Buffer.from(response, 'utf-8').toString('base64')
              }
            }
          }
        }
      }
    }
  }

  it('CFG-01: uses unlimited depth when maxMergeDepth is omitted', async () => {
    const context = makeContext(`prefixes:\n  - release/\n`)

    const config = await loadConfig(context)

    expect(config).toEqual({
      prefixes: ['release/'],
      ref_branch: undefined,
      verbose: false,
      maxMergeDepth: undefined
    })
  })

  it('CFG-02: parses maxMergeDepth when provided', async () => {
    const context = makeContext(
      `prefixes:\n  - release/\nref_branch: develop\nmaxMergeDepth: 3\n`
    )

    const config = await loadConfig(context)

    expect(config?.maxMergeDepth).toBe(3)
  })

  it('CFG-03: rejects invalid maxMergeDepth values', async () => {
    const context = makeContext(
      `prefixes:\n  - release/\nref_branch: develop\nmaxMergeDepth: 0\n`
    )

    await expect(loadConfig(context)).rejects.toThrow(
      'Configuration error: "maxMergeDepth" must be an integer greater than or equal to 1 when provided'
    )
  })

  it('CFG-04: rejects empty ref_branch when explicitly provided', async () => {
    const context = makeContext(`prefixes:\n  - release/\nref_branch: '   '\n`)

    await expect(loadConfig(context)).rejects.toThrow(
      'Configuration error: "ref_branch" must be a non-empty string when provided'
    )
  })

  it('CFG-11: rejects empty repository config without a null dereference', async () => {
    const context = makeContext(`# maxMergeDepth: 4\n`)

    await expect(loadConfig(context)).rejects.toThrow(
      'Configuration error: "prefixes" must be a non-empty array of strings'
    )
  })

  it('CFG-05: returns undefined org maxMergeDepth when org config env is absent', async () => {
    const context = makeOrgContext({})

    await expect(loadOrgMaxMergeDepth(context, {})).resolves.toBeUndefined()
  })

  it('CFG-06: loads org maxMergeDepth from admin repo and path', async () => {
    const context = makeOrgContext({
      'test-owner/cascading-merge-admin/.github/cascading-merge.yml':
        'maxMergeDepth: 4\n'
    })

    await expect(
      loadOrgMaxMergeDepth(context, {
        ORG_CONFIG_REPO: 'cascading-merge-admin',
        ORG_CONFIG_PATH: '.github/cascading-merge.yml'
      })
    ).resolves.toBe(4)
    expect(context.log.info).toHaveBeenCalledWith(
      'Loading org-level maxMergeDepth from test-owner/cascading-merge-admin/.github/cascading-merge.yml'
    )
    expect(context.log.info).toHaveBeenCalledWith(
      'Org-level maxMergeDepth setting: 4'
    )
  })

  it('CFG-07: supports owner/repo syntax for org config repo', async () => {
    const context = makeOrgContext({
      'policy-owner/cascading-merge-admin/.github/cascading-merge.yml':
        'maxMergeDepth: 3\n'
    })

    await expect(
      loadOrgMaxMergeDepth(context, {
        ORG_CONFIG_REPO: 'policy-owner/cascading-merge-admin',
        ORG_CONFIG_PATH: '.github/cascading-merge.yml'
      })
    ).resolves.toBe(3)
  })

  it('CFG-08: treats missing org config repo or file as no org maxMergeDepth', async () => {
    const context = makeOrgContext({})

    await expect(
      loadOrgMaxMergeDepth(context, {
        ORG_CONFIG_REPO: 'cascading-merge-admin',
        ORG_CONFIG_PATH: '.github/cascading-merge.yml'
      })
    ).resolves.toBeUndefined()
    expect(context.log.info).toHaveBeenCalledWith(
      'Org-level maxMergeDepth config not found at test-owner/cascading-merge-admin/.github/cascading-merge.yml; continuing without org-level maxMergeDepth'
    )
  })

  it('CFG-09: rejects invalid org maxMergeDepth values', async () => {
    const context = makeOrgContext({
      'test-owner/cascading-merge-admin/.github/cascading-merge.yml':
        'maxMergeDepth: 0\n'
    })

    await expect(
      loadOrgMaxMergeDepth(context, {
        ORG_CONFIG_REPO: 'cascading-merge-admin',
        ORG_CONFIG_PATH: '.github/cascading-merge.yml'
      })
    ).rejects.toThrow(
      'Configuration error: "maxMergeDepth" must be an integer greater than or equal to 1 when provided'
    )
    expect(context.log.info).toHaveBeenCalledWith(
      'Org-level maxMergeDepth config at test-owner/cascading-merge-admin/.github/cascading-merge.yml is misconfigured: Configuration error: "maxMergeDepth" must be an integer greater than or equal to 1 when provided'
    )
  })

  it('CFG-10: treats org config permission errors as no org maxMergeDepth', async () => {
    const context = {
      ...baseContext,
      octokit: {
        repos: {
          getContent: async () => {
            const error = new Error('Forbidden') as Error & { status: number }
            error.status = 403
            throw error
          }
        }
      }
    }

    await expect(
      loadOrgMaxMergeDepth(context, {
        ORG_CONFIG_REPO: 'cascading-merge-admin',
        ORG_CONFIG_PATH: '.github/cascading-merge.yml'
      })
    ).resolves.toBeUndefined()
    expect(context.log.info).toHaveBeenCalledWith(
      'Org-level maxMergeDepth config could not be read from test-owner/cascading-merge-admin/.github/cascading-merge.yml because the app installation token does not have access; ensure the app is installed on the admin repo with contents read permission'
    )
  })

  it('CFG-12: treats empty org config as unlimited org maxMergeDepth', async () => {
    const context = makeOrgContext({
      'test-owner/cascading-merge-admin/.github/cascading-merge.yml':
        '# maxMergeDepth: 4\n'
    })

    await expect(
      loadOrgMaxMergeDepth(context, {
        ORG_CONFIG_REPO: 'cascading-merge-admin',
        ORG_CONFIG_PATH: '.github/cascading-merge.yml'
      })
    ).resolves.toBeUndefined()
    expect(context.log.info).toHaveBeenCalledWith(
      'Org-level maxMergeDepth config at test-owner/cascading-merge-admin/.github/cascading-merge.yml does not define maxMergeDepth; treating org-level maxMergeDepth as unlimited'
    )
    expect(context.log.info).toHaveBeenCalledWith(
      'Org-level maxMergeDepth setting: unlimited'
    )
  })
})