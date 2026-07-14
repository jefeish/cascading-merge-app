import { Probot } from 'probot'
import { cascadingBranchMerge } from './lib/cascading-branch-merge.js'
import { loadConfig } from './lib/config.js'

/**
 * Main Probot app function
 * Handles pull_request.closed events and triggers cascade merging
 */
export default (app: Probot) => {
  app.log.info('Cascading Merge App loaded!')

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

    // Check if this PR was created by the bot (cascade PR)
    // Bot PRs should NOT trigger cascade logic because all cascade PRs
    // were already created by the original PR
    const isBotPR = pull_request.user.type === 'Bot' || 
                    pull_request.title.startsWith('Automatic merge from')
    
    if (isBotPR) {
      context.log.info(
        `PR #${pull_request.number} is a bot-created cascade PR, skipping cascade logic (all cascade PRs already created by original PR)`
      )
      return
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
        `Configuration loaded: prefixes=[${config.prefixes.join(', ')}], ref_branch=${config.ref_branch}, verbose=${config.verbose ?? false}`
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
      await cascadingBranchMerge(
        config.prefixes,
        config.ref_branch,
        pull_request.head.ref,
        pull_request.base.ref,
        owner,
        repo,
        context.octokit,
        pull_request.number,
        actor,
        context.log,
        config.verbose ?? false
      )

      context.log.info(
        `Cascade merge completed for PR #${pull_request.number}`
      )
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
