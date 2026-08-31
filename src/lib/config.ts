import yaml from 'js-yaml'
import type { CascadingMergeConfig } from '../types/config.js'

const REPO_CONFIG_PATH = '.github/cascading-merge.yml'

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
  try {
    const config = await loadYamlConfig(context, {
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      path: REPO_CONFIG_PATH
    })

    return validateConfig(config)
  } catch (error: any) {
    if (error.status === 404) {
      // Config file not found - skip cascade merge for this repository
      context.log.info(
        `No configuration file found at ${REPO_CONFIG_PATH}, skipping cascade merge for this repository`
      )
      return null
    }
    throw new Error(`Failed to load configuration: ${error.message}`)
  }
}

export async function loadOrgMaxMergeDepth(
  context: any,
  env: NodeJS.ProcessEnv = process.env
): Promise<number | undefined> {
  const orgConfigRepo = env.ORG_CONFIG_REPO?.trim()
  const orgConfigPath = env.ORG_CONFIG_PATH?.trim()

  if (!orgConfigRepo && !orgConfigPath) {
    return undefined
  }

  if (!orgConfigRepo || !orgConfigPath) {
    throw new Error(
      'Configuration error: ORG_CONFIG_REPO and ORG_CONFIG_PATH must both be set to load org-level maxMergeDepth'
    )
  }

  const { owner, repo } = parseOrgConfigRepo(
    orgConfigRepo,
    context.payload.repository.owner.login
  )

  context.log.info(
    `Loading org-level maxMergeDepth from ${owner}/${repo}/${orgConfigPath}`
  )

  try {
    const config = await loadYamlConfig(context, {
      owner,
      repo,
      path: orgConfigPath
    })

    if (!Object.prototype.hasOwnProperty.call(config, 'maxMergeDepth')) {
      context.log.info(
        `Org-level maxMergeDepth config at ${owner}/${repo}/${orgConfigPath} does not define maxMergeDepth; treating org-level maxMergeDepth as unlimited`
      )
    }

    const maxMergeDepth = validateMaxMergeDepth(config.maxMergeDepth)
    context.log.info(
      `Org-level maxMergeDepth setting: ${maxMergeDepth ?? 'unlimited'}`
    )

    return maxMergeDepth
  } catch (error: any) {
    if (error.status === 404) {
      context.log.info(
        `Org-level maxMergeDepth config not found at ${owner}/${repo}/${orgConfigPath}; continuing without org-level maxMergeDepth`
      )
      return undefined
    }

    if (error.status === 403) {
      context.log.info(
        `Org-level maxMergeDepth config could not be read from ${owner}/${repo}/${orgConfigPath} because the app installation token does not have access; ensure the app is installed on the admin repo with contents read permission`
      )
      return undefined
    }

    if (error.message?.startsWith('Configuration error:')) {
      context.log.info(
        `Org-level maxMergeDepth config at ${owner}/${repo}/${orgConfigPath} is misconfigured: ${error.message}`
      )
    }

    throw new Error(
      `Failed to load org-level maxMergeDepth config from ${owner}/${repo}/${orgConfigPath}: ${error.message}`
    )
  }
}

async function loadYamlConfig(
  context: any,
  location: { owner: string; repo: string; path: string }
): Promise<Partial<CascadingMergeConfig>> {
  const { data } = await context.octokit.repos.getContent(location)

  if (!('content' in data)) {
    throw new Error('Configuration file is a directory, not a file')
  }

  const content = Buffer.from(data.content, 'base64').toString('utf-8')
  const config = yaml.load(content)

  if (config === null || config === undefined) {
    return {}
  }

  return config as Partial<CascadingMergeConfig>
}

function parseOrgConfigRepo(
  orgConfigRepo: string,
  fallbackOwner: string
): { owner: string; repo: string } {
  const parts = orgConfigRepo.split('/').map(part => part.trim())

  if (parts.length === 1 && parts[0]) {
    return { owner: fallbackOwner, repo: parts[0] }
  }

  if (parts.length === 2 && parts[0] && parts[1]) {
    return { owner: parts[0], repo: parts[1] }
  }

  throw new Error(
    'Configuration error: ORG_CONFIG_REPO must be a repository name or owner/repository'
  )
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
  const rawRefBranch =
    typeof config.ref_branch === 'string' ? config.ref_branch.trim() : undefined

  const result: CascadingMergeConfig = {
    prefixes: config.prefixes || [],
    ref_branch: rawRefBranch,
    verbose: config.verbose ?? false,
    maxMergeDepth: config.maxMergeDepth
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

  // Validate ref_branch (optional)
  if (config.ref_branch !== undefined && !result.ref_branch) {
    throw new Error(
      'Configuration error: "ref_branch" must be a non-empty string when provided'
    )
  }

  // Validate maxMergeDepth
  result.maxMergeDepth = validateMaxMergeDepth(result.maxMergeDepth)

  return result
}

function validateMaxMergeDepth(maxMergeDepth: unknown): number | undefined {
  if (maxMergeDepth === undefined) {
    return undefined
  }

  if (
    typeof maxMergeDepth !== 'number' ||
    !Number.isInteger(maxMergeDepth) ||
    maxMergeDepth < 1
  ) {
    throw new Error(
      'Configuration error: "maxMergeDepth" must be an integer greater than or equal to 1 when provided'
    )
  }

  return maxMergeDepth
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

# Maximum number of cascade merge hops for a single originating PR (optional)
# If omitted, cascade depth is unlimited
maxMergeDepth: 5
`
}
