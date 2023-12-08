import { cmp } from './compare';
import { rangeToString } from './parse';
import type { NugetRange, NugetVersion } from './types';

export function matches(version: NugetVersion, range: NugetRange): boolean {
  if (range.type === 'range-exact') {
    return cmp(version, range.version) === 0;
  }

  if (range.type === 'range-min') {
    if (range.minInclusive) {
      return cmp(version, range.min) >= 0;
    }

    return cmp(version, range.min) > 0;
  }

  if (range.type === 'range-max') {
    if (range.maxInclusive) {
      return cmp(version, range.max) <= 0;
    }

    return cmp(version, range.max) < 0;
  }

  if (range.type === 'range-mixed') {
    if (range.minInclusive && range.maxInclusive) {
      return cmp(version, range.min) >= 0 && cmp(version, range.max) <= 0;
    }

    if (range.minInclusive) {
      return cmp(version, range.min) >= 0 && cmp(version, range.max) < 0;
    }

    if (range.maxInclusive) {
      return cmp(version, range.min) > 0 && cmp(version, range.max) <= 0;
    }

    return cmp(version, range.min) > 0 && cmp(version, range.max) < 0;
  }

  if (range.type === 'floating-major') {
    return range.unstable || !version.prerelease;
  }

  if (range.type === 'floating-minor') {
    return (
      range.major === version.major && (range.unstable || !version.prerelease)
    );
  }

  if (range.type === 'floating-patch') {
    return (
      range.major === version.major &&
      range.minor === version.minor &&
      (range.unstable || !version.prerelease)
    );
  }

  return (
    range.major === version.major &&
    range.minor === version.minor &&
    range.patch === version.patch &&
    (range.unstable || !version.prerelease)
  );
}

export function bump(range: NugetRange, newVersion: NugetVersion): string {
  if (range.type === 'range-exact') {
    return rangeToString({
      ...range,
      version: newVersion,
    });
  } else if (range.type === 'range-min') {
    if (cmp(newVersion, range.min) > 0) {
      return rangeToString({ ...range, min: newVersion });
    }
  } else if (range.type === 'range-max' || range.type === 'range-mixed') {
    if (cmp(newVersion, range.max) > 0) {
      return rangeToString({ ...range, max: newVersion });
    }
  } else if (range.unstable || !newVersion.prerelease) {
    if (range.type === 'floating-minor') {
      const v: NugetVersion = {
        major: range.major,
        minor: undefined,
        patch: undefined,
        revision: undefined,
        prerelease: undefined,
        metadata: undefined,
      };
      if (cmp(newVersion, v) > 0 && !matches(newVersion, range)) {
        return rangeToString({
          ...range,
          major: newVersion.major,
        });
      }
    } else if (range.type === 'floating-patch') {
      const v: NugetVersion = {
        major: range.major,
        minor: range.minor,
        patch: undefined,
        revision: undefined,
        prerelease: undefined,
        metadata: undefined,
      };
      if (cmp(newVersion, v) > 0 && !matches(newVersion, range)) {
        return rangeToString({
          ...range,
          major: newVersion.major,
          minor: newVersion.minor ?? 0,
        });
      }
    } else if (range.type === 'floating-revision') {
      const v: NugetVersion = {
        major: range.major,
        minor: range.minor,
        patch: range.patch,
        revision: undefined,
        prerelease: undefined,
        metadata: undefined,
      };
      if (cmp(newVersion, v) > 0 && !matches(newVersion, range)) {
        return rangeToString({
          ...range,
          major: newVersion.major,
          minor: newVersion.minor ?? 0,
          patch: newVersion.patch ?? 0,
        });
      }
    }
  }

  return rangeToString(range);
}
