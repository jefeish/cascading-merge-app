/**
 * Configuration interface for cascading merge settings
 */
export interface CascadingMergeConfig {
  /**
   * List of branch prefixes to match for cascade merging
   * Example: ['release/', 'feature/']
   */
  prefixes: string[]

  /**
   * The final branch to merge into after all versioned branches
   * Example: 'develop' or 'main'
   */
  ref_branch: string

  /**
   * If true, creates a GitHub Issue with a Mermaid diagram showing the cascade flow
   * Example: true or false
   */
  verbose?: boolean
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: CascadingMergeConfig = {
  prefixes: ['release/'],
  ref_branch: 'develop',
  verbose: false
}
