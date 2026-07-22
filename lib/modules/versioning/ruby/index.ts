import {
  eq,
  gt,
  maxSatisfying,
  minSatisfying,
  satisfies,
  valid,
} from '@renovatebot/ruby-semver';
import { logger } from '../../../logger/index.ts';
import type { RangeStrategy } from '../../../types/versioning.ts';
import { regEx } from '../../../util/regex.ts';
import type { NewValueConfig, VersioningApi } from '../types.ts';
import { isSingleOperator, isValidOperator } from './operator.ts';
import { ltr, parse as parseRange } from './range.ts';
import { bump, replace, widen } from './strategies/index.ts';
import { parse as parseVersion } from './version.ts';

export const id = 'ruby';
export const displayName = 'Ruby';
export const urls = [
  '[RubyGems patterns](https://guides.rubygems.org/patterns/)',
  '[Bundler Gemfile guide](https://bundler.io/guides/gemfile.html)',
  '[Understanding Gem versions](https://www.devalot.com/articles/2012/04/gem-versions.html)',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'replace',
];

function vtrim<T = unknown>(version: T): string | T {
  if (typeof version === 'string') {
    return version.replace(regEx(/^v/), '').replace(regEx(/('|")/g), '');
  }
  return version;
}

function equals(left: string, right: string): boolean {
  return eq(vtrim(left), vtrim(right));
}

function getMajor(version: string): number {
  return parseVersion(vtrim(version)).major;
}
function getMinor(version: string): number {
  return parseVersion(vtrim(version)).minor;
}
function getPatch(version: string): number {
  return parseVersion(vtrim(version)).patch;
}

export function isVersion(version: string): boolean {
  return !!valid(vtrim(version));
}
function isGreaterThan(left: string, right: string): boolean {
  return gt(vtrim(left), vtrim(right));
}
function isLessThanRange(version: string, range: string): boolean {
  return !!ltr(vtrim(version), vtrim(range));
}

function isSingleVersion(range: string): boolean {
  const { version, operator } = parseRange(vtrim(range));

  return operator
    ? isVersion(version) && isSingleOperator(operator)
    : isVersion(version);
}

function isStable(version: string): boolean {
  const v = vtrim(version);
  return parseVersion(v).prerelease ? false : isVersion(v);
}

export function isValid(input: string): boolean {
  return input
    .split(',')
    .map((piece) => vtrim(piece.trim()))
    .every((range) => {
      const { version, operator } = parseRange(range);

      return operator
        ? isVersion(version) && isValidOperator(operator)
        : isVersion(version);
    });
}

export function matches(version: string, range: string): boolean {
  return satisfies(vtrim(version), vtrim(range));
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return maxSatisfying(versions.map(vtrim), vtrim(range));
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return minSatisfying(versions.map(vtrim), vtrim(range));
}

function getPinnedValue(value: string): string {
  return vtrim(value);
}

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string | null {
  let newValue = null;
  if (isVersion(currentValue)) {
    newValue =
      currentValue.startsWith('v') && !newVersion.startsWith('v')
        ? `v${newVersion}`
        : newVersion;
  } else if (currentValue.replace(regEx(/^=\s*/), '') === currentVersion) {
    newValue = currentValue.replace(currentVersion, newVersion);
  } else {
    switch (rangeStrategy) {
      case 'update-lockfile':
        if (satisfies(newVersion, vtrim(currentValue))) {
          newValue = vtrim(currentValue);
        } else {
          return getNewValue({
            currentValue,
            rangeStrategy: 'replace',
            currentVersion,
            newVersion,
          });
        }
        break;
      case 'bump':
        newValue = bump({ range: vtrim(currentValue), to: vtrim(newVersion) });
        break;
      case 'auto':
      case 'replace':
        newValue = replace({
          range: vtrim(currentValue),
          to: vtrim(newVersion),
        });
        break;
      case 'widen':
        newValue = widen({
          range: vtrim(currentValue),
          to: vtrim(newVersion),
        });
        break;
      // istanbul ignore next
      default:
        logger.warn({ rangeStrategy }, 'Unsupported range strategy');
    }
  }
  if (newValue && regEx(/^('|")/).exec(currentValue)) {
    const delimiter = currentValue[0];
    return newValue
      .split(',')
      .map((element) =>
        element.replace(
          regEx(`^(?<whitespace>\\s*)`),
          `$<whitespace>${delimiter}`,
        ),
      )
      .map(
        (element) =>
          element.replace(/(?<whitespace>\s*)$/, `${delimiter}$<whitespace>`), // TODO #12875 adds ' at front when re2 is used
      )
      .join(',');
  }
  return newValue;
}

export function sortVersions(left: string, right: string): number {
  return gt(vtrim(left), vtrim(right)) ? 1 : -1;
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isCompatible: isVersion,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  getPinnedValue,
  getNewValue,
  sortVersions,
};
export default api;
