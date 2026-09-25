import type { MaxMergeDepthSource } from './depth-control.js'

const MARKER_PREFIX = '<!-- cascading-merge-app:'
const MARKER_REGEX = /<!--\s*cascading-merge-app:(\{[\s\S]*?\})\s*-->/
const MARKER_REGEX_GLOBAL = /<!--\s*cascading-merge-app:(\{[\s\S]*?\})\s*-->/g

const LEGACY_CASCADE_METADATA_VERSION = 1
export const CASCADE_METADATA_VERSION = 2

interface MetadataEnvelope {
  version: number
  kind: 'cascade' | 'repair'
}

/**
 * State embedded in an app-created cascade PR after its automatic merge stalls,
 * allowing the cascade to resume from that exact hop with its depth budget intact.
 */
export interface CascadeMetadata extends MetadataEnvelope {
  kind: 'cascade'
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

/**
 * State embedded in an app-created repair PR. The linked cascade PR remains the
 * authority for the originating PR and remaining depth budget.
 */
export interface CascadeRepairMetadata extends MetadataEnvelope {
  kind: 'repair'
  originatingPr: number
  stalledPr: number
  repairBranch: string
  protectedSourceBranch: string
  stalledTargetBranch: string
}

export type AppMetadata = CascadeMetadata | CascadeRepairMetadata

export interface CascadeResumeState {
  remainingDepth: number | null
  resumedFromPr: number
}

function hasSameIdentity(left: AppMetadata, right: AppMetadata): boolean {
  if (left.kind !== right.kind) return false

  if (left.kind === 'cascade' && right.kind === 'cascade') {
    return (
      left.originatingPr === right.originatingPr &&
      left.sourceBranch === right.sourceBranch &&
      left.targetBranch === right.targetBranch
    )
  }

  if (left.kind === 'repair' && right.kind === 'repair') {
    return (
      left.originatingPr === right.originatingPr &&
      left.stalledPr === right.stalledPr &&
      left.repairBranch === right.repairBranch
    )
  }

  return false
}

export function appendCascadeMetadata(
  body: string | null | undefined,
  metadata: AppMetadata
): string {
  const existingMetadata =
    parseCascadeMetadata(body) ?? parseRepairMetadata(body)

  if (existingMetadata && !hasSameIdentity(existingMetadata, metadata)) {
    throw new Error(
      'PR body already contains metadata for a different cascade operation'
    )
  }

  const marker = `${MARKER_PREFIX}${JSON.stringify(metadata)} -->`
  const normalizedBody = body?.replace(MARKER_REGEX_GLOBAL, '').trim()

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

export function buildRepairPrBody(metadata: CascadeRepairMetadata): string {
  const body = [
    'This draft PR was created by the Cascading Merge App to resolve a protected-branch conflict.',
    '',
    `It repairs stalled cascade PR #${metadata.stalledPr} without starting a new cascade.`,
    '',
    buildRepairInstructions(metadata)
  ].join('\n')

  return appendCascadeMetadata(body, metadata)
}

export function buildRepairInstructions(
  metadata: Pick<
    CascadeRepairMetadata,
    'stalledPr' | 'repairBranch' | 'protectedSourceBranch'
  >
): string {
  return [
    'To resolve the conflict:',
    '',
    `1. Check out \`${metadata.repairBranch}\`.`,
    `2. Merge \`${metadata.protectedSourceBranch}\` into the repair branch.`,
    '3. Resolve and commit all conflicts.',
    '4. Push the repair branch and mark this PR ready for review.',
    '5. Merge this PR through the normal protected-branch process.',
    '',
    `After this PR merges, the app will retry PR #${metadata.stalledPr} and resume the original cascade.`
  ].join('\n')
}

function parseRawMetadata(
  body: string | null | undefined
): Record<string, unknown> | null {
  if (!body) return null

  const match = MARKER_REGEX.exec(body)
  if (!match) return null

  let parsed: unknown

  try {
    parsed = JSON.parse(match[1])
  } catch {
    return null
  }

  return typeof parsed === 'object' && parsed !== null
    ? (parsed as Record<string, unknown>)
    : null
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function parseContinuationCandidate(
  candidate: Record<string, unknown>
): CascadeMetadata | null {
  const isLegacy =
    candidate.version === LEGACY_CASCADE_METADATA_VERSION &&
    candidate.kind === undefined
  const isCurrent =
    candidate.version === CASCADE_METADATA_VERSION &&
    candidate.kind === 'cascade'

  if (
    (!isLegacy && !isCurrent) ||
    typeof candidate.originatingPr !== 'number' ||
    typeof candidate.sourceBranch !== 'string' ||
    typeof candidate.targetBranch !== 'string'
  ) {
    return null
  }

  return {
    version: CASCADE_METADATA_VERSION,
    kind: 'cascade',
    originatingPr: candidate.originatingPr,
    originatingPrTitle: optionalString(candidate.originatingPrTitle),
    originatingPrSource: optionalString(candidate.originatingPrSource),
    sourceBranch: candidate.sourceBranch,
    targetBranch: candidate.targetBranch,
    remainingDepth:
      typeof candidate.remainingDepth === 'number'
        ? candidate.remainingDepth
        : null,
    maxMergeDepth:
      typeof candidate.maxMergeDepth === 'number'
        ? candidate.maxMergeDepth
        : null,
    maxMergeDepthSource:
      candidate.maxMergeDepthSource === 'global' ||
      candidate.maxMergeDepthSource === 'org' ||
      candidate.maxMergeDepthSource === 'repo'
        ? candidate.maxMergeDepthSource
        : undefined,
    refBranch: optionalString(candidate.refBranch)
  }
}

/**
 * Extracts continuation metadata from a PR body. Legacy version 1 markers are
 * normalized to the current typed representation.
 */
export function parseCascadeMetadata(
  body: string | null | undefined
): CascadeMetadata | null {
  const candidate = parseRawMetadata(body)
  return candidate ? parseContinuationCandidate(candidate) : null
}

export function parseRepairMetadata(
  body: string | null | undefined
): CascadeRepairMetadata | null {
  const candidate = parseRawMetadata(body)

  if (
    !candidate ||
    candidate.version !== CASCADE_METADATA_VERSION ||
    candidate.kind !== 'repair' ||
    typeof candidate.originatingPr !== 'number' ||
    typeof candidate.stalledPr !== 'number' ||
    typeof candidate.repairBranch !== 'string' ||
    typeof candidate.protectedSourceBranch !== 'string' ||
    typeof candidate.stalledTargetBranch !== 'string'
  ) {
    return null
  }

  return {
    version: CASCADE_METADATA_VERSION,
    kind: 'repair',
    originatingPr: candidate.originatingPr,
    stalledPr: candidate.stalledPr,
    repairBranch: candidate.repairBranch,
    protectedSourceBranch: candidate.protectedSourceBranch,
    stalledTargetBranch: candidate.stalledTargetBranch
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

export function parseMatchingRepairMetadata(
  body: string | null | undefined,
  headBranch: string,
  baseBranch: string
): CascadeRepairMetadata | null {
  const metadata = parseRepairMetadata(body)

  if (
    metadata?.repairBranch !== headBranch ||
    metadata.protectedSourceBranch !== baseBranch
  ) {
    return null
  }

  return metadata
}
