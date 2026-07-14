import yaml from 'js-yaml'
import type { CascadingMergeConfig } from '../types/config.js'

/**
 * Loads cascading merge configuration from repository's .github/cascading-merge.yml file
 *
 * @param context - Probot context
 * @returns Parsed configuration, or null if config is missing (cascade will be skipped)
 * @throws Error if configuration file is invalid
 */
export async function loadConfig(
  context: any
): Promise<CascadingMergeConfig | null> {
  const configPath = '.github/cascading-merge.yml'

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
      // Config file not found - skip cascade merge for this repository
      context.log.info(
        `No configuration file found at ${configPath}, skipping cascade merge for this repository`
      )
      return null
    }
    throw new Error(`Failed to load configuration: ${error.message}`)
  }
}

/**
 * Validates configuration and applies defaults for optional fields
 *
 * @param config - Partial configuration from YAML file
 * @returns Valid configuration with defaults applied
 * @throws Error if required fields are invalid
 */
function validateConfig(
  config: Partial<CascadingMergeConfig>
): CascadingMergeConfig {
  const result: CascadingMergeConfig = {
    prefixes: config.prefixes || [],
    ref_branch: config.ref_branch || '',
    verbose: config.verbose ?? false
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
  if (
    typeof result.ref_branch !== 'string' ||
    result.ref_branch.trim() === ''
  ) {
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
