import type { MaxMergeDepthSource } from './depth-control.js'

const MARKER_PREFIX = '<!-- cascading-merge-app:'
const MARKER_REGEX = /<!--\s*cascading-merge-app:(\{[\s\S]*?\})\s*-->/

export const CASCADE_METADATA_VERSION = 1

/**
 * State embedded in an app-created cascade PR after its automatic merge stalls,
 * allowing the cascade to resume from that exact hop with its depth budget intact.
 */
export interface CascadeMetadata {
  version: number
  originatingPr: number
  originatingPrTitle?: string
  originatingPrSource?: string
  sourceBranch: string
  targetBranch: string
  /** Hops still allowed after this PR is merged. `null` means unlimited. */
  remainingDepth: number | null
  maxMergeDepth: number | null
  maxMergeDepthSource?: MaxMergeDepthSource
  refBranch?: string
}

export interface CascadeResumeState {
  remainingDepth: number | null
  resumedFromPr: number
}

export function appendCascadeMetadata(
  body: string | null | undefined,
  metadata: CascadeMetadata
): string {
  const marker = `${MARKER_PREFIX}${JSON.stringify(metadata)} -->`
  const normalizedBody = body?.trim()

  return normalizedBody ? `${normalizedBody}\n\n${marker}` : marker
}

/**
 * Builds a cascade PR body with a hidden, machine-readable metadata marker.
 */
export function buildCascadePrBody(metadata: CascadeMetadata): string {
  const body = [
    'This PR was created automatically by the Cascading Merge App.',
    '',
    `Originating PR #${metadata.originatingPr}`
  ].join('\n')

  return appendCascadeMetadata(body, metadata)
}

/**
 * Extracts cascade metadata from a PR or issue body. Returns `null` when the
 * body carries no valid marker, so callers can fall back to legacy behavior.
 */
export function parseCascadeMetadata(
  body: string | null | undefined
): CascadeMetadata | null {
  if (!body) return null

  const match = MARKER_REGEX.exec(body)
  if (!match) return null

  let parsed: unknown

  try {
    parsed = JSON.parse(match[1])
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) return null

  const candidate = parsed as Partial<CascadeMetadata>

  if (
    candidate.version !== CASCADE_METADATA_VERSION ||
    typeof candidate.originatingPr !== 'number' ||
    typeof candidate.sourceBranch !== 'string' ||
    typeof candidate.targetBranch !== 'string'
  ) {
    return null
  }

  const remainingDepth =
    typeof candidate.remainingDepth === 'number'
      ? candidate.remainingDepth
      : null
  const maxMergeDepth =
    typeof candidate.maxMergeDepth === 'number' ? candidate.maxMergeDepth : null

  return {
    version: CASCADE_METADATA_VERSION,
    originatingPr: candidate.originatingPr,
    originatingPrTitle: candidate.originatingPrTitle,
    originatingPrSource: candidate.originatingPrSource,
    sourceBranch: candidate.sourceBranch,
    targetBranch: candidate.targetBranch,
    remainingDepth,
    maxMergeDepth,
    maxMergeDepthSource: candidate.maxMergeDepthSource,
    refBranch: candidate.refBranch
  }
}

export function parseMatchingCascadeMetadata(
  body: string | null | undefined,
  sourceBranch: string,
  targetBranch: string
): CascadeMetadata | null {
  const metadata = parseCascadeMetadata(body)

  if (
    metadata?.sourceBranch !== sourceBranch ||
    metadata.targetBranch !== targetBranch
  ) {
    return null
  }

  return metadata
}
