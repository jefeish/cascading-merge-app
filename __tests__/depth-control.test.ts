import {
  parseGlobalMaxMergeDepth,
  resolveEffectiveMaxMergeDepth
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
    expect(resolveEffectiveMaxMergeDepth(3, undefined)).toBe(3)
  })

  it('DEP-06: uses global cap when repo-level depth is not set', () => {
    expect(resolveEffectiveMaxMergeDepth(undefined, 5)).toBe(5)
  })

  it('DEP-07: applies global cap as hard upper bound', () => {
    expect(resolveEffectiveMaxMergeDepth(10, 5)).toBe(5)
    expect(resolveEffectiveMaxMergeDepth(2, 5)).toBe(2)
  })
})
