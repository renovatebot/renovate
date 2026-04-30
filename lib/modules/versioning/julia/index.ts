import { major as getMajor, minor as getMinor } from 'semver';
import semver from 'semver-stable';
import { logger } from '../../../logger/index.ts';
import type { RangeStrategy } from '../../../types/versioning.ts';
import { regEx } from '../../../util/regex.ts';
import { api as npm } from '../npm/index.ts';
import type { NewValueConfig, VersioningApi } from '../types.ts';

export const id = 'julia';
export const displayName = 'Julia';
export const urls = ['https://pkgdocs.julialang.org/v1/compatibility/'];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = ['bump', 'replace'];

const isVersion = (input: string): boolean => npm.isVersion(input);

function convertToCaret(item: string): string {
  // In Julia, caret is the default specifier — `1.2.3` means `^1.2.3`.
  // See: https://pkgdocs.julialang.org/v1/compatibility/#Version-specifier-format
  const trimmed = item.trim();
  if (
    isVersion(trimmed) ||
    isVersion(trimmed + '.0') ||
    isVersion(trimmed + '.0.0')
  ) {
    return '^' + trimmed;
  }
  return trimmed;
}

function julia2npm(input: string): string {
  // Julia uses `,` for *union* (npm: `||`), `≥` as a synonym for `>=`,
  // and treats bare versions as carets.
  return input
    .replaceAll('≥', '>=')
    .split(',')
    .map(convertToCaret)
    .filter((s) => s !== '')
    .join(' || ');
}

function npm2julia(input: string): string {
  /* v8 ignore if -- defensive */
  if (!input) {
    return input;
  }
  // Convert npm union (`||`) back to Julia union (`,`).
  return input
    .split(regEx(/\s*\|\|\s*/))
    .map((part) => part.trim())
    .filter((s) => s !== '')
    .join(', ');
}

const isLessThanRange = (version: string, range: string): boolean =>
  !!npm.isLessThanRange?.(version, julia2npm(range));

export const isValid = (input: string): boolean =>
  npm.isValid(julia2npm(input));

const matches = (version: string, range: string): boolean =>
  npm.matches(version, julia2npm(range));

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return npm.getSatisfyingVersion(versions, julia2npm(range));
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return npm.minSatisfyingVersion(versions, julia2npm(range));
}

const isSingleVersion = (constraint: string): boolean =>
  constraint.trim().startsWith('=') &&
  isVersion(constraint.trim().substring(1).trim());

function getPinnedValue(newVersion: string): string {
  return `=${newVersion}`;
}

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string {
  if (!currentValue || currentValue === '*') {
    return currentValue;
  }
  // Bare version `1.2.3` (implicit caret) under bump → simply replace.
  if (rangeStrategy === 'bump' && regEx(/^\d+(?:\.\d+)*$/).test(currentValue)) {
    return newVersion;
  }
  if (isSingleVersion(currentValue)) {
    let res = '=';
    if (currentValue.startsWith('= ')) {
      res += ' ';
    }
    res += newVersion;
    return res;
  }
  if (rangeStrategy === 'replace' && matches(newVersion, currentValue)) {
    return currentValue;
  }
  const newSemver = npm.getNewValue({
    currentValue: julia2npm(currentValue),
    rangeStrategy,
    currentVersion,
    newVersion,
  });
  let newJulia = newSemver
    ? npm2julia(newSemver)
    : /* v8 ignore next: should never happen */ null;
  /* v8 ignore if */
  if (!newJulia) {
    logger.info(
      { currentValue, newSemver },
      'Could not get julia version from semver',
    );
    return currentValue;
  }
  // Preserve precision (number of components) when current uses `^` or `~`.
  if (
    (currentValue.startsWith('~') || currentValue.startsWith('^')) &&
    rangeStrategy === 'replace' &&
    newJulia.split('.').length > currentValue.split('.').length
  ) {
    newJulia = newJulia
      .split('.')
      .slice(0, currentValue.split('.').length)
      .join('.');
  }
  // Reverse any caret npm added that the original didn't have, restoring
  // Julia's bare-version-is-caret default.
  if (newJulia.startsWith('^') && !currentValue.startsWith('^')) {
    const withoutCaret = newJulia.substring(1);
    const components = currentValue.split('.').length;
    newJulia = withoutCaret.split('.').slice(0, components).join('.');
  }

  return newJulia;
}

function isBreaking(current: string, version: string): boolean {
  // Treat any unstable version as potentially breaking.
  if (!semver.is(version) || !semver.is(current)) {
    return true;
  }
  const currentMajor = getMajor(current);
  // Julia treats the leftmost non-zero digit as the breaking-change axis
  // (same as Cargo / npm caret semantics).
  if (currentMajor === 0) {
    if (getMinor(current) === 0) {
      return current !== version;
    }
    return getMinor(current) !== getMinor(version);
  }
  return currentMajor !== getMajor(version);
}

export const api: VersioningApi = {
  ...npm,
  getNewValue,
  getPinnedValue,
  isBreaking,
  isLessThanRange,
  isSingleVersion,
  isValid,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
};
export default api;
