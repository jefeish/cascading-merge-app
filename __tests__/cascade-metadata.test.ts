import {
  appendCascadeMetadata,
  buildCascadePrBody,
  buildRepairInstructions,
  buildRepairPrBody,
  CASCADE_METADATA_VERSION,
  parseCascadeMetadata,
  parseMatchingCascadeMetadata,
  parseMatchingRepairMetadata,
  parseRepairMetadata,
  type CascadeMetadata,
  type CascadeRepairMetadata
} from '../src/lib/cascade-metadata.js'

const metadata: CascadeMetadata = {
  version: CASCADE_METADATA_VERSION,
  kind: 'cascade',
  originatingPr: 478,
  originatingPrTitle: 'Fix login bug',
  originatingPrSource: 'octo/feature-login',
  sourceBranch: 'release/2.0.1-beta',
  targetBranch: 'release/2.0.2',
  remainingDepth: 4,
  maxMergeDepth: 10,
  maxMergeDepthSource: 'org',
  refBranch: 'development'
}

const repairMetadata: CascadeRepairMetadata = {
  version: CASCADE_METADATA_VERSION,
  kind: 'repair',
  originatingPr: 478,
  stalledPr: 479,
  repairBranch: 'cascade-fix/479-abc1234-def5678',
  protectedSourceBranch: 'release/2.0.1-beta',
  stalledTargetBranch: 'release/2.0.2'
}

describe('Cascade metadata', () => {
  it('META-01: round-trips metadata through a PR body', () => {
    expect(parseCascadeMetadata(buildCascadePrBody(metadata))).toEqual(metadata)
  })

  it('META-02: keeps the body human readable', () => {
    const body = buildCascadePrBody(metadata)

    expect(body).toContain(
      'This PR was created automatically by the Cascading Merge App.'
    )
    expect(body).toContain('Originating PR #478')
  })

  it('META-03: returns null for bodies without a marker', () => {
    expect(parseCascadeMetadata(null)).toBeNull()
    expect(parseCascadeMetadata(undefined)).toBeNull()
    expect(parseCascadeMetadata('')).toBeNull()
    expect(
      parseCascadeMetadata(
        'This PR was created automatically by the Cascading Merge App.'
      )
    ).toBeNull()
  })

  it('META-04: returns null for malformed or unsupported markers', () => {
    expect(
      parseCascadeMetadata('<!-- cascading-merge-app:{not json} -->')
    ).toBeNull()
    expect(
      parseCascadeMetadata(
        `<!-- cascading-merge-app:${JSON.stringify({ ...metadata, version: 99 })} -->`
      )
    ).toBeNull()
    expect(
      parseCascadeMetadata(
        `<!-- cascading-merge-app:${JSON.stringify({ version: CASCADE_METADATA_VERSION })} -->`
      )
    ).toBeNull()
  })

  it('META-05: normalizes unlimited depth to null', () => {
    const unlimited = {
      ...metadata,
      remainingDepth: null,
      maxMergeDepth: null,
      maxMergeDepthSource: undefined
    }

    expect(parseCascadeMetadata(buildCascadePrBody(unlimited))).toEqual(
      unlimited
    )
  })

  it('META-06: accepts metadata matching the merged PR branch pair', () => {
    expect(
      parseMatchingCascadeMetadata(
        buildCascadePrBody(metadata),
        metadata.sourceBranch,
        metadata.targetBranch
      )
    ).toEqual(metadata)
  })

  it('META-07: rejects metadata for a different merged PR branch pair', () => {
    const body = buildCascadePrBody(metadata)

    expect(
      parseMatchingCascadeMetadata(
        body,
        'release/2.0.1-alpha',
        metadata.targetBranch
      )
    ).toBeNull()
    expect(
      parseMatchingCascadeMetadata(body, metadata.sourceBranch, 'development')
    ).toBeNull()
  })

  it('META-08: returns null when a merged PR has no valid metadata', () => {
    expect(
      parseMatchingCascadeMetadata(
        'Human-authored pull request body',
        metadata.sourceBranch,
        metadata.targetBranch
      )
    ).toBeNull()
  })

  it('META-09: reads legacy version 1 continuation metadata', () => {
    const legacy = {
      version: 1,
      originatingPr: metadata.originatingPr,
      sourceBranch: metadata.sourceBranch,
      targetBranch: metadata.targetBranch,
      remainingDepth: metadata.remainingDepth,
      maxMergeDepth: metadata.maxMergeDepth
    }

    expect(
      parseCascadeMetadata(
        `<!-- cascading-merge-app:${JSON.stringify(legacy)} -->`
      )
    ).toMatchObject({
      ...legacy,
      version: CASCADE_METADATA_VERSION,
      kind: 'cascade'
    })
  })

  it('META-10: replaces an existing app marker', () => {
    const updatedMetadata = { ...metadata, remainingDepth: 3 }
    const body = appendCascadeMetadata(
      buildCascadePrBody(metadata),
      updatedMetadata
    )

    expect(body.match(/<!-- cascading-merge-app:/g)).toHaveLength(1)
    expect(parseCascadeMetadata(body)).toEqual(updatedMetadata)
  })

  it('META-11: round-trips repair metadata through a PR body', () => {
    expect(parseRepairMetadata(buildRepairPrBody(repairMetadata))).toEqual(
      repairMetadata
    )
  })

  it('META-12: builds complete repair instructions for PRs and comments', () => {
    expect(buildRepairInstructions(repairMetadata)).toBe(
      [
        'To resolve the conflict:',
        '',
        '1. Check out `cascade-fix/479-abc1234-def5678`.',
        '2. Merge `release/2.0.1-beta` into the repair branch.',
        '3. Resolve and commit all conflicts.',
        '4. Push the repair branch and mark this PR ready for review.',
        '5. Merge this PR through the normal protected-branch process.',
        '',
        'After this PR merges, the app will retry PR #479 and resume the original cascade.'
      ].join('\n')
    )
  })

  it('META-13: accepts repair metadata only for its expected branch pair', () => {
    const body = buildRepairPrBody(repairMetadata)

    expect(
      parseMatchingRepairMetadata(
        body,
        repairMetadata.repairBranch,
        repairMetadata.protectedSourceBranch
      )
    ).toEqual(repairMetadata)
    expect(
      parseMatchingRepairMetadata(
        body,
        'cascade-fix/different',
        repairMetadata.protectedSourceBranch
      )
    ).toBeNull()
  })

  it('META-14: rejects replacement metadata for a different operation', () => {
    expect(() =>
      appendCascadeMetadata(buildCascadePrBody(metadata), repairMetadata)
    ).toThrow('different cascade operation')
  })
})
