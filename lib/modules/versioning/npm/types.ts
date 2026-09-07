export interface WrapNpmRangesConfig {
  /**
   * Id of the versioning module, used to identify it in debug logs.
   */
  id: string;

  /**
   * Converts a range from the module's own syntax into npm syntax.
   */
  toNpmRange: (range: string) => string;

  /**
   * Converts a version from the module's own syntax into npm syntax.
   * Defaults to passing the version through unchanged.
   */
  toNpmVersion?: (version: string) => string;

  /**
   * What `subset()` and `intersects()` do when npm throws on the converted ranges:
   * `'throw'` (the default) lets the error propagate, `'false'` logs it and returns `false`.
   */
  onRangeError?: 'throw' | 'false';
}

/**
 * The subset of `VersioningApi` that `wrapNpmRanges()` implements.
 *
 * Declared with property syntax so that the members can be destructured without
 * tripping the `unbound-method` lint rule.
 */
export interface NpmRangeApi {
  isValid: (input: string) => boolean;
  matches: (version: string, range: string) => boolean;
  getSatisfyingVersion: (versions: string[], range: string) => string | null;
  minSatisfyingVersion: (versions: string[], range: string) => string | null;
  isLessThanRange: (version: string, range: string) => boolean;
  subset: (subRange: string, superRange: string) => boolean | undefined;
  intersects: (subRange: string, superRange: string) => boolean;
}
