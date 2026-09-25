import {
  parseMatchingCascadeMetadata,
  parseMatchingRepairMetadata,
  type CascadeMetadata,
  type CascadeRepairMetadata
} from './cascade-metadata.js'

interface PullRequestRouteInput {
  body: string | null
  title: string
  user: { type: string }
  head: {
    ref: string
    repo: { full_name: string } | null
  }
  base: { ref: string }
}

export type PullRequestRoute =
  | { kind: 'repair'; metadata: CascadeRepairMetadata }
  | { kind: 'resume'; metadata: CascadeMetadata }
  | { kind: 'skip-bot' }
  | { kind: 'normal'; rejectedRepairMetadata: boolean }

export function classifyPullRequest(
  pullRequest: PullRequestRouteInput,
  repositoryFullName: string
): PullRequestRoute {
  const repairMetadata = parseMatchingRepairMetadata(
    pullRequest.body,
    pullRequest.head.ref,
    pullRequest.base.ref
  )

  if (
    repairMetadata &&
    pullRequest.user.type === 'Bot' &&
    pullRequest.head.repo?.full_name === repositoryFullName
  ) {
    return { kind: 'repair', metadata: repairMetadata }
  }

  const continuationMetadata = parseMatchingCascadeMetadata(
    pullRequest.body,
    pullRequest.head.ref,
    pullRequest.base.ref
  )

  if (continuationMetadata) {
    return { kind: 'resume', metadata: continuationMetadata }
  }

  const isBot =
    pullRequest.user.type === 'Bot' ||
    pullRequest.title.startsWith('Automatic merge from')

  if (isBot) {
    return { kind: 'skip-bot' }
  }

  return {
    kind: 'normal',
    rejectedRepairMetadata: repairMetadata !== null
  }
}

export function shouldProcessCascadeBase(
  prefixes: string[],
  baseBranch: string,
  continuation?: CascadeMetadata
): boolean {
  return (
    prefixes.some(prefix => baseBranch.startsWith(prefix)) ||
    continuation?.refBranch === baseBranch
  )
}
