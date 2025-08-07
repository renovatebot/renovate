import { regEx } from '../../../util/regex';
import type {
  DotnetSdkFloatingRange,
  DotnetSdkRange,
  DotnetSdkVersion,
} from './types';

const versionRegex = regEx(
  /^(?<major>\d+)(?:\s*\.\s*(?<minor>\d+)(?:\s*\.\s*(?<patch>\d+)(?:\s*\.\s*)?)?)?\s*(?:-(?<prerelease>[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*))?$/,
);

export function parseVersion(input: string): DotnetSdkVersion | null {
  const groups = versionRegex.exec(input?.trim())?.groups;
  if (!groups) {
    return null;
  }

  const { major, minor, patch, prerelease } = groups;

  // istanbul ignore if: never happens by design
  if (!major) {
    return null;
  }

  const res: DotnetSdkVersion = {
    type: 'dotnet-sdk-version',
    major: Number.parseInt(major, 10),
  };

  if (minor) {
    res.minor = Number.parseInt(minor, 10);
  }

  if (patch) {
    res.patch = Number.parseInt(patch, 10);
  }

  if (prerelease) {
    res.prerelease = prerelease;
  }

  return res;
}

const floatingRangeRegex = regEx(
  /^(?:(?<floating_major>\d+(?:\.x)?)|(?<major>\d+)\.(?:(?<floating_minor>0(?:\.x)?)|(?<minor>\d+)\.(?:(?<floating_patch>\d{1,3}xx)|(?<patch>\d+))))(-(?<prerelease>[a-zA-Z0-9.]+))?$/,
);

function parseFloatingComponent(input: string): [number, undefined | 'x'] {
  const parts = input.split('.');
  const first = Number.parseInt(parts[0], 10);
  let second: undefined | 'x' = undefined;
  if (parts.length > 1 && parts[1] === 'x') {
    second = 'x';
  }
  return [first, second];
}

export function parseFloatingRange(
  input: string,
): DotnetSdkFloatingRange | null {
  const groups = floatingRangeRegex.exec(input)?.groups;
  if (!groups) {
    return null;
  }

  if (
    !groups.floating_major &&
    !groups.floating_minor &&
    !groups.floating_patch
  ) {
    return null;
  }

  let res: DotnetSdkFloatingRange = {
    type: 'dotnet-sdk-floating-range',
    major: 0,
  };

  const {
    major,
    floating_major,
    minor,
    floating_minor,
    patch,
    floating_patch,
    prerelease,
  } = groups;

  if (prerelease) {
    res.prerelease = groups.prerelease as `${string}*`;
  }

  if (floating_major) {
    const [major, minor] = parseFloatingComponent(floating_major);
    return {
      ...res,
      major,
      minor,
      floating: 'major',
    };
  }

  const majorNum = Number.parseInt(major, 10);
  if (!Number.isNaN(majorNum)) {
    res = { ...res, major: majorNum };
  }

  if (floating_minor) {
    const [minor, patch] = parseFloatingComponent(floating_minor);
    return {
      ...res,
      minor,
      patch,
      floating: 'minor',
    };
  }

  const minorNum = Number.parseInt(minor, 10);
  if (!Number.isNaN(minorNum)) {
    res = { ...res, minor: minorNum };
  }

  if (floating_patch) {
    const [patch] = parseFloatingComponent(floating_patch);
    return {
      ...res,
      patch: patch * 100,
      floating: 'patch',
    };
  }

  const patchNum = Number.parseInt(patch, 10);
  if (!Number.isNaN(patchNum)) {
    res = { ...res, patch: Number.parseInt(patch, 10) };
  }

  if (res.prerelease) {
    return res;
  }

  return null;
}

export function parseRange(input: string): DotnetSdkRange | null {
  return parseFloatingRange(input);
}
