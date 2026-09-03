# Cascading Merge App - Throughput Capacity by Organization Size

## Quick Answer: How Much Can This App Handle Per Org?

The Cascading Merge App is limited by **GitHub's API rate limit of 15,000 requests per hour** per GitHub App installation.

Each cascade merge operation costs approximately **22 API calls** (with typical configuration: `maxMergeDepth=5` + `ref_branch`).

---

## Where the API Calls Go

Counts below are per cascade run, measured against the current implementation.

### Fixed overhead

| Call | Count | When |
|---|---|---|
| `repos.getContent` — repo config | 1 | Always |
| `repos.getContent` — org config | 0 or 1 | Only when `ORG_CONFIG_REPO` and `ORG_CONFIG_PATH` are set |
| `repos.listBranches` (paginated) | 1+ | One call per 100 branches in the repository |
| `issues.createComment` — depth-limit notice | 0 or 1 | Only when `maxMergeDepth` stops the cascade |
| `issues.createComment` — final status | 1 | Always |
| `issues.create` — verbose report | 0 or 1 | Only when `verbose: true` |

**Typical fixed cost: 4 calls** (repo config + branch list + depth notice + final status).

### Per cascade hop

| Outcome | Calls | Breakdown |
|---|---|---|
| Normal hop | **3** | `pulls.create` + `issues.createComment` + `pulls.merge` |
| Skipped (no commits between) | **2** | Failed `pulls.create` + `issues.createComment` |
| Merge conflict (cascade stops) | **5** | `pulls.create` + comment + failed `pulls.merge` + `issues.create` + comment |

### Resuming after a conflict

A resumed cascade is a second run, so it re-pays the fixed overhead plus one extra `issues.createComment` for the "Resuming interrupted cascade" notice — roughly **5 additional calls**, then 3 per remaining hop. It does *not* redo the hops already completed, so the total stays proportional to `maxMergeDepth` rather than doubling.

---

## Throughput Capacity by Organization Size

| Organization Size | Typical Load | API Calls/Hour | ✅ Capacity |
|------------------|--------------|---------------|-----------|
| **Small** | 5 cascades/hr | 110 | **Safe** ✅ |
| **Medium** | 50 cascades/hr | 1,100 | **Safe** ✅ |
| **Large** | 200 cascades/hr | 4,400 | **Safe** ✅ |
| **Very Large** | 400 cascades/hr | 8,800 | **Safe** ✅ |
| **Enterprise** | 550 cascades/hr | 12,100 | **Approaching Limit** ⚠️ |
| **Extreme** | 682+ cascades/hr | 15,000+ | **At/Over Limit** 🔴 |

### Interpretation

- **Safe** = Under 65% API utilization (plenty of headroom)
- **Approaching Limit** = 65-85% utilization (monitor closely)
- **At/Over Limit** = Cascades will be queued/throttled waiting for rate limit reset

---

## How to Calculate Your Org's Capacity

**Formula**:
```
Max Cascades/Hour = 15,000 / Average_API_Calls_Per_Cascade
```

**Example with typical config** (`maxMergeDepth=5` + `ref_branch`):
```
Fixed overhead                = 4 calls
6 merges (5 + final ref hop)  = 6 x 3 = 18 calls
Average API calls per cascade = 22
Max cascades/hour = 15,000 / 22 = 682 cascades/hour
```

### Adjust Based on Your Configuration

| Config Setting | Impact on API Calls | Throughput Effect |
|---|---|---|
| `maxMergeDepth=3` (actual: 4 merges) | ~16 calls | **937 cascades/hr** |
| `maxMergeDepth=5` (actual: 6 merges) | ~22 calls | **682 cascades/hr** |
| `maxMergeDepth=10` (actual: 11 merges) | ~37 calls | **405 cascades/hr** |
| Without `ref_branch` | -3 calls | **+16% throughput** |
| Org-level config enabled | +1 call | **-5% throughput** |
| `verbose: true` | +1 call | **-5% throughput** |
| Repository with 100+ branches | +1 call per extra 100 | Minor |
| With merge conflicts | +2 calls, then the cascade stops | Fewer hops overall, but a resume adds ~5 calls |

