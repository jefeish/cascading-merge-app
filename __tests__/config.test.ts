import { jest } from '@jest/globals'
import { loadConfig } from '../src/lib/config.js'

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
})