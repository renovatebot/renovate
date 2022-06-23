import semver from 'semver';
import { regEx } from '../../../util/regex';
import type { NewValueConfig } from '../types';

const fromParam = regEx(/^\s*from\s*:\s*"([^"]+)"\s*$/);
const fromRange = regEx(/^\s*"([^"]+)"\s*\.\.\.\s*$/);
const binaryRange = regEx(/^\s*"([^"]+)"\s*(\.\.[.<])\s*"([^"]+)"\s*$/);
const toRange = regEx(/^\s*(\.\.[.<])\s*"([^"]+)"\s*$/);

function toSemverRange(range: string): string | null {
  const fromParamMatch = fromParam.exec(range);
  if (fromParamMatch) {
    const [, version] = fromParamMatch;
    if (semver.valid(version)) {
      const nextMajor = `${semver.major(version) + 1}.0.0`;
      return `>=${version} <${nextMajor}`;
    }
    return null;
  }

  const fromRangeMatch = fromRange.exec(range);
  if (fromRangeMatch) {
    const [, version] = fromRangeMatch;
    if (semver.valid(version)) {
      return `>=${version}`;
    }
    return null;
  }

  const binaryRangeMatch = binaryRange.exec(range);
  if (binaryRangeMatch) {
    const [, currentVersion, op, newVersion] = binaryRangeMatch;
    if (semver.valid(currentVersion) && semver.valid(newVersion)) {
      return op === '..<'
        ? `>=${currentVersion} <${newVersion}`
        : `>=${currentVersion} <=${newVersion}`;
    }
    return null;
  }

  const toRangeMatch = toRange.exec(range);
  if (toRangeMatch) {
    const [, op, newVersion] = toRangeMatch;
    if (semver.valid(newVersion)) {
      return op === '..<' ? `<${newVersion}` : `<=${newVersion}`;
    }
  }
  return null;
}

function getNewValue({ currentValue, newVersion }: NewValueConfig): string {
  if (fromParam.test(currentValue)) {
    return currentValue.replace(regEx(/".*?"/), `"${newVersion}"`);
  }

  const fromRangeMatch = fromRange.exec(currentValue);
  if (fromRangeMatch) {
    const [, version] = fromRangeMatch;
    return currentValue.replace(version, newVersion);
  }

  const binaryRangeMatch = binaryRange.exec(currentValue);
  if (binaryRangeMatch) {
    const [, , , version] = binaryRangeMatch;
    return currentValue.replace(version, newVersion);
  }

  const toRangeMatch = toRange.exec(currentValue);
  if (toRangeMatch) {
    const [, , version] = toRangeMatch;
    return currentValue.replace(version, newVersion);
  }

  return currentValue;
}

export { toSemverRange, getNewValue };
