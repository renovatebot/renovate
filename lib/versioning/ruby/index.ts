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

const equals = (left: string, right: string) => eq(left, right);

const getMajor = (version: string) => parseVersion(version).major;
const getMinor = (version: string) => parseVersion(version).minor;
const getPatch = (version: string) => parseVersion(version).patch;

export const isVersion = (version: string) => !!valid(version);
const isGreaterThan = (left: string, right: string) => gt(left, right);
const isLessThanRange = (version: string, range: string) => ltr(version, range);

const isSingleVersion = (range: string) => {
  const { version, operator } = parseRange(range);

  return operator
    ? isVersion(version) && isSingleOperator(operator)
    : isVersion(version);
};

const isStable = (version: string) =>
  parseVersion(version).prerelease ? false : isVersion(version);

export const isValid = (input: string) =>
  input
    .split(',')
    .map(piece => piece.trim())
    .every(range => {
      const { version, operator } = parseRange(range);

      return operator
        ? isVersion(version) && isValidOperator(operator)
        : isVersion(version);
    });

export const matches = (version: string, range: string) =>
  satisfies(version, range);
const maxSatisfyingVersion = (versions: string[], range: string) =>
  maxSatisfying(versions, range);
const minSatisfyingVersion = (versions: string[], range: string) =>
  minSatisfying(versions, range);

const getNewValue = (
  currentValue: string,
  rangeStrategy: RangeStrategy,
  _fromVersion: string,
  toVersion: string
) => {
  switch (rangeStrategy) {
    case 'pin':
      return pin({ to: toVersion });
    case 'bump':
      return bump({ range: currentValue, to: toVersion });
    case 'replace':
      return replace({ range: currentValue, to: toVersion });
    // istanbul ignore next
    default:
      logger.warn(`Unsupported strategy ${rangeStrategy}`);
      return null;
  }
};

export const sortVersions = (left: string, right: string) =>
  gt(left, right) ? 1 : -1;

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
