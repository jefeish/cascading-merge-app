import {
    parseGlobalMaxMergeDepth,
    resolveEffectiveMaxMergeDepth,
    resolveMaxMergeDepthSource
} from '../src/lib/depth-control.js'

describe('Depth control', () => {
  it('DEP-01: returns undefined when global env var (MAX_MERGE_DEPTH) is not set', () => {
    expect(parseGlobalMaxMergeDepth({})).toBeUndefined()
  })

  it('DEP-02: parses MAX_MERGE_DEPTH when provided', () => {
    expect(parseGlobalMaxMergeDepth({ MAX_MERGE_DEPTH: '5' })).toBe(5)
  })

  it('DEP-03: parses maxMergeDepth when provided', () => {
    expect(parseGlobalMaxMergeDepth({ maxMergeDepth: '4' })).toBe(4)
  })

  it('DEP-04: rejects invalid global depth values', () => {
    expect(() => parseGlobalMaxMergeDepth({ MAX_MERGE_DEPTH: '0' })).toThrow(
      'Configuration error: global MAX_MERGE_DEPTH must be an integer greater than or equal to 1 when provided'
    )
    expect(() => parseGlobalMaxMergeDepth({ MAX_MERGE_DEPTH: '2.5' })).toThrow()
    expect(() => parseGlobalMaxMergeDepth({ MAX_MERGE_DEPTH: 'abc' })).toThrow()
  })

  it('DEP-05: uses repo-level depth when global cap is not set', () => {
    expect(resolveEffectiveMaxMergeDepth(3, undefined, undefined)).toBe(3)
  })

  it('DEP-06: uses global cap when repo-level depth is not set', () => {
    expect(resolveEffectiveMaxMergeDepth(undefined, undefined, 5)).toBe(5)
  })

  it('DEP-07: applies global cap as hard upper bound', () => {
    expect(resolveEffectiveMaxMergeDepth(10, undefined, 5)).toBe(5)
    expect(resolveEffectiveMaxMergeDepth(2, undefined, 5)).toBe(2)
  })

  it('DEP-08: uses org-level depth when repo-level depth is not set', () => {
    expect(resolveEffectiveMaxMergeDepth(undefined, 4, undefined)).toBe(4)
  })

  it('DEP-09: applies the strictest configured repo, org, or global depth', () => {
    expect(resolveEffectiveMaxMergeDepth(2, 5, 10)).toBe(2)
    expect(resolveEffectiveMaxMergeDepth(8, 5, 10)).toBe(5)
    expect(resolveEffectiveMaxMergeDepth(8, 7, 3)).toBe(3)
  })

  it('DEP-10: returns undefined when all scopes are unlimited', () => {
    expect(
      resolveEffectiveMaxMergeDepth(undefined, undefined, undefined)
    ).toBeUndefined()
  })

  it('DEP-11: identifies the source of the effective max merge depth', () => {
    expect(resolveMaxMergeDepthSource(2, 2, 5, 10)).toBe('repo')
    expect(resolveMaxMergeDepthSource(5, 8, 5, 10)).toBe('org')
    expect(resolveMaxMergeDepthSource(3, 8, 7, 3)).toBe('global')
    expect(
      resolveMaxMergeDepthSource(undefined, undefined, undefined, undefined)
    ).toBeUndefined()
  })
})
