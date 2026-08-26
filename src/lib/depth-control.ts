/**
 * Parses global max merge depth from environment variables.
 * Supports both MAX_MERGE_DEPTH and maxMergeDepth.
 */
export function parseGlobalMaxMergeDepth(
  env: NodeJS.ProcessEnv = process.env
): number | undefined {
  const raw = env.MAX_MERGE_DEPTH ?? env.maxMergeDepth

  if (raw === undefined || raw.trim() === '') {
    return undefined
  }

  const parsed = Number(raw)

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(
      'Configuration error: global MAX_MERGE_DEPTH must be an integer greater than or equal to 1 when provided'
    )
  }

  return parsed
}

/**
 * Applies global cap over repo-level max merge depth.
 * Global value is a hard upper bound and cannot be exceeded by repository config.
 */
export function resolveEffectiveMaxMergeDepth(
  repoMaxMergeDepth: number | undefined,
  globalMaxMergeDepth: number | undefined
): number | undefined {
  if (globalMaxMergeDepth === undefined) {
    return repoMaxMergeDepth
  }

  if (repoMaxMergeDepth === undefined) {
    return globalMaxMergeDepth
  }

  return Math.min(repoMaxMergeDepth, globalMaxMergeDepth)
}
