import is from '@sindresorhus/is';
import { regEx } from '../../../util/regex';
import type { NugetRange, NugetVersion } from './types';

const version =
  /(\d+)(?:\s*\.\s*(\d+))?(?:\s*\.\s*(\d+))?(?:\s*\.\s*(\d+))?(?:-([^+*^]+))?(?:\+([^+*^]+))?/
    .source;

const [
  versionPattern,
  exactPattern,
  minPattern,
  maxPattern,
  mixedPattern,
  floatingMajorPattern,
  floatingMinorPattern,
  floatingPatchPattern,
  floatingRevisionPattern,
] =
  /* prettier-ignore */ [
  regEx(`^${version}$`),                                              // 1.0         x ≥ 1.0         Minimum version, inclusive

  regEx(`^\\[\\s*${version}\\s*\\]$`),                                // [1.0]       x == 1.0        Exact version match

  regEx(`^(\\[|\\()\\s*${version}\\s*,\\s*\\)$`),                     // [1.0,)      x ≥ 1.0         Minimum version, inclusive
                                                                      // (1.0,)      x > 1.0         Minimum version, exclusive

  regEx(`^\\(\\s*,\\s*${version}\\s*(\\]|\\))$`),                     // (,1.0]      x ≤ 1.0         Maximum version, inclusive
                                                                      // (,1.0)      x < 1.0         Maximum version, exclusive

  regEx(`^(\\[|\\()\\s*${version}\\s*,\\s*${version}\\s*(\\]|\\))$`), // [1.0,2.0]   1.0 ≤ x ≤ 2.0   Exact range, inclusive
                                                                      // (1.0,2.0)   1.0 < x < 2.0   Exact range, exclusive
                                                                      // [1.0,2.0)   1.0 ≤ x < 2.0   Mixed inclusive minimum and exclusive maximum version
                                                                      // (1.0,2.0]   1.0 < x ≤ 2.0   Mixed exclusive minimum and inclusive maximum version

  regEx(/^\*(-\*)?$/),                                                // *                           The highest stable version
                                                                      // *-*                         The highest version including the not stable versions

  regEx(/^(\d+)\.\*(-\*)?$/),                                         // 1.*                         The highest stable version with the major version 1
                                                                      // 1.*-*                       The highest version including the not stable versions with the major version 1

  regEx(/^(\d+)\.(\d+)\.\*(-\*)?$/),                                  // 1.2.*                       The highest stable version with the major version 1 and the minor version 2
                                                                      // 1.2.*-*                     The highest version including the not stable versions with the major version 1 and the minor version 2

  regEx(/^(\d+)\.(\d+)\.(\d+)\.\*(-\*)?$/),                           // 1.2.3.*                     The highest stable version with the major version 1, the minor version 2 and the patch version 3
                                                                      // 1.2.3.*-*                   The highest version including the not stable versions with the major version 1, the minor version 2 and the patch version 3
];

function num(s: string | undefined): number | undefined {
  return s ? Number(s) : undefined;
}

export function parseVersion(input: string): NugetVersion | null {
  if (!input) {
    return null;
  }

  const versionMatch = versionPattern.exec(input.trim());
  if (!versionMatch) {
    return null;
  }

  const [, majorStr, minorStr, patchStr, revisionStr, prerelease, metadata] =
    versionMatch;
  const major = num(majorStr)!;
  const minor = num(minorStr);
  const patch = num(patchStr);
  const revision = num(revisionStr);

  if (
    [major, minor, patch, revision].some((n) =>
      is.number(n) ? n >= 0x80000000 : false,
    )
  ) {
    return null;
  }

  return {
    type: 'version',
    major,
    minor,
    patch,
    revision,
    prerelease,
    metadata,
  };
}

