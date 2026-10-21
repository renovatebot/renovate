import { isNonEmptyString } from '@sindresorhus/is';
import { major as getMajor, minor as getMinor } from 'semver';
import semver from 'semver-stable';
import { logger } from '../../../logger/index.ts';
import type { RangeStrategy } from '../../../types/versioning.ts';
import { regEx } from '../../../util/regex.ts';
import { api as npm } from '../npm/index.ts';
import type { NewValueConfig, VersioningApi } from '../types.ts';

export const id = 'julia';
export const displayName = 'Julia';
export const urls = [
  '[Pkg.jl - Compatibility](https://pkgdocs.julialang.org/v1/compatibility/)',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'replace',
  'widen',
];

function convertToCaret(item: string): string {
  // In Julia, caret is the default specifier — `1.2.3` means `^1.2.3`.
  // See: https://pkgdocs.julialang.org/v1/compatibility/#Version-specifier-format
  const trimmed = item.trim();
  if (
    npm.isVersion(trimmed) ||
    npm.isVersion(`${trimmed}.0`) ||
    npm.isVersion(`${trimmed}.0.0`)
  ) {
    return `^${trimmed}`;
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
    .filter(isNonEmptyString)
    .join(' || ');
}

function npm2julia(input: string): string {
  /* v8 ignore if -- defensive */
  if (!input) {
    logger.warn(
      { input },
      'julia: npm2julia received an empty value, returning as-is',
    );
    return input;
  }
  // Convert npm union (`||`) back to Julia union (`,`).
  return input
    .split(regEx(/\s*\|\|\s*/))
    .map((part) => part.trim())
    .filter(isNonEmptyString)
    .join(', ');
}

function isLessThanRange(version: string, range: string): boolean {
  return !!npm.isLessThanRange?.(version, julia2npm(range));
}

function isValid(input: string): boolean {
  return npm.isValid(julia2npm(input));
}

function matches(version: string, range: string): boolean {
  return npm.matches(version, julia2npm(range));
}

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

function isSingleVersion(constraint: string): boolean {
  const trimmed = constraint.trim();
  return trimmed.startsWith('=') && npm.isVersion(trimmed.substring(1).trim());
}

function getPinnedValue(newVersion: string): string {
  return `=${newVersion}`;
}

// A union like `0.10, 0.11` is several specifiers; the last one carries the
// precision and the lower bound an upgrade moves.
function lastSpecifier(value: string): string {
  return value.split(',').at(-1)!.trim();
}

function componentCount(value: string): number {
  return lastSpecifier(value).split('.').length;
}

// dependabot's `simplified_version_spec`: `major.minor` above 1.0, `0.minor`
// for 0.x, `0.0.patch` for 0.0.x, always written plain.
function simplifiedSpec(version: string): string {
  /* v8 ignore next -- newVersion is always a full release */
  const major = npm.getMajor(version) ?? 0;
  /* v8 ignore next -- newVersion is always a full release */
  const minor = npm.getMinor(version) ?? 0;
  /* v8 ignore next -- newVersion is always a full release */
  const patch = npm.getPatch(version) ?? 0;
  if (major > 0) {
    return `${major}.${minor}`;
  }
  if (minor > 0) {
    return `0.${minor}`;
  }
  return `0.0.${patch}`;
}

// The lowest version a single specifier admits, for ordering; a bare upper
// bound such as `<0.0.1` starts at zero.
function specLowerBound(spec: string): number[] {
  if (spec.startsWith('<') || spec.startsWith('\u2264')) {
    return [0];
  }
  /* v8 ignore next -- a specifier without digits never reaches ordering */
  const digits = regEx(/\d+(?:\.\d+)*/).exec(spec)?.[0] ?? '0';
  return digits.split('.').map(Number);
}

function isAbove(a: number[], b: number[]): boolean {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left !== right) {
      return left > right;
    }
  }
  return false;
}

