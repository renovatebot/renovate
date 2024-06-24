import { regEx } from '../../../util/regex';
import type {
  NugetBracketRange,
  NugetExactRange,
  NugetFloatingRange,
  NugetRange,
  NugetVersion,
} from './types';

const versionRegex = regEx(
  /^(?<major>\d+)(?:\.(?<minor>\d+)(?:\.(?<patch>\d+)(?:\.(?<revision>\d+))?)?)?\s*(?:-(?<prerelease>[-a-zA-Z0-9]+(?:\.[-a-zA-Z0-9]+)*))?(?:\+(?<metadata>[-a-zA-Z0-9]+(?:\.[-a-zA-Z0-9]+)*))?$/,
);

export function parseVersion(input: string): NugetVersion | null {
  const groups = versionRegex.exec(input)?.groups;
  if (!groups) {
    return null;
  }

  const { major, minor, patch, revision, prerelease, metadata } = groups;

  // istanbul ignore next: never happens by design
  if (!major) {
    return null;
  }

  const res: NugetVersion = {
    type: 'nuget-version',
    major: Number.parseInt(major, 10),
  };

  if (minor) {
    res.minor = Number.parseInt(minor, 10);
  }

  if (patch) {
    res.patch = Number.parseInt(patch, 10);
  }

  if (revision) {
    res.revision = Number.parseInt(revision, 10);
  }

  if (prerelease) {
    res.prerelease = prerelease;
  }

  if (metadata) {
    res.metadata = metadata;
  }

  return res;
}

const floatingRangeRegex = regEx(
  /^(?:(?:(?<floating_major>\d*\*)|(?<major>\d+)(?:\.(?:(?<floating_minor>\d*\*)|(?<minor>\d+)(?:\.(?:(?<floating_patch>\d*\*)|(?<patch>\d+)(?:\.(?:(?<floating_revision>\d*\*)|(?<revision>\d+)))?))?))?)(?:-(?<floating_prerelease>\*|[-a-zA-Z0-9]+(?:\.[-a-zA-Z0-9]+)*\.?\*))?)$/,
);

function parseFloatingComponent(input: string): number {
  const [int] = input.split('*');
  return int ? 10 * Number.parseInt(int, 10) : 0;
}

export function parseFloatingRange(input: string): NugetFloatingRange | null {
  const groups = floatingRangeRegex.exec(input)?.groups;
  if (!groups) {
    return null;
  }

  let res: NugetFloatingRange = {
    type: 'nuget-floating-range',
    major: 0,
  };

  const {
    major,
    floating_major,
    minor,
    floating_minor,
    patch,
    floating_patch,
    revision,
    floating_revision,
    floating_prerelease,
  } = groups;

  if (floating_prerelease) {
    res.prerelease = groups.floating_prerelease as `${string}*`;
  }

  if (floating_major) {
    return { ...res, major: parseFloatingComponent(floating_major) };
  }

  const majorNum = Number.parseInt(major, 10);
  if (!Number.isNaN(majorNum)) {
    res = { ...res, major: majorNum };
  }

  if (floating_minor) {
    return { ...res, minor: parseFloatingComponent(floating_minor) };
  }

  const minorNum = Number.parseInt(minor, 10);
  if (!Number.isNaN(minorNum)) {
    res = { ...res, minor: minorNum };
  }

  if (floating_patch) {
    return { ...res, patch: parseFloatingComponent(floating_patch) };
  }

  const patchNum = Number.parseInt(patch, 10);
  if (!Number.isNaN(patchNum)) {
    res = { ...res, patch: Number.parseInt(patch, 10) };
  }

  if (floating_revision) {
    return { ...res, revision: parseFloatingComponent(floating_revision) };
  }

  const revisionNum = Number.parseInt(revision, 10);
  if (!Number.isNaN(revisionNum)) {
    res = { ...res, revision: Number.parseInt(revision, 10) };
  }

  return res;
}

