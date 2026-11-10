/**
 * Represents a parsed Rust toolchain identifier.
 * Follows the format: <channel>[-<date>][-<host>]
 *
 * Examples:
 * - "stable" → { channel: 'stable' }
 * - "1.82.0" → { channel: { major: 1, minor: 82, patch: 0 } }
 * - "nightly-2025-11-24" → { channel: 'nightly', date: { year: 2025, month: 11, day: 24 } }
 */
export interface ToolchainObject {
  /** The release channel or version */
  channel: 'stable' | 'beta' | 'nightly' | VersionObject;
  /** Optional date (primarily used with nightly channel) */
  date?: DateObject;
  /** Optional host triple (parsed but not used in version comparison) */
  host?: string;
}

/**
 * Represents a versioned Rust release (e.g., "1.82.0", "1.83.0-beta.5").
 * Follows semantic versioning with optional prerelease.
 */
export interface VersionObject {
  /** Major version number */
  major: number;
  /** Minor version number */
  minor: number;
  /** Patch version number. Omitted means it's a range (e.g., "1.82"). */
  patch?: number;
  /** Optional prerelease information */
  prerelease?: PrereleaseObject;
}

/**
 * Represents the prerelease part of a Rust version.
 * Currently only supports 'beta' prereleases.
 */
export interface PrereleaseObject {
  /** The prerelease name (currently only 'beta' is supported) */
  name: 'beta';
  /** The prerelease number (e.g., 5 in "1.83.0-beta.5"). Omitted means it's a range. */
  number?: number;
}

/**
 * Represents a date in YYYY-MM-DD format used in nightly releases.
 */
export interface DateObject {
  /** Full year (e.g., 2025) */
  year: number;
  /** Month (1-12) */
  month: number;
  /** Day of month (1-31) */
  day: number;
}
