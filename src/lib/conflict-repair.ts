import type { Context, Logger } from 'probot'
import {
  buildRepairPrBody,
  CASCADE_METADATA_VERSION,
  parseMatchingCascadeMetadata,
  type CascadeMetadata,
  type CascadeRepairMetadata
} from './cascade-metadata.js'

type PullRequestOctokit = Context<'pull_request.closed'>['octokit']

interface CreateConflictRepairOptions {
  owner: string
  repo: string
  octokit: PullRequestOctokit
  log: Logger
  stalledPr: number
  continuation: CascadeMetadata
}

export interface ConflictRepair {
  branch: string
  pullNumber: number
}

const wait = (milliseconds: number) =>
  new Promise(resolve => setTimeout(resolve, milliseconds))

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 404
  )
}

function getErrorStatus(error: unknown): number | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    return error.status
  }

  return undefined
}

export async function confirmPullRequestConflict(
  owner: string,
  repo: string,
  octokit: PullRequestOctokit,
  pullNumber: number
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber
    })
    const pull = response.data

    if (pull.mergeable === false || pull.mergeable_state === 'dirty') {
      return
    }

    if (pull.mergeable === true) {
      throw new Error(
        `PR #${pullNumber} could not be merged automatically, but GitHub reports no merge conflict`
      )
    }

    if (attempt < 2) await wait(500)
  }

  throw new Error(
    `GitHub did not determine whether PR #${pullNumber} has a merge conflict`
  )
}

function createRepairBranchName(
  stalledPr: number,
  sourceSha: string,
  targetSha: string
): string {
  return `cascade-fix/${stalledPr}-${sourceSha.slice(0, 7)}-${targetSha.slice(0, 7)}`
}

export async function createOrReuseConflictRepair({
  owner,
  repo,
  octokit,
  log,
  stalledPr,
  continuation
}: CreateConflictRepairOptions): Promise<ConflictRepair> {
  const [source, target] = await Promise.all([
    octokit.rest.repos.getBranch({
      owner,
      repo,
      branch: continuation.sourceBranch
    }),
    octokit.rest.repos.getBranch({
      owner,
      repo,
      branch: continuation.targetBranch
    })
  ])

  const sourceSha = source.data.commit.sha
  const targetSha = target.data.commit.sha
  const branch = createRepairBranchName(stalledPr, sourceSha, targetSha)
  const metadata: CascadeRepairMetadata = {
    version: CASCADE_METADATA_VERSION,
    kind: 'repair',
    originatingPr: continuation.originatingPr,
    stalledPr,
    repairBranch: branch,
    protectedSourceBranch: continuation.sourceBranch,
    stalledTargetBranch: continuation.targetBranch
  }

  const existingPulls = await octokit.rest.pulls.list({
    owner,
    repo,
    state: 'open',
    head: `${owner}:${branch}`,
    base: continuation.sourceBranch,
    per_page: 1
  })
  const existingPull = existingPulls.data[0]

  if (existingPull) {
    await octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: existingPull.number,
      body: buildRepairPrBody(metadata)
    })
    log.info(
      `Reusing repair PR #${existingPull.number} for stalled cascade PR #${stalledPr}`
    )
    return { branch, pullNumber: existingPull.number }
  }

  try {
    const existingRef = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    })

    if (existingRef.data.object.sha !== targetSha) {
      throw new Error(
        `Repair branch ${branch} exists at an unexpected commit and cannot be reused`
      )
    }
  } catch (error: unknown) {
    if (!isNotFound(error)) throw error

    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: targetSha
    })
  }

  const repairPull = await octokit.rest.pulls.create({
    owner,
    repo,
    head: branch,
    base: continuation.sourceBranch,
    draft: true,
    title: `Resolve cascade conflict for PR #${stalledPr}`,
    body: buildRepairPrBody(metadata)
  })

  log.info(
    `Created repair PR #${repairPull.data.number} for stalled cascade PR #${stalledPr}`
  )

  return { branch, pullNumber: repairPull.data.number }
}

