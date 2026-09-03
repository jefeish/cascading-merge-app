import {
    buildCascadePrBody,
    CASCADE_METADATA_VERSION,
    parseCascadeMetadata,
    type CascadeMetadata
} from '../src/lib/cascade-metadata.js'

const metadata: CascadeMetadata = {
  version: CASCADE_METADATA_VERSION,
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
    expect(parseCascadeMetadata('<!-- cascading-merge-app:{not json} -->')).toBeNull()
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
})
