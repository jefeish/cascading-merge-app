import { Endpoints } from '@octokit/types'
import type { Logger } from 'probot'

type GetRepositoryBranchesResponse =
  Endpoints['GET /repos/{owner}/{repo}/branches']['response']['data']

/**
 * Merges all release branches by ascending order of their semantic version.
 *
 * @param prefixes The prefixes to filter branches by.
 * @param refBranch The branch to merge into after all versioned branches.
 * @param headBranch The head branch to merge from (e.g. feature/abc123).
 * @param baseBranch The base branch to merge into (e.g. release/2022.05.04).
 * @param owner The owner of the repository.
 * @param repo The repository name.
 * @param octokit The octokit instance.
 * @param pullNumber The pull request number.
 * @param actor The actor of the pull request.
 * @param log Probot logger instance.
 * @param verbose If true, creates a GitHub Issue with a Mermaid diagram showing the cascade flow.
 */
export async function cascadingBranchMerge(
  prefixes: string[],
  refBranch: string,
  headBranch: string,
  baseBranch: string,
  owner: string,
  repo: string,
  octokit: any,
  pullNumber: number,
  actor: string,
  log: Logger,
  verbose: boolean = false
) {
  let success = true
  
  // Track created PRs for verbose reporting
  const createdPRs: Array<{
    prNumber: number
    sourceBranch: string
    targetBranch: string
    skipped?: boolean
  }> = []

  // Get all branches in the repository.
  const branches = await octokit.paginate(octokit.rest.repos.listBranches, {
    owner,
    repo
  })
  log.info(`Branches: #${branches.length}`)

  let mergeListHead: string[] = []
  let mergeListBase: string[] = []
  const mergeLists = []
  let mergeList = []

  prefixes.forEach(function (prefix) {
    if (headBranch.startsWith(prefix))
      mergeListHead = getBranchMergeOrder(prefix, headBranch, branches, log)

    if (baseBranch.startsWith(prefix)) {
      mergeListBase = getBranchMergeOrder(prefix, baseBranch, branches, log)
      mergeListBase.push(refBranch)
    }
  })

  log.info(`Merge List Head: ${mergeListHead}`)
  log.info(`Merge List Base: ${mergeListBase}`)

  mergeLists[0] = mergeListHead
  mergeLists[1] = mergeListBase

  for (let a = 0; a < 2; a++) {
    mergeList = mergeLists[a]

    for (let i = 0; i < mergeList.length - 1; i++) {
      let res: Endpoints['POST /repos/{owner}/{repo}/pulls']['response']

      // Create a PR for the next merge.
      try {
        res = await octokit.rest.pulls.create({
          owner,
          repo,
          base: mergeList[i + 1],
          head: mergeList[i],
          title: `Automatic merge from ${mergeList[i]} -> ${mergeList[i + 1]}`,
          body: 'This PR was created automatically by the Cascading Merge App.'
        })
      } catch (error: any) {
        const message = error.response?.data?.errors?.[0]?.message || ''

        if (error.status === 422) {
          if (message.startsWith('No commits between')) {
            log.info(
              `No commits between ${mergeList[i]} and ${mergeList[i + 1]}, skipping PR creation`
            )

            await octokit.rest.issues.createComment({
              owner,
              repo,
              issue_number: pullNumber,
              body: `Skipping creation of cascading PR to merge __${mergeList[i]}__ into __${mergeList[i + 1]}__\n\nThere are no commits between these branches.\n\nContinuing auto-merge activity...`
            })

            // Track skipped PR for verbose reporting
            createdPRs.push({
              prNumber: 0,
              sourceBranch: mergeList[i],
              targetBranch: mergeList[i + 1],
              skipped: true
            })

            continue
          } else if (message.startsWith('A pull request already exists')) {
            log.warn(
              `PR already exists for ${mergeList[i]} -> ${mergeList[i + 1]}`
            )

            await octokit.rest.issues.createComment({
              owner,
              repo,
              issue_number: pullNumber,
              body: `:heavy_exclamation_mark: Tried to create a cascading PR to merge __${mergeList[i]}__ into __${mergeList[i + 1]}__ but there is already a pull request open.\n\nCan't continue auto-merge action.`
            })

            success = false
            break
          }
        }

        // Log unexpected errors
        log.error(error)

        const issue = await octokit.rest.issues.create({
          owner,
          repo,
          assignees: [actor],
          title: ':heavy_exclamation_mark: Cascading Auto-Merge Failure',
          body: `Unknown issue when creating a PR to merge __${mergeList[i]}__ into __${mergeList[i + 1]}__\n\nPlease try to resolve the issue.\n\n**Cascading Auto-Merge has been stopped!**\n\nError: "${JSON.stringify(error.response?.data || error.message)}"`
        })

        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: pullNumber,
          body: `:heavy_exclamation_mark: Tried to create a cascading PR to merge __${mergeList[i]}__ into __${mergeList[i + 1]}__ but encountered an issue.\n\nError: "${JSON.stringify(error.response?.data || error.message)}"\n\nCreated an issue #${issue.data.number}.\n\nCan't continue auto-merge action.`
        })

        success = false
        break
      }

      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body: `Created cascading Auto-Merge PR #${res!.data.number} to merge __${mergeList[i]}__ into __${mergeList[i + 1]}__`
      })

      // Track created PR for verbose reporting
      createdPRs.push({
        prNumber: res!.data.number,
        sourceBranch: mergeList[i],
        targetBranch: mergeList[i + 1]
      })

      // Merge the PR
      try {
        await octokit.rest.pulls.merge({
          owner,
          repo,
          pull_number: res!.data.number
        })
      } catch (error: any) {
        log.error(error)

        if (error.status === 405) {
          // Comment on the original PR, noting that the cascading failed
          const issue = await octokit.rest.issues.create({
            owner,
            repo,
            assignees: [actor],
            title:
              ':heavy_exclamation_mark: Merge Conflict with Cascading Auto-Merge',
            body: `Issue with cascading auto-merge, please try to resolve the merge conflicts.\n\nPR #${res!.data.number}.\n\n**Cascading Auto-Merge has been stopped!**\n\nOriginating PR #${pullNumber}`
          })

          await octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: pullNumber,
            body: `:heavy_exclamation_mark: Could not auto merge PR #${res!.data.number} due to merge conflicts.\n\nCreated an issue #${issue.data.number}.\n\nCan't continue auto-merge action.`
          })

          success = false
          break
        } else {
          const issue = await octokit.rest.issues.create({
            owner,
            repo,
            assignees: [actor],
            title:
              ':heavy_exclamation_mark: Problem with Cascading Auto-Merge.',
            body: `Issue with auto-merging a PR.\n\nPlease try to resolve the Issue.\n\n**Cascading Auto-Merge has been stopped!**\n\nOriginating PR #${pullNumber}\n\nError: ${JSON.stringify(error.response?.data || error.message)}`
          })

          await octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: pullNumber,
            body: `:heavy_exclamation_mark: Tried merge PR #${res!.data.number} to merge __${mergeList[i]}__ into __${mergeList[i + 1]}__ but encountered an issue.\n\nError: "${JSON.stringify(error.response?.data || error.message)}".\n\nCreated an issue #${issue.data.number}.\n\nCan't continue auto-merge action.`
          })

          success = false
          break
        }
      }
    }
  }

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: pullNumber,
    body: success
      ? ':white_check_mark: Auto-merge was successful.'
      : ':bangbang: Auto-merge action did not complete successfully. Please review issues.'
  })

  // If verbose mode is enabled, create a GitHub Issue with the cascade report
  if (verbose && createdPRs.length > 0) {
    await createCascadeReport(
      owner,
      repo,
      octokit,
      pullNumber,
      headBranch,
      baseBranch,
      createdPRs,
      log
    )
  }
}

