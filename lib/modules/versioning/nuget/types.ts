// <major>.<minor>.<patch>.<revision>-<prerelease>+<metadata>
export interface NugetVersion {
  type: 'nuget-version';
  major: number;
  minor?: number;
  patch?: number;
  revision?: number;
  prerelease?: string;
  metadata?: string;
}

/**
 * Floatings ranges could look like:
 * - `1.*`
 * - `1.2*`
 * - `1.*-*`
 * - `1-*`
 * - `1-alpha*`
 *
 * Invalid range: `1.2.*-foo`
 */
export interface NugetFloatingRange {
  type: 'nuget-floating-range';
  major: number;
  minor?: number;
  patch?: number;
  revision?: number;
  floating?: 'major' | 'minor' | 'patch' | 'revision';
  prerelease?: `${string}*`; // Prerelease of floating versions must end with an asterisk
}

export interface NugetExactRange {
  type: 'nuget-exact-range';
  version: NugetVersion;
}

export type NugetBracketRange =
  | {
      type: 'nuget-bracket-range';
      min: NugetVersion | NugetFloatingRange;
      max?: undefined;
      minInclusive: boolean;
      maxInclusive: boolean;
    }
  | {
      type: 'nuget-bracket-range';
      min?: undefined;
      max: NugetVersion;
      minInclusive: boolean;
      maxInclusive: boolean;
    }
  | {
      type: 'nuget-bracket-range';
      min: NugetVersion | NugetFloatingRange;
      max: NugetVersion;
      minInclusive: boolean;
      maxInclusive: boolean;
    };

export type NugetRange =
  | NugetExactRange
  | NugetFloatingRange
  | NugetBracketRange;
