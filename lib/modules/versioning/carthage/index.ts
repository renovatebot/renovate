import type { RangeStrategy } from '../../../types/versioning';
import { regEx } from '../../../util/regex';
import { api as npm } from '../npm';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'carthage';
export const displayName = 'Carthage';
export const urls = [
  'https://github.com/Carthage/Carthage/blob/master/Documentation/Artifacts.md#cartfile',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'pin',
  'replace',
];

function carthage2npm(input: string): string {
  return input
    .replace(regEx(/~>\s*(\d+\.\d+)$/), '^$1')
    .replace(regEx(/~>\s*(\d+\.\d+\.\d+)/), '^$1')
    .replace(regEx(/==/), '')
    .trim();
}

function isLessThanRange(version: string, range: string): boolean {
  return !!npm.isLessThanRange?.(carthage2npm(version), carthage2npm(range));
}

const isValidOperator = (operator: string): boolean =>
  ['==', '>=', '~>'].includes(operator);

export const isValid = (input: string): boolean => {
  const splitInput = input.split(regEx(/\s+/));

  return (
    splitInput.length === 2 &&
    npm.isVersion(splitInput[1].trim()) &&
    isValidOperator(splitInput[0].trim())
  );
};

const matches = (version: string, range: string): boolean =>
  npm.matches(carthage2npm(version), carthage2npm(range));

function getSatisfyingVersion(
  versions: string[],
  range: string
): string | null {
  return npm.getSatisfyingVersion(
    versions.map(carthage2npm),
    carthage2npm(range)
  );
}

function minSatisfyingVersion(
  versions: string[],
  range: string
): string | null {
  return npm.minSatisfyingVersion(
    versions.map(carthage2npm),
    carthage2npm(range)
  );
}

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string | null {
  let newSemver = npm.getNewValue({
    currentValue: carthage2npm(currentValue),
    rangeStrategy,
    currentVersion,
    newVersion,
  });
  if (newSemver) {
    if (regEx(/~>\s*(\d+\.\d+\.\d+)$/).test(currentValue)) {
      newSemver = newSemver.replace(
        regEx(/[\^~]\s*(\d+\.\d+\.\d+)/),
        (_str, p1: string) => `~> ${p1}`
      );
    } else if (regEx(/~>\s*(\d+\.\d+)$/).test(currentValue)) {
      newSemver = newSemver.replace(
        regEx(/\^\s*(\d+\.\d+)(\.\d+)?/),
        (_str, p1: string) => `~> ${p1}`
      );
    } else {
      newSemver = newSemver.replace(regEx(/~\s*(\d+\.\d+\.\d)/), '~> $1');
    }
    if (npm.isVersion(newSemver)) {
      newSemver = `== ${newSemver}`;
    }
  }
  return newSemver;
}

export const api: VersioningApi = {
  ...npm,
  isLessThanRange,
  isValid,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
};

export default api;