/**
 * Creates a GitHub Issue with a Mermaid diagram visualizing the cascade flow
 *
 * @param owner The owner of the repository
 * @param repo The repository name
 * @param octokit The octokit instance
 * @param pullNumber The original PR that triggered the cascade
 * @param headBranch The head branch of the original PR
 * @param baseBranch The base branch of the original PR
 * @param createdPRs Array of created PRs with their details
 * @param log Probot logger instance
 */
async function createCascadeReport(
  owner: string,
  repo: string,
  octokit: any,
  pullNumber: number,
  headBranch: string,
  baseBranch: string,
  createdPRs: Array<{
    prNumber: number
    sourceBranch: string
    targetBranch: string
    skipped?: boolean
  }>,
  log: Logger
) {
  log.info('Creating cascade report issue...')

  // Build the Mermaid gitGraph diagram
  // Use init directive to set the feature branch as the main branch so the diagram starts there
  let mermaidDiagram = '```mermaid\n%%{init: {\'gitGraph\': {\'mainBranchName\': \'' + headBranch + '\'}}}%%\ngitGraph\n'
  
  // Start on the head branch (feature branch)
  mermaidDiagram += `  commit id: "Feature changes"\n`
  mermaidDiagram += `  branch "${baseBranch}"\n`
  mermaidDiagram += `  checkout "${baseBranch}"\n`
  mermaidDiagram += `  commit id: "PR #${pullNumber} merged"\n`
  
  // Add each cascade PR as a branch from its source
  for (const pr of createdPRs) {
    if (!pr.skipped) {
      mermaidDiagram += `  checkout "${pr.sourceBranch}"\n`
      mermaidDiagram += `  branch "${pr.targetBranch}"\n`
      mermaidDiagram += `  checkout "${pr.targetBranch}"\n`
      mermaidDiagram += `  commit id: "PR #${pr.prNumber}"\n`
    }
  }
  
  mermaidDiagram += '```'

  // Build the PR summary table
  let prTable = '| PR # | Source Branch | Target Branch | Status |\n'
  prTable += '|------|---------------|---------------|--------|\n'
  
  for (const pr of createdPRs) {
    const status = pr.skipped ? '⏭️ Skipped (no commits)' : '✅ Created & Merged'
    const prLink = pr.skipped ? '-' : `#${pr.prNumber}`
    prTable += `| ${prLink} | \`${pr.sourceBranch}\` | \`${pr.targetBranch}\` | ${status} |\n`
  }

  // Build the issue body
  const issueBody = `# 🔄 Cascade Merge Report

## Trigger Information
- **Original PR**: #${pullNumber}
- **Merged Branch**: \`${headBranch}\` → \`${baseBranch}\`
- **Total Cascade PRs**: ${createdPRs.filter(pr => !pr.skipped).length} created, ${createdPRs.filter(pr => pr.skipped).length} skipped

## Cascade PRs

${prTable}

## Visual Flow

${mermaidDiagram}

---
*This report was automatically generated by the Cascading Merge App in verbose mode.*`

  try {
    const issue = await octokit.rest.issues.create({
      owner,
      repo,
      title: `🔄 Cascade Merge Report: PR #${pullNumber}`,
      body: issueBody,
      labels: ['cascade-report']
    })

    log.info(`Created cascade report issue #${issue.data.number}`)
  } catch (error: any) {
    log.error('Failed to create cascade report issue', error)
  }
}

