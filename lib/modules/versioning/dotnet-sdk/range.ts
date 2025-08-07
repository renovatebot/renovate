import type {
  DotnetSdkFloatingRange,
  DotnetSdkRange,
  DotnetSdkVersion,
} from './types';

export function getFloatingRangeLowerBound(
  range: DotnetSdkFloatingRange,
): DotnetSdkVersion {
  const { major, minor = 0, patch = 100, prerelease } = range;
  const res: DotnetSdkVersion = {
    type: 'dotnet-sdk-version',
    major,
    minor: minor === 'x' ? 0 : minor,
    patch: patch === 'x' ? 100 : patch,
  };

  if (prerelease) {
    res.prerelease = prerelease;
  }

  return res;
}

export function matches(v: DotnetSdkVersion, r: DotnetSdkRange): boolean {
  if (r.floating === 'major') {
    return v.major === r.major;
  } else if (r.floating === 'minor') {
    return v.major === r.major && (v.minor ?? 0) === (r.minor ?? 0);
  } else {
    const patch = r.patch === 'x' || !r.patch ? 100 : r.patch;
    return (
      v.major === r.major &&
      v.minor === r.minor &&
      Math.floor((v.patch ?? 100) / 100) === Math.floor(patch / 100)
    );
  }
}

export function rangeToString(range: DotnetSdkRange): string {
  const { major, minor, patch, floating } = range;

  if (floating === 'major') {
    if (minor === 'x') {
      return `${major}.x`;
    }
    return `${major}`;
  }

  if (floating === 'minor') {
    if (patch !== undefined) {
      return `${major}.0.x`;
    }
    return `${major}.${minor}`;
  }

  if (patch === undefined || patch === 'x') {
    return `${major}.${minor}.x`;
  }

  const featureBand = Math.floor((patch ?? 100) / 100);

  return `${major}.${minor}.${featureBand}xx`;
}

export function tryBump(
  r: DotnetSdkRange,
  v: DotnetSdkVersion,
  x: string,
): string {
  return matches(v, r) ? rangeToString(r) : x;
}