export function parseRange(input: string): NugetRange | null {
  if (!input) {
    return null;
  }

  const exactMatch = exactPattern.exec(input.trim());
  if (exactMatch) {
    const [, major, minor, patch, revision, prerelease, metadata] = exactMatch;
    return {
      type: 'range-exact',
      version: {
        type: 'version',
        major: num(major)!,
        minor: num(minor),
        patch: num(patch),
        revision: num(revision),
        prerelease,
        metadata,
      },
    };
  }

  const minMatch = minPattern.exec(input);
  if (minMatch) {
    const [, bracket, major, minor, patch, revision, prerelease, metadata] =
      minMatch;
    return {
      type: 'range-min',
      min: {
        type: 'version',
        major: num(major)!,
        minor: num(minor),
        patch: num(patch),
        revision: num(revision),
        prerelease,
        metadata,
      },
      minInclusive: bracket === '[',
    };
  }

  const maxMatch = maxPattern.exec(input);
  if (maxMatch) {
    const [, major, minor, patch, revision, prerelease, metadata, bracket] =
      maxMatch;
    return {
      type: 'range-max',
      max: {
        type: 'version',
        major: num(major)!,
        minor: num(minor),
        patch: num(patch),
        revision: num(revision),
        prerelease,
        metadata,
      },
      maxInclusive: bracket === ']',
    };
  }

  const mixedMatch = mixedPattern.exec(input);
  if (mixedMatch) {
    const [
      ,
      minBracket,
      minMajor,
      minMinor,
      minPatch,
      minRevision,
      minPrerelease,
      minMetadata,
      maxMajor,
      maxMinor,
      maxPatch,
      maxRevision,
      maxPrerelease,
      maxMetadata,
      maxBracket,
    ] = mixedMatch;
    return {
      type: 'range-mixed',
      min: {
        type: 'version',
        major: num(minMajor)!,
        minor: num(minMinor),
        patch: num(minPatch),
        revision: num(minRevision),
        prerelease: minPrerelease,
        metadata: minMetadata,
      },
      minInclusive: minBracket === '[',
      max: {
        type: 'version',
        major: num(maxMajor)!,
        minor: num(maxMinor),
        patch: num(maxPatch),
        revision: num(maxRevision),
        prerelease: maxPrerelease,
        metadata: maxMetadata,
      },
      maxInclusive: maxBracket === ']',
    };
  }

  const floatingMajorMatch = floatingMajorPattern.exec(input);
  if (floatingMajorMatch) {
    const [, prerelease] = floatingMajorMatch;
    return {
      type: 'floating-major',
      unstable: prerelease === '-*',
    };
  }

  const floatingMinorMatch = floatingMinorPattern.exec(input);
  if (floatingMinorMatch) {
    const [, major, prerelease] = floatingMinorMatch;
    return {
      type: 'floating-minor',
      major: num(major)!,
      unstable: prerelease === '-*',
    };
  }

  const floatingPatchMatch = floatingPatchPattern.exec(input);
  if (floatingPatchMatch) {
    const [, major, minor, prerelease] = floatingPatchMatch;
    return {
      type: 'floating-patch',
      major: num(major)!,
      minor: num(minor)!,
      unstable: prerelease === '-*',
    };
  }

  const floatingRevisionMatch = floatingRevisionPattern.exec(input);
  if (floatingRevisionMatch) {
    const [, major, minor, patch, prerelease] = floatingRevisionMatch;
    return {
      type: 'floating-revision',
      major: num(major)!,
      minor: num(minor)!,
      patch: num(patch)!,
      unstable: prerelease === '-*',
    };
  }

  return null;
}

export function versionToString(version: NugetVersion): string {
  let res = `${version.major}`;

  if (version.minor !== undefined) {
    res += `.${version.minor}`;
  }

  if (version.patch !== undefined) {
    res += `.${version.patch}`;
  }

  if (version.revision !== undefined) {
    res += `.${version.revision}`;
  }

  if (version.prerelease) {
    res += `-${version.prerelease}`;
  }

  if (version.metadata) {
    res += `+${version.metadata}`;
  }

  return res;
}

function openBracket(inclusive: boolean): '[' | '(' {
  return inclusive ? '[' : '(';
}

function closeBracket(inclusive: boolean): ']' | ')' {
  return inclusive ? ']' : ')';
}

export function rangeToString(range: NugetRange): string {
  if (range.type === 'range-exact') {
    const version = versionToString(range.version);
    return `[${version}]`;
  }

  if (range.type === 'range-min') {
    const version = versionToString(range.min);
    const bracket = openBracket(range.minInclusive);
    return `${bracket}${version},)`;
  }

  if (range.type === 'range-max') {
    const version = versionToString(range.max);
    const bracket = closeBracket(range.maxInclusive);
    return `(,${version}${bracket}`;
  }

  if (range.type === 'range-mixed') {
    const minVersion = versionToString(range.min);
    const minBracket = openBracket(range.minInclusive);
    const maxVersion = versionToString(range.max);
    const maxBracket = closeBracket(range.maxInclusive);
    return `${minBracket}${minVersion},${maxVersion}${maxBracket}`;
  }

  const suffix = range.unstable ? '-*' : '';

  if (range.type === 'floating-revision') {
    const { major, minor, patch } = range;
    return `${major}.${minor}.${patch}.*${suffix}`;
  }

  if (range.type === 'floating-patch') {
    const { major, minor } = range;
    return `${major}.${minor}.*${suffix}`;
  }

  if (range.type === 'floating-minor') {
    const { major } = range;
    return `${major}.*${suffix}`;
  }

  return `*${suffix}`;
}
