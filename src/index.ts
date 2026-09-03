import { Probot } from 'probot'
import { parseCascadeMetadata } from './lib/cascade-metadata.js'
import { cascadingBranchMerge } from './lib/cascading-branch-merge.js'
import { loadConfig, loadOrgMaxMergeDepth } from './lib/config.js'
import {
    parseGlobalMaxMergeDepth,
    resolveEffectiveMaxMergeDepth,
    resolveMaxMergeDepthSource
} from './lib/depth-control.js'

/**
 * Main Probot app function
 * Handles pull_request.closed events and triggers cascade merging
 */
export default (app: Probot) => {
  const globalMaxMergeDepth = parseGlobalMaxMergeDepth()
  const orgConfigRepo = process.env.ORG_CONFIG_REPO?.trim()
  const orgConfigPath = process.env.ORG_CONFIG_PATH?.trim()

  app.log.info('Cascading Merge App loaded!')
  app.log.info(
    `App-level maxMergeDepth setting: MAX_MERGE_DEPTH=${globalMaxMergeDepth ?? 'unlimited'}`
  )
  app.log.info(
    orgConfigRepo || orgConfigPath
      ? `Org-level maxMergeDepth config settings: ORG_CONFIG_REPO=${orgConfigRepo || 'unset'}, ORG_CONFIG_PATH=${orgConfigPath || 'unset'}`
      : 'Org-level maxMergeDepth config settings: ORG_CONFIG_REPO=unset, ORG_CONFIG_PATH=unset'
  )

  // Handle pull_request closed events
  app.on('pull_request.closed', async context => {
    const { pull_request, repository, sender } = context.payload

    // Only process if the PR was actually merged (not just closed)
    if (!pull_request.merged) {
      context.log.info(
        `PR #${pull_request.number} was closed without merging, skipping cascade`
      )
      return
    }

    context.log.info(
      `Processing merged PR #${pull_request.number}: ${pull_request.title}`
    )
    context.log.info(`Head branch: ${pull_request.head.ref}`)
    context.log.info(`Base branch: ${pull_request.base.ref}`)

    // Bot-created cascade PRs normally must not re-trigger a cascade, because the
    // originating PR already created the full chain. The exception is a cascade PR
    // that stalled on a merge conflict: its body carries the state needed to pick up
    // where the interrupted cascade left off, without restarting the depth budget.
    const isBotPR =
      pull_request.user.type === 'Bot' ||
      pull_request.title.startsWith('Automatic merge from')

    const resumeMetadata = isBotPR
      ? parseCascadeMetadata(pull_request.body)
      : null

    if (isBotPR && !resumeMetadata) {
      context.log.info(
        `PR #${pull_request.number} is a bot-created cascade PR without cascade metadata, skipping cascade logic`
      )
      return
    }

    if (resumeMetadata) {
      context.log.info(
        `PR #${pull_request.number} is a stalled cascade PR from originating PR #${resumeMetadata.originatingPr}, resuming with remainingDepth=${resumeMetadata.remainingDepth ?? 'unlimited'}`
      )
    }

    try {
      // Load configuration from repository
      const config = await loadConfig(context)

      // If config is null, the repository should be skipped
      if (!config) {
        context.log.info(
          `Skipping cascade merge for ${repository.full_name}: No .github/cascading-merge.yml found`
        )
        return
      }

      context.log.info(
        `Configuration loaded: prefixes=[${config.prefixes.join(', ')}], ref_branch=${config.ref_branch ?? 'none'}, verbose=${config.verbose ?? false}, maxMergeDepth=${config.maxMergeDepth ?? 'unlimited'}`
      )

      const orgMaxMergeDepth = resumeMetadata
        ? undefined
        : await loadOrgMaxMergeDepth(context)

      // A resumed cascade inherits the depth settings recorded when it first started,
      // so reported limits stay consistent across the interruption.
      const effectiveMaxMergeDepth = resumeMetadata
        ? (resumeMetadata.maxMergeDepth ?? undefined)
        : resolveEffectiveMaxMergeDepth(
            config.maxMergeDepth,
            orgMaxMergeDepth,
            globalMaxMergeDepth
          )

      const maxMergeDepthSource = resumeMetadata
        ? resumeMetadata.maxMergeDepthSource
        : resolveMaxMergeDepthSource(
            effectiveMaxMergeDepth,
            config.maxMergeDepth,
            orgMaxMergeDepth,
            globalMaxMergeDepth
          )

      context.log.info(
        `Resolved maxMergeDepth: repo=${config.maxMergeDepth ?? 'unlimited'}, org=${orgMaxMergeDepth ?? 'unlimited'}, app=${globalMaxMergeDepth ?? 'unlimited'}, effective=${effectiveMaxMergeDepth ?? 'unlimited'}`
      )

      // Check if the base branch matches any configured prefix
      const matchesPrefix = config.prefixes.some(prefix =>
        pull_request.base.ref.startsWith(prefix)
      )

      if (!matchesPrefix) {
        context.log.info(
          `Base branch "${pull_request.base.ref}" does not match any configured prefix, skipping cascade`
        )
        return
      }

      // Extract repository details
      const owner = repository.owner.login
      const repo = repository.name
      const actor = sender.login

      context.log.info(
        `Starting cascade merge for ${owner}/${repo} from ${pull_request.base.ref}`
      )

      // Trigger the cascading merge
      const originatingPrSource = pull_request.head.label.replace(':', '/')

      if (resumeMetadata) {
        await context.octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: resumeMetadata.originatingPr,
          body: `:arrow_forward: Resuming interrupted cascade from PR #${pull_request.number} at __${pull_request.base.ref}__ with ${resumeMetadata.remainingDepth ?? 'unlimited'} remaining merge(s).`
        })
      }

      await cascadingBranchMerge(
        config.prefixes,
        config.ref_branch,
        pull_request.head.ref,
        pull_request.base.ref,
        owner,
        repo,
        context.octokit,
        resumeMetadata?.originatingPr ?? pull_request.number,
        actor,
        context.log,
        config.verbose ?? false,
        effectiveMaxMergeDepth,
        resumeMetadata?.originatingPrTitle ?? pull_request.title,
        resumeMetadata?.originatingPrSource ?? originatingPrSource,
        maxMergeDepthSource,
        resumeMetadata
          ? {
              remainingDepth: resumeMetadata.remainingDepth,
              resumedFromPr: pull_request.number
            }
          : undefined
      )

      context.log.info(`Cascade merge completed for PR #${pull_request.number}`)
    } catch (error: any) {
      context.log.error(
        `Error processing cascade merge for PR #${pull_request.number} in ${repository.full_name}: ${error.message}`
      )

      // Try to comment on the PR about the error
      try {
        await context.octokit.rest.issues.createComment({
          owner: repository.owner.login,
          repo: repository.name,
          issue_number: pull_request.number,
          body: `:x: **Cascading Merge App Error**\n\nAn error occurred while processing the cascade merge:\n\n\`\`\`\n${error.message}\n\`\`\`\n\nPlease check the app logs for more details.`
        })
      } catch (commentError: any) {
        context.log.error(
          `Failed to comment error on PR: ${commentError.message}`
        )
      }
    }
  })

  // Optional: Health check endpoint
  app.on('ping', async context => {
    context.log.info('Ping received from GitHub!')
  })
}
