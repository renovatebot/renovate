import type { RangeStrategy } from '../../../types/versioning';
import { regEx } from '../../../util/regex';
import { api as npm } from '../npm';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'hex';
export const displayName = 'Hex';
export const urls = ['https://hexdocs.pm/elixir/Version.html'];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'pin',
  'replace',
];

function hex2npm(input: string): string {
  return input
    .replace(regEx(/~>\s*(\d+\.\d+)$/), '^$1')
    .replace(regEx(/~>\s*(\d+\.\d+\.\d+)/), '~$1')
    .replace(regEx(/==|and/), '')
    .replace('or', '||')
    .replace(regEx(/!=\s*(\d+\.\d+(\.\d+.*)?)/), '>$1 <$1')
    .trim();
}

function npm2hex(input: string): string {
  const res = input
    .split(' ')
    .map((str) => str.trim())
    .filter((str) => str !== '');
  let output = '';
  const operators = ['^', '=', '>', '<', '<=', '>=', '~'];
  for (let i = 0; i < res.length; i += 1) {
    if (i === res.length - 1) {
      output += res[i];
      break;
    }
    if (i < res.length - 1 && res[i + 1].includes('||')) {
      output += res[i] + ' or ';
      i += 1;
    } else if (operators.includes(res[i])) {
      output += res[i] + ' ';
    } else {
      output += res[i] + ' and ';
    }
  }
  return output;
}

function isLessThanRange(version: string, range: string): boolean {
  return !!npm.isLessThanRange?.(hex2npm(version), hex2npm(range));
}

const isValid = (input: string): boolean => !!npm.isValid(hex2npm(input));

const matches = (version: string, range: string): boolean =>
  npm.matches(hex2npm(version), hex2npm(range));

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return npm.getSatisfyingVersion(versions.map(hex2npm), hex2npm(range));
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return npm.minSatisfyingVersion(versions.map(hex2npm), hex2npm(range));
}

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string | null {
  let newSemver = npm.getNewValue({
    currentValue: hex2npm(currentValue),
    rangeStrategy,
    currentVersion,
    newVersion,
  });
  if (newSemver) {
    newSemver = npm2hex(newSemver);

    if (regEx(/~>\s*(\d+\.\d+\.\d+)$/).test(currentValue)) {
      newSemver = newSemver.replace(
        regEx(/[\^~]\s*(\d+\.\d+\.\d+)/),
        (_str, p1: string) => `~> ${p1}`,
      );
    } else if (regEx(/~>\s*(\d+\.\d+)$/).test(currentValue)) {
      newSemver = newSemver.replace(
        regEx(/\^\s*(\d+\.\d+)(\.\d+)?/),
        (_str, p1: string) => `~> ${p1}`,
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

export { isValid };

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
