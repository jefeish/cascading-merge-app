import yaml from 'js-yaml'
import type { CascadingMergeConfig } from '../types/config.js'
import { DEFAULT_CONFIG } from '../types/config.js'

/**
 * Loads cascading merge configuration from repository's .github/cascading-merge.yml file
 *
 * @param context - Probot context
 * @returns Parsed configuration with defaults applied, or null if config is missing and behavior is 'skip'
 * @throws Error if configuration file is invalid
 */
export async function loadConfig(
  context: any
): Promise<CascadingMergeConfig | null> {
  const configPath = '.github/cascading-merge.yml'
  const missingConfigBehavior = process.env.MISSING_CONFIG_BEHAVIOR || 'use-defaults'

  try {
    // Fetch the config file from the repository
    const { data } = await context.octokit.repos.getContent({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      path: configPath
    })

    // Decode base64 content
    if ('content' in data) {
      const content = Buffer.from(data.content, 'base64').toString('utf-8')
      const config = yaml.load(content) as Partial<CascadingMergeConfig>

      // Validate and merge with defaults
      return validateConfig(config)
    } else {
      throw new Error('Configuration file is a directory, not a file')
    }
  } catch (error: any) {
    if (error.status === 404) {
      // Config file not found - check behavior setting
      if (missingConfigBehavior === 'skip') {
        context.log.info(
          `No configuration file found at ${configPath} and MISSING_CONFIG_BEHAVIOR=skip, skipping cascade for this repository`
        )
        return null
      } else {
        context.log.info(
          `No configuration file found at ${configPath}, using defaults`
        )
        return DEFAULT_CONFIG
      }
    }
    throw new Error(`Failed to load configuration: ${error.message}`)
  }
}

/**
 * Validates configuration and applies defaults
 *
 * @param config - Partial configuration from YAML file
 * @returns Valid configuration with defaults applied
 * @throws Error if required fields are invalid
 */
function validateConfig(
  config: Partial<CascadingMergeConfig>
): CascadingMergeConfig {
  const result: CascadingMergeConfig = {
    prefixes: config.prefixes || DEFAULT_CONFIG.prefixes,
    ref_branch: config.ref_branch || DEFAULT_CONFIG.ref_branch
  }

  // Validate prefixes
  if (!Array.isArray(result.prefixes) || result.prefixes.length === 0) {
    throw new Error(
      'Configuration error: "prefixes" must be a non-empty array of strings'
    )
  }

  for (const prefix of result.prefixes) {
    if (typeof prefix !== 'string' || prefix.trim() === '') {
      throw new Error(
        'Configuration error: all "prefixes" must be non-empty strings'
      )
    }
  }

  // Validate ref_branch
  if (typeof result.ref_branch !== 'string' || result.ref_branch.trim() === '') {
    throw new Error(
      'Configuration error: "ref_branch" must be a non-empty string'
    )
  }

  return result
}

/**
 * Gets example configuration content for documentation
 */
export function getExampleConfig(): string {
  return `# Cascading Merge App Configuration
# Place this file at .github/cascading-merge.yml in your repository

# Branch prefixes to match for cascade merging
# Only branches starting with these prefixes will be included in the cascade
prefixes:
  - release/
  - feature/

# The final branch to merge into after all versioned branches
ref_branch: develop
`
}
