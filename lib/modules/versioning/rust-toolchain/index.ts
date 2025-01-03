import { logger } from '../../../logger';
import type { RangeStrategy } from '../../../types/versioning';
import { regEx } from '../../../util/regex';
import { api as npm } from '../npm';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'rust-toolchain';
export const displayName = 'Rust Toolchain';
export const urls = [
  'https://rust-lang.github.io/rustup/overrides.html#the-toolchain-file',
];

export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'pin',
  'replace',
];

// Format described in https://rust-lang.github.io/rustup/overrides.html#the-toolchain-file
// Versions may be fully qualified: <major>.<minor>.<patch> (e.g. 1.82.1), indicating an exact version.
// Or version may be inexact: <major>.<minor> (e.g. 1.82), allowing patch level changes.
const versionRegex = regEx(/^(?<major>\d+)\.(?<minor>\d+)(\.(?<patch>\d+))?$/);

function _parse(version: string): number[] | null {
  const groups = versionRegex.exec(version)?.groups;
  if (!groups) {
    return null;
  }

  const release = [];
  const { major, minor, patch } = groups;
  release.push(Number.parseInt(major, 10));
  release.push(Number.parseInt(minor, 10));
  // patch versions are optional.
  if (typeof patch !== 'undefined') {
    release.push(Number.parseInt(patch, 10));
  }

  return release;
}

const isVersion = (input: string): boolean =>
  !!_parse(input) && npm.isVersion(input);

function isStable(version: string): boolean {
  return !!_parse(version);
}

function isCompatible(version: string, current?: string): boolean {
  return isValid(version);
}

export function isValid(input: string): boolean {
  const npmRange = rust2npm(input);
  return !!npmRange && npm.isValid(npmRange);
}

function getMajor(version: string): null | number {
  const parsed = _parse(version);
  return parsed ? parsed[0] : null;
}

function getMinor(version: string): null | number {
  const parsed = _parse(version);
  return parsed ? parsed[1] : null;
}

function getPatch(version: string): null | number {
  const parsed = _parse(version);
  return parsed && parsed.length > 2 ? parsed[2] : null;
}

function rust2npm(input: string): string | null {
  const parsed = _parse(input);
  if (!parsed) {
    return null;
  }
  // The Rust toolchain may be specified as a fully qualified version. e.g. 1.82.2
  if (parsed.length === 3) {
    return '=' + parsed.join('.');
  }
  // Or a major.minor version which has the same meaning as '~' in semver.
  if (parsed.length === 2) {
    return '~' + parsed.join('.');
  }
  // istanbul ignore next: unreachable, _parse returns length 2 or 3 only.
  throw new Error(`Unexpected releases length: ${parsed.join('.')}`);
}

function isLessThanRange(version: string, range: string): boolean {
  const npmRange = rust2npm(range);
  return !!npmRange && !!npm.isLessThanRange?.(version, npmRange);
}

function matches(version: string, range: string): boolean {
  const npmRange = rust2npm(range);
  return !!npmRange && npm.matches(version, npmRange);
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const npmRange = rust2npm(range);
  return npmRange ? npm.getSatisfyingVersion(versions, npmRange) : null;
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const npmRange = rust2npm(range);
  return npmRange ? npm.minSatisfyingVersion(versions, npmRange) : null;
}

const isSingleVersion = (constraint: string): boolean =>
  isVersion(constraint.trim());

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string {
  const npmRange = rust2npm(currentValue);
  if (!npmRange) {
    return currentValue;
  }

  const newSemver = npm.getNewValue({
    currentValue: npmRange,
    rangeStrategy,
    currentVersion,
    newVersion,
  });
  // istanbul ignore if: unreachable, input validated by rust2npm
  if (!newSemver) {
    logger.info(
      { currentValue, newSemver },
      'Could not get rust version from semver',
    );
    return currentValue;
  }
  // Transform a tilde range back into a major.minor version.
  if (newSemver.startsWith('~')) {
    const parsed = _parse(newSemver.substring(1));
    // istanbul ignore if: unreachable sanity check
    if (!parsed || parsed.length !== 3) {
      logger.info(
        { currentValue, newSemver },
        'Could not parse new semver value',
      );
      return currentValue;
    }
    return parsed[0] + '.' + parsed[1];
  }
  // Transform an exact version back into a major.minor.patch version
  if (newSemver.startsWith('=')) {
    const newValue = newSemver.substring(1);
    // istanbul ignore if: unreachable sanity check
    if (!_parse(newValue)) {
      logger.info(
        { currentValue, newSemver },
        'Could not parse new semver value',
      );
      return currentValue;
    }
    return newValue;
  }
  // istanbul ignore if: unreachable sanity check
  if (!isVersion(newSemver)) {
    logger.info(
      { currentValue, newSemver },
      'Unexpectedly got non-version as newSemver',
    );
    return currentValue;
  }
  return newSemver;
}

export const api: VersioningApi = {
  ...npm,
  getNewValue,
  isLessThanRange,
  isSingleVersion,
  isValid,
  isStable,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  isVersion,
  isCompatible,
  getMajor,
  getMinor,
  getPatch,
};
export default api;
