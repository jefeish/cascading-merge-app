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
  orgMaxMergeDepth: number | undefined,
  globalMaxMergeDepth: number | undefined
): number | undefined {
  const configuredDepths = [
    repoMaxMergeDepth,
    orgMaxMergeDepth,
    globalMaxMergeDepth
  ].filter((depth): depth is number => depth !== undefined)

  if (configuredDepths.length === 0) {
    return undefined
  }

  return Math.min(...configuredDepths)
}

export type MaxMergeDepthSource = 'global' | 'org' | 'repo'

export function resolveMaxMergeDepthSource(
  effectiveMaxMergeDepth: number | undefined,
  repoMaxMergeDepth: number | undefined,
  orgMaxMergeDepth: number | undefined,
  globalMaxMergeDepth: number | undefined
): MaxMergeDepthSource | undefined {
  if (effectiveMaxMergeDepth === undefined) {
    return undefined
  }

  if (repoMaxMergeDepth === effectiveMaxMergeDepth) {
    return 'repo'
  }

  if (orgMaxMergeDepth === effectiveMaxMergeDepth) {
    return 'org'
  }

  if (globalMaxMergeDepth === effectiveMaxMergeDepth) {
    return 'global'
  }

  return undefined
}
