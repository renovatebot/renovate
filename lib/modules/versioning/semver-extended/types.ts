export interface ParsedVersion {
  /** Release parts as bigints */
  releaseBig: bigint[];
  prerelease?: string;
}

export interface NewVersion {
  parsed: ParsedVersion;
  /** The new version without a `v` prefix */
  text: string;
}

/**
 * One comparator of a range, such as the `>=` and the `1.2.3.4` of `>=1.2.3.4`.
 * The operator is one of `<`, `<=`, `>`, `>=` and `=`.
 */
export interface Comparator {
  operator: string;
  version: ParsedVersion;
}

/**
 * Comparator sets of a range: the comparators of a set are ANDed, the sets are ORed.
 */
export type ComparatorSets = Comparator[][];

/**
 * A full, partial or wildcard version of a range, like `v1.2.x`.
 */
export interface PartialVersion {
  /** The `v` or `V` prefix, or an empty string */
  prefix: string;
  /** Release identifiers as written, including wildcards */
  identifiers: string[];
  /** Numeric parts before the first wildcard */
  parts: bigint[];
  prerelease?: string;
  /** Whether the value has at least three numeric parts and no wildcard */
  exact: boolean;
}

/**
 * One term of a range, like `>= 1.2.3.4`, with the comparators it expands to.
 */
export interface RangeToken {
  /** The operator, or an empty string for a bare version */
  operator: string;
  /** Whitespace between the operator and the version */
  space: string;
  version: string;
  partial: PartialVersion;
  comparators: Comparator[];
}

/**
 * One `||` alternative of a range.
 */
export interface RangeAlternative {
  /** The alternative as written, including surrounding whitespace */
  text: string;
  /** Whether the alternative is a hyphen range, whose two tokens act as `>=` and `<=` */
  hyphen: boolean;
  tokens: RangeToken[];
}