/**
 * Filters repository branches that start with a specific prefix, followed by a
 * forward slash (e.g. `release/`) and return an ordered list.
 *
 * Ordering is done by comparing the semantic version of the branches.
 *
 * @param prefix The prefix to filter branches by.
 * @param headBranch The head branch to merge from.
 * @param branches The list of branches in the repository.
 * @param log Probot logger instance.
 * @returns The ordered list of branches.
 */
export function getBranchMergeOrder(
  prefix: string,
  headBranch: string,
  branches: GetRepositoryBranchesResponse,
  log: Logger
): string[] {
  const branchList = bitbucketBranchOrderingAlgorithm(
    branches
      .filter(branch => branch.name.startsWith(prefix))
      .map(branch => branch.name),
    headBranch
  )

  log.info(`[getBranchMergeOrder] branchList: ${branchList}`)

  // Return only the versions that are 'younger' than the PR version.
  const headIndex = branchList.indexOf(headBranch)

  return branchList.slice(headIndex)
}

/**
 * Bitbucket branch ordering algorithm.
 *
 * See: https://confluence.atlassian.com/bitbucketserver/cascading-merge-776639993.html
 *
 * @param branchList The list of branches to order.
 * @param targetBranch The target branch to merge into.
 * @returns The ordered branches for the cascade merge.
 */
function bitbucketBranchOrderingAlgorithm(
  branchList: string[],
  targetBranch: string
): string[] {
  const branchPrefix = targetBranch.slice(0, targetBranch.match(/\d/)?.index)

  /* istanbul ignore next */
  if (!branchPrefix) return []

  return (
    branchList
      // - Branches are selected and ordered on the basis of the name of the
      //   branch that started the cascade (i.e. the target of the pull request
      //   for the merge).
      // - Only branches matching the name of the pull request target are added
      //   into the merge path. Matching means that every token before the first
      //   numeric token must be equal to the corresponding tokens of the target
      //   branch's name.
      .filter(b => b.startsWith(branchPrefix))

      // - Branch names are split into tokens using any of these characters:
      //   underscore '_', hyphen  '-', plus '+', or period '.'.
      .map(b => ({
        original: b,
        tokenized: b.split(/[/\-+_.]/)
      }))

      .sort((a, b) => {
        for (
          let i = 0;
          i < Math.max(a.tokenized.length, b.tokenized.length);
          i++
        ) {
          // Skip if equivalent.
          if (a.tokenized[i] === b.tokenized[i]) continue

          // The a version should come first.
          if (i >= a.tokenized.length) return -1
          // The b version should come first.
          else if (i >= b.tokenized.length) return 1

          // actual comparison starts here
          const numberA = parseInt(a.tokenized[i], 10)
          const numberB = parseInt(b.tokenized[i], 10)

          // - Branches are ordered by number, if a given token is numeric. When
          //   comparing a numeric token with an ASCII token, the numeric is
          //   ranked higher (that is, it is considered as being a newer
          //   version).
          if (!isNaN(numberA))
            if (!isNaN(numberB))
              // Both are numbers. Compare directly.
              return numberA - numberB
            else
              // Only a is number, so it comes first.
              return -1
          else if (!isNaN(numberB))
            // Only b is number, so it comes first.
            return 1

          // - If both tokens are non-numeric, a simple ASCII comparison is
          //   used.
          /* istanbul ignore next */
          return a.tokenized[i] > b.tokenized[i] ? 1 : -1
        }

        // - In the unlikely case of the above algorithm resulting in equality
        //   of 2 branch names, a simple string comparison is performed on the
        //   whole branch name.
        /* istanbul ignore next */
        return a.original > b.original ? 1 : -1
      })

      // Convert back to list of strings.
      .map(b => b.original)
  )
}
