import { NewValueConfig, VersioningApi } from '../common';
import { api as npm } from '../npm';

export const id = 'hex';
export const displayName = 'Hex';
export const urls = ['https://hexdocs.pm/elixir/Version.html'];
export const supportsRanges = true;
export const supportedRangeStrategies = ['bump', 'extend', 'pin', 'replace'];

function hex2npm(input: string): string {
  return input
    .replace(/~>\s*(\d+\.\d+)$/, '^$1')
    .replace(/~>\s*(\d+\.\d+\.\d+)/, '~$1')
    .replace(/==|and/, '')
    .replace('or', '||')
    .replace(/!=\s*(\d+\.\d+(\.\d+.*)?)/, '>$1 <$1')
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
    } else if (!operators.includes(res[i])) {
      output += res[i] + ' and ';
    } else {
      output += res[i] + ' ';
    }
  }
  return output;
}

const isLessThanRange = (version: string, range: string): boolean =>
  npm.isLessThanRange(hex2npm(version), hex2npm(range));

const isValid = (input: string): string | boolean =>
  npm.isValid(hex2npm(input));

const matches = (version: string, range: string): boolean =>
  npm.matches(hex2npm(version), hex2npm(range));

const maxSatisfyingVersion = (versions: string[], range: string): string =>
  npm.maxSatisfyingVersion(versions.map(hex2npm), hex2npm(range));

const minSatisfyingVersion = (versions: string[], range: string): string =>
  npm.minSatisfyingVersion(versions.map(hex2npm), hex2npm(range));

const getNewValue = ({
  currentValue,
  rangeStrategy,
  fromVersion,
  toVersion,
}: NewValueConfig): string => {
  let newSemver = npm.getNewValue({
    currentValue: hex2npm(currentValue),
    rangeStrategy,
    fromVersion,
    toVersion,
  });
  newSemver = npm2hex(newSemver);
  if (/~>\s*(\d+\.\d+)$/.test(currentValue)) {
    newSemver = newSemver.replace(
      /\^\s*(\d+\.\d+(\.\d)?)/,
      (_str, p1: string) => `~> ${p1.slice(0, -2)}`
    );
  } else {
    newSemver = newSemver.replace(/~\s*(\d+\.\d+\.\d)/, '~> $1');
  }
  if (npm.isVersion(newSemver)) {
    newSemver = `== ${newSemver}`;
  }
  return newSemver;
};

export { isValid };

export const api: VersioningApi = {
  ...npm,
  isLessThanRange,
  isValid,
  matches,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
};

export default api;
