export interface NugetVersion {
  major: number;
  minor: number | undefined;
  patch: number | undefined;
  revision: number | undefined; // Fourth version component
  prerelease: string | undefined;
  metadata: string | undefined;
}

interface NugetExactVersionRange {
  type: 'range-exact';
  version: NugetVersion;
}

interface NugetMinVersionRange {
  type: 'range-min';
  min: NugetVersion;
  minInclusive: boolean;
}

interface NugetMaxVersionRange {
  type: 'range-max';
  max: NugetVersion;
  maxInclusive: boolean;
}

interface NugetMixedRange {
  type: 'range-mixed';
  min: NugetVersion;
  minInclusive: boolean;
  max: NugetVersion;
  maxInclusive: boolean;
}

interface NugetFloatingMajor {
  type: 'floating-major';
  unstable: boolean;
}

interface NugetFloatingMinor {
  type: 'floating-minor';
  major: number;
  unstable: boolean;
}

interface NugetFloatingPatch {
  type: 'floating-patch';
  major: number;
  minor: number;
  unstable: boolean;
}

interface NugetFloatingRevision {
  type: 'floating-revision';
  major: number;
  minor: number;
  patch: number;
  unstable: boolean;
}

export type NugetRange =
  | NugetExactVersionRange
  | NugetMinVersionRange
  | NugetMaxVersionRange
  | NugetMixedRange
  | NugetFloatingMajor
  | NugetFloatingMinor
  | NugetFloatingPatch
  | NugetFloatingRevision;