interface HandleRepairMergeOptions {
  owner: string
  repo: string
  octokit: PullRequestOctokit
  log: Logger
  repairMetadata: CascadeRepairMetadata
  repairPullNumber: number
  repairHeadSha: string
}

async function deleteRepairBranch(
  owner: string,
  repo: string,
  octokit: PullRequestOctokit,
  log: Logger,
  branch: string,
  expectedSha: string
): Promise<void> {
  try {
    const ref = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    })

    if (ref.data.object.sha !== expectedSha) {
      log.warn(
        `Repair branch ${branch} moved after PR merge; leaving it in place`
      )
      return
    }

    await octokit.rest.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branch}`
    })
  } catch (error: unknown) {
    if (!isNotFound(error)) throw error
  }
}

export async function handleRepairMerge({
  owner,
  repo,
  octokit,
  log,
  repairMetadata,
  repairPullNumber,
  repairHeadSha
}: HandleRepairMergeOptions): Promise<void> {
  const stalledResponse = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: repairMetadata.stalledPr
  })
  const stalledPull = stalledResponse.data
  const continuation = parseMatchingCascadeMetadata(
    stalledPull.body,
    stalledPull.head.ref,
    stalledPull.base.ref
  )

  if (
    !continuation ||
    continuation.originatingPr !== repairMetadata.originatingPr ||
    stalledPull.head.ref !== repairMetadata.protectedSourceBranch ||
    stalledPull.base.ref !== repairMetadata.stalledTargetBranch ||
    (stalledPull.user?.type !== 'Bot' &&
      !stalledPull.title.startsWith('Automatic merge from'))
  ) {
    throw new Error(
      `Repair PR #${repairPullNumber} does not reference a valid stalled cascade PR`
    )
  }

  if (stalledPull.state !== 'open') {
    if (stalledPull.merged_at) {
      await deleteRepairBranch(
        owner,
        repo,
        octokit,
        log,
        repairMetadata.repairBranch,
        repairHeadSha
      )
      return
    }

    throw new Error(
      `Stalled cascade PR #${repairMetadata.stalledPr} is closed without being merged`
    )
  }

  try {
    const normalizedOriginTitle = continuation.originatingPrTitle?.trim()
    const normalizedOriginSource = continuation.originatingPrSource?.trim()
    const commitTitle =
      normalizedOriginTitle && normalizedOriginSource
        ? `PR #${continuation.originatingPr} from ${normalizedOriginSource}: ${normalizedOriginTitle}`
        : normalizedOriginTitle
    const mergeResult = await octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number: repairMetadata.stalledPr,
      ...(commitTitle
        ? {
            commit_title: commitTitle,
            commit_message: `Cascade merge: ${continuation.sourceBranch} -> ${continuation.targetBranch}\n\nOriginating PR #${continuation.originatingPr}`
          }
        : {})
    })

    if (!mergeResult.data.merged) {
      throw new Error(
        `GitHub did not merge stalled cascade PR #${repairMetadata.stalledPr}: ${mergeResult.data.message}`
      )
    }
  } catch (error: unknown) {
    if (getErrorStatus(error) !== 405) throw error

    await confirmPullRequestConflict(
      owner,
      repo,
      octokit,
      repairMetadata.stalledPr
    )

    const nextRepair = await createOrReuseConflictRepair({
      owner,
      repo,
      octokit,
      log,
      stalledPr: repairMetadata.stalledPr,
      continuation
    })

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: continuation.originatingPr,
      body: `:warning: Repair PR #${repairPullNumber} merged, but cascade PR #${repairMetadata.stalledPr} still conflicts. Continue resolution in repair PR #${nextRepair.pullNumber}.`
    })
    return
  }

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: continuation.originatingPr,
    body: `:white_check_mark: Repair PR #${repairPullNumber} resolved cascade PR #${repairMetadata.stalledPr}. Waiting for the original cascade to resume.`
  })

  await deleteRepairBranch(
    owner,
    repo,
    octokit,
    log,
    repairMetadata.repairBranch,
    repairHeadSha
  )
}
