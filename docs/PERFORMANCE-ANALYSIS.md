# Cascading Merge App - Throughput Capacity by Organization Size

## Quick Answer: How Much Can This App Handle Per Org?

The Cascading Merge App is limited by **GitHub's API rate limit of 15,000 requests per hour** per GitHub App installation.

Each cascade merge operation costs approximately **20 API calls** (with typical configuration: `maxMergeDepth=5` + `ref_branch`).

---

## Throughput Capacity by Organization Size

| Organization Size | Typical Load | API Calls/Hour | ✅ Capacity |
|------------------|--------------|---------------|-----------|
| **Small** | 5 cascades/hr | 100 | **Safe** ✅ |
| **Medium** | 50 cascades/hr | 1,000 | **Safe** ✅ |
| **Large** | 200 cascades/hr | 4,600 | **Safe** ✅ |
| **Very Large** | 400 cascades/hr | 8,000 | **Safe** ✅ |
| **Enterprise** | 600 cascades/hr | 12,000 | **Approaching Limit** ⚠️ |
| **Extreme** | 750+ cascades/hr | 15,000+ | **At/Over Limit** 🔴 |

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
Average API calls per cascade = 20
Max cascades/hour = 15,000 / 20 = 750 cascades/hour
```

### Adjust Based on Your Configuration

| Config Setting | Impact on API Calls | Throughput Effect |
|---|---|---|
| `maxMergeDepth=3` (actual: 4 merges) | ~14 calls | **1,071 cascades/hr** |
| `maxMergeDepth=5` (actual: 6 merges) | ~20 calls | **750 cascades/hr** |
| `maxMergeDepth=10` (actual: 11 merges) | ~36 calls | **417 cascades/hr** |
| Without `ref_branch` | -2 calls | **+15% throughput** |
| With merge conflicts | +5 calls | **-25% throughput** |

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
3. **Check error rates** — Merge conflicts reduce throughput; investigate patterns
4. **Size your configuration** — Adjust `maxMergeDepth` to match your org's needs
5. **Plan for growth** — When approaching 65% utilization, prepare for a separate instance

---

## See Also

- [Configuration Guide](./QUICKSTART.md) — How to set `maxMergeDepth` and `ref_branch`
- [Architecture Overview](./architecture.md) — How cascading merges work
- [GitHub API Rate Limits](https://docs.github.com/en/rest/rate-limit?apiVersion=2022-11-28) — Official documentation