export function getFloatingRangeLowerBound(
  range: NugetFloatingRange,
): NugetVersion {
  const { major, minor = 0, patch = 0, revision = 0, prerelease } = range;
  const res: NugetVersion = {
    type: 'nuget-version',
    major,
    minor,
    patch,
    revision,
  };

  if (prerelease) {
    const parts = prerelease.split('.');
    const lastIdx = parts.length - 1;
    const last = parts[lastIdx];
    if (last === '*') {
      parts[lastIdx] = '0';
    } else {
      parts[lastIdx] = last.replace(/\*$/, '');
    }
    res.prerelease = parts.join('.');
  }

  return res;
}

const exactRangeRegex = regEx(/^\s*\[\s*(?<version>[^,]+)\s*\]\s*$/);

export function parseExactRange(input: string): NugetExactRange | null {
  const versionStr = exactRangeRegex.exec(input)?.groups?.version;
  if (!versionStr) {
    return null;
  }

  const version = parseVersion(versionStr);
  if (!version) {
    return null;
  }

  return {
    type: 'nuget-exact-range',
    version,
  };
}

const maxBracketRangeRegex = regEx(
  /^\s*(?<left_bracket>\(|\[)\s*,\s*(?<max_version>[^\s\])]+)\s*(?<right_bracket>\)|\])\s*$/,
);

const minBracketRangeRegex = regEx(
  /^\s*(?<left_bracket>\(|\[)\s*(?<min_version>[^\s,]+)\s*,\s*(?<right_bracket>\)|\])\s*$/,
);

const bracketRangeRegex = regEx(
  /^\s*(?<left_bracket>\(|\[)\s*(?<min_version>[^\s,]+)\s*,\s*(?<max_version>[^\s\])]+)\s*(?<right_bracket>\)|\])\s*$/,
);

export function parseBracketRange(input: string): NugetBracketRange | null {
  const maxGroups = maxBracketRangeRegex.exec(input)?.groups;
  if (maxGroups) {
    const { max_version, left_bracket, right_bracket } = maxGroups;

    const max = parseVersion(max_version);
    if (!max) {
      return null;
    }

    return {
      type: 'nuget-bracket-range',
      max,
      minInclusive: left_bracket === '[',
      maxInclusive: right_bracket === ']',
    };
  }

  const minGroups = minBracketRangeRegex.exec(input)?.groups;
  if (minGroups) {
    const { min_version, left_bracket, right_bracket } = minGroups;

    const min = parseVersion(min_version) ?? parseFloatingRange(min_version);
    if (!min) {
      return null;
    }

    return {
      type: 'nuget-bracket-range',
      min,
      minInclusive: left_bracket === '[',
      maxInclusive: right_bracket === ']',
    };
  }

  const groups = bracketRangeRegex.exec(input)?.groups;
  if (groups) {
    const { min_version, max_version, left_bracket, right_bracket } = groups;

    const min = parseVersion(min_version) ?? parseFloatingRange(min_version);
    if (!min) {
      return null;
    }

    const max = parseVersion(max_version);
    if (!max) {
      return null;
    }

    return {
      type: 'nuget-bracket-range',
      min,
      max,
      minInclusive: left_bracket === '[',
      maxInclusive: right_bracket === ']',
    };
  }

  return null;
}

export function parseRange(input: string): NugetRange | null {
  return (
    parseExactRange(input) ??
    parseBracketRange(input) ??
    parseFloatingRange(input)
  );
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

export function rangeToString(range: NugetRange): string {
  if (range.type === 'nuget-exact-range') {
    return `[${versionToString(range.version)}]`;
  }

  if (range.type === 'nuget-floating-range') {
    const { major, minor, patch, revision, prerelease } = range;
    let res = '';

    if (prerelease) {
      res = `-${prerelease}`;
    }

    let;

    return res;
  }
}
