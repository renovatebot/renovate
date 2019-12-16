import {
  eq,
  valid,
  gt,
  satisfies,
  maxSatisfying,
  minSatisfying,
} from '@snyk/ruby-semver';
import { VersioningApi, RangeStrategy } from '../common';
import { logger } from '../../logger';
import { parse as parseVersion } from './version';
import { parse as parseRange, ltr } from './range';
import { isSingleOperator, isValidOperator } from './operator';
import { pin, bump, replace } from './strategies';

function vtrim<T = unknown>(version: T): string | T {
  if (typeof version === 'string') return version.replace(/^v/, '');
  return version;
}

const equals = (left: string, right: string): boolean =>
  eq(vtrim(left), vtrim(right));

const getMajor = (version: string): number =>
  parseVersion(vtrim(version)).major;
const getMinor = (version: string): number =>
  parseVersion(vtrim(version)).minor;
const getPatch = (version: string): number =>
  parseVersion(vtrim(version)).patch;

export const isVersion = (version: string): boolean => !!valid(vtrim(version));
const isGreaterThan = (left: string, right: string): boolean =>
  gt(vtrim(left), vtrim(right));
const isLessThanRange = (version: string, range: string): boolean =>
  ltr(vtrim(version), vtrim(range));

const isSingleVersion = (range: string): boolean => {
  const { version, operator } = parseRange(vtrim(range));

  return operator
    ? isVersion(version) && isSingleOperator(operator)
    : isVersion(version);
};

function isStable(version: string): boolean {
  const v = vtrim(version);
  return parseVersion(v).prerelease ? false : isVersion(v);
}

export const isValid = (input: string): boolean =>
  input
    .split(',')
    .map(piece => vtrim(piece.trim()))
    .every(range => {
      const { version, operator } = parseRange(range);

      return operator
        ? isVersion(version) && isValidOperator(operator)
        : isVersion(version);
    });

export const matches = (version: string, range: string): boolean =>
  satisfies(vtrim(version), vtrim(range));
const maxSatisfyingVersion = (versions: string[], range: string): string =>
  maxSatisfying(versions.map(vtrim), vtrim(range));
const minSatisfyingVersion = (versions: string[], range: string): string =>
  minSatisfying(versions.map(vtrim), vtrim(range));

const getNewValue = (
  currentValue: string,
  rangeStrategy: RangeStrategy,
  _fromVersion: string,
  toVersion: string
): string => {
  let result = null;
  switch (rangeStrategy) {
    case 'pin':
      result = pin({ to: vtrim(toVersion) });
      break;
    case 'bump':
      result = bump({ range: vtrim(currentValue), to: vtrim(toVersion) });
      break;
    case 'replace':
      result = replace({ range: vtrim(currentValue), to: vtrim(toVersion) });
      break;
    // istanbul ignore next
    default:
      logger.warn(`Unsupported strategy ${rangeStrategy}`);
  }

  if (currentValue !== vtrim(currentValue) && isSingleVersion(result)) {
    result = `v${result}`;
  }

  return result;
};

export const sortVersions = (left: string, right: string): number =>
  gt(vtrim(left), vtrim(right)) ? 1 : -1;

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
  maxSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,
};
export default api;