// Julia's convention is to append a new specifier rather than replace the
// entry, keeping it in ascending order.
function widen(currentValue: string, newVersion: string): string {
  if (matches(newVersion, currentValue)) {
    return currentValue;
  }
  // Next to a bare major such as `5`, write `6`, not `6.0`: the entry's own
  // style, and CompatHelper's.
  const major = npm.getMajor(newVersion)!;
  const newSpec =
    major > 0 && regEx(/^\d+$/).test(lastSpecifier(currentValue))
      ? `${major}`
      : simplifiedSpec(newVersion);
  const separator =
    currentValue.includes(',') && !currentValue.includes(', ') ? ',' : ', ';
  const specs = currentValue.split(',').map((spec) => spec.trim());
  const index = specs.findIndex((spec) =>
    isAbove(specLowerBound(spec), specLowerBound(newSpec)),
  );
  if (index === -1) {
    return `${currentValue}${separator}${newSpec}`;
  }
  specs.splice(index, 0, newSpec);
  return specs.join(separator);
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
  // A hyphen range is a deliberate manual constraint. Anchored: a hyphen
  // without surrounding whitespace is a prerelease tag, not a range.
  if (regEx(/^\d+(?:\.\d+)*\s+-\s+\d+(?:\.\d+)*$/).test(currentValue)) {
    return currentValue;
  }
  // A compat entry carries `major.minor.patch` and nothing else: the
  // specifier grammar in Pkg.jl `src/Versions.jl` (`ver_regs`, unchanged from
  // Julia 1.0 through 1.13) takes digits only, and its bounds compare the
  // three numbers, so `1.6.10` admits `1.6.10-rc1` and a JLL's `1.6.10+0`.
  const target = newVersion.replace(regEx(/[-+].*$/), '');
  // Bare version `1.2.3` (implicit caret) under bump → simply replace.
  if (rangeStrategy === 'bump' && regEx(/^\d+(?:\.\d+)*$/).test(currentValue)) {
    return target;
  }
  if (isSingleVersion(currentValue)) {
    let res = '=';
    if (currentValue.startsWith('= ')) {
      res += ' ';
    }
    res += target;
    return res;
  }
  // After the single-version branch: an exact pin is a hard constraint, and
  // appending to it would silently relax it.
  if (rangeStrategy === 'widen') {
    return widen(currentValue, target);
  }
  if (rangeStrategy === 'replace' && matches(target, currentValue)) {
    return currentValue;
  }
  // npm bumps every comparator of a union and joins them with a space, which
  // is not Julia syntax; bump the last specifier instead.
  const npmCurrentValue =
    rangeStrategy === 'bump' && currentValue.includes(',')
      ? lastSpecifier(currentValue)
      : currentValue;
  const newSemver = npm.getNewValue({
    currentValue: julia2npm(npmCurrentValue),
    rangeStrategy,
    currentVersion,
    newVersion: target,
  });
  /* v8 ignore if: defensive — npm should always return a value for inputs julia2npm produces */
  if (!newSemver) {
    logger.warn(
      { currentValue, rangeStrategy, newVersion },
      'Could not derive julia version range',
    );
    return currentValue;
  }
  let newJulia = npm2julia(newSemver);
  // Preserve precision (number of components) when current uses `^` or `~`.
  if (
    (currentValue.startsWith('~') || currentValue.startsWith('^')) &&
    rangeStrategy === 'replace' &&
    newJulia.split('.').length > componentCount(currentValue)
  ) {
    newJulia = newJulia
      .split('.')
      .slice(0, componentCount(currentValue))
      .join('.');
  }
  // Reverse any caret npm added that the original didn't have, restoring
  // Julia's bare-version-is-caret default.
  if (newJulia.startsWith('^') && !currentValue.startsWith('^')) {
    const withoutCaret = newJulia.substring(1);
    // Cutting to the current precision is a `replace` behaviour; under `bump`
    // it would throw the bump away.
    newJulia =
      rangeStrategy === 'replace'
        ? withoutCaret
            .split('.')
            .slice(0, componentCount(currentValue))
            .join('.')
        : withoutCaret;
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