---

## Important: What is "maxMergeDepth"?

The `maxMergeDepth` setting controls how many downstream branches are merged. However, when `ref_branch` is configured (standard setup), the app always performs **one additional final merge** to the `ref_branch` after reaching the depth limit.

**This means actual merges = `maxMergeDepth + 1`**

For example, with `maxMergeDepth=5`:
- 5 cascade merges to release branches
- +1 final merge to `ref_branch` (e.g., `main`)
- **Total: 6 merges per cascade**

See [configuration documentation](./QUICKSTART.md) for details.

---

## Why the Load Is Bursty: Merges Happen Inline

The figures above assume the app's current merge model: for every hop the app creates a cascade PR and **immediately merges it** in the same webhook handler, in sequence, before moving to the next hop. The whole cascade is one uninterrupted burst of API calls triggered by a single `pull_request.closed` event.

That is what makes rate limiting the binding constraint. A `maxMergeDepth=10` cascade spends ~37 calls within a few seconds, and 400 such cascades landing in the same hour compete for one 15,000-call budget.

> **Note**: There is currently no configuration option to disable this behavior. `.github/cascading-merge.yml` supports `prefixes`, `ref_branch`, `verbose`, and `maxMergeDepth` only.

### What a review-gated mode would change

If the app instead created one cascade PR and waited for a developer to merge it, the same total number of API calls would be spread across hours or days rather than seconds:

- Each hop becomes its own webhook-triggered run, so calls are spaced by human review latency.
- Instantaneous burst rate drops to roughly one hop's worth of calls per merge event.
- Total calls per cascade go **up**, not down, because every hop re-pays the fixed overhead (config load, branch list, status comment). Expect ~7-8 calls per hop instead of 3.
- Rate limit pressure nevertheless falls sharply, because the limit is per hour and review delays naturally spread the load.

In short: sustained throughput would improve substantially even though the per-cascade call count grows, because merges no longer arrive in bursts.

---

## Node.js Concurrency: No Bottleneck

The app uses Node.js's non-blocking event loop to handle multiple cascades concurrently:

- **Concurrent cascades**: 2-3 typically running in parallel
- **Memory per cascade**: ~0.5MB
- **Max safe concurrent**: 100+ events
- **Limiting factor**: **API rate limit, not Node.js**

Node.js can easily handle 1,200+ cascades/hour—the GitHub API limit is what constrains throughput.

---

## When You Need Separate Instances

If your organization exceeds these thresholds, deploy **separate GitHub App instances**:

| Threshold | Action |
|-----------|--------|
| **< 500 cascades/day** (< 21/hr) | Single instance fine |
| **500-2,000 cascades/day** (21-83/hr) | Monitor at 65% utilization |
| **2,000-5,000 cascades/day** (83-208/hr) | Consider separate instance |
| **> 5,000 cascades/day** (> 208/hr) | **Split across 2+ instances** |

Each separate instance gets its own **15,000 req/hr budget**.

---

## Production Monitoring Checklist

1. **Track API utilization** — Alert when `X-RateLimit-Remaining` < 1,500
2. **Monitor cascade latency** — If > 60 seconds, you're near rate limit
3. **Check error rates** — Merge conflicts stop a cascade early and cost ~5 calls on the failing hop; a resume adds ~5 more. Frequent conflicts are a branching-strategy signal, not just a throughput one.
4. **Size your configuration** — Adjust `maxMergeDepth` to match your org's needs
5. **Plan for growth** — When approaching 65% utilization, prepare for a separate instance

---

## See Also

- [Configuration Guide](./QUICKSTART.md) — How to set `maxMergeDepth` and `ref_branch`
- [Architecture Overview](./architecture.md) — How cascading merges work
- [GitHub API Rate Limits](https://docs.github.com/en/rest/rate-limit?apiVersion=2022-11-28) — Official documentation
