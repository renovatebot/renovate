// <major>.<minor>.<patch>-<prerelease>
export interface DotnetSdkVersion {
  type: 'dotnet-sdk-version';
  major: number;
  minor?: number;
  patch?: number;
  prerelease?: string;
}

/**
 * Floatings ranges could look like:
 * - `8`
 * - `8.x`
 * - `8.0`
 * - `8.0.x`
 * - `8.0.4xx`
 *
 * Invalid range: `8.0.*-foo`
 */
export interface DotnetSdkFloatingRange {
  type: 'dotnet-sdk-floating-range';
  major: number;
  minor?: number | 'x';
  patch?: number | 'x';
  floating?: 'major' | 'minor' | 'patch';
  prerelease?: string;
}

export type DotnetSdkRange = DotnetSdkFloatingRange;
