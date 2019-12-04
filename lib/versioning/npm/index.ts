import * as semver from 'semver';
import { is as isStable } from 'semver-stable';
import { getNewValue } from './range';
import { VersioningApi } from '../common';

const {
  compare: sortVersions,
  maxSatisfying: maxSatisfyingVersion,
  minSatisfying: minSatisfyingVersion,
  major: getMajor,
  minor: getMinor,
  patch: getPatch,
  satisfies: matches,
  valid,
  validRange,
  ltr: isLessThanRange,
  gt: isGreaterThan,
  eq: equals,
} = semver;

// If this is left as an alias, inputs like "17.04.0" throw errors
export const isValid = (input: string): string => validRange(input);
export const isVersion = (input: string): string => valid(input);

const isSingleVersion = (constraint: string): string =>
  isVersion(constraint) ||
  (constraint.startsWith('=') && isVersion(constraint.substring(1).trim()));

function increment(version: string): string | null {
  const match = version.match(
    /^(?<prefix>.*[^\d])(?<lowest>\d+)(?<suffix>[^\d]*)$/
  );
  if (!match) return null;
  const { prefix, lowest, suffix } = match.groups;
  const incLowest = parseInt(lowest, 10) + 1;
  return `${prefix}${incLowest}${suffix}`;
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getNewValue,
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
  sortVersions,
  increment,
};

export default api;
