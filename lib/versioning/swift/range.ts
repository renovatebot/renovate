import semver from 'semver';
import type { NewValueConfig } from '../types';

const fromParam = /^\s*from\s*:\s*"([^"]+)"\s*$/;
const fromRange = /^\s*"([^"]+)"\s*\.\.\.\s*$/;
const binaryRange = /^\s*"([^"]+)"\s*(\.\.[.<])\s*"([^"]+)"\s*$/;
const toRange = /^\s*(\.\.[.<])\s*"([^"]+)"\s*$/;

function toSemverRange(range: string): string {
  if (fromParam.test(range)) {
    const [, version] = fromParam.exec(range);
    if (semver.valid(version)) {
      const nextMajor = `${semver.major(version) + 1}.0.0`;
      return `>=${version} <${nextMajor}`;
    }
  } else if (fromRange.test(range)) {
    const [, version] = fromRange.exec(range);
    if (semver.valid(version)) {
      return `>=${version}`;
    }
  } else if (binaryRange.test(range)) {
    const [, currentVersion, op, newVersion] = binaryRange.exec(range);
    if (semver.valid(currentVersion) && semver.valid(newVersion)) {
      return op === '..<'
        ? `>=${currentVersion} <${newVersion}`
        : `>=${currentVersion} <=${newVersion}`;
    }
  } else if (toRange.test(range)) {
    const [, op, newVersion] = toRange.exec(range);
    if (semver.valid(newVersion)) {
      return op === '..<' ? `<${newVersion}` : `<=${newVersion}`;
    }
  }
  return null;
}

function getNewValue({
  currentValue,
  currentVersion,
  newVersion,
}: NewValueConfig): string {
  if (fromParam.test(currentValue)) {
    return currentValue.replace(/".*?"/, `"${newVersion}"`);
  }
  if (fromRange.test(currentValue)) {
    const [, version] = fromRange.exec(currentValue);
    return currentValue.replace(version, newVersion);
  }
  if (binaryRange.test(currentValue)) {
    const [, , , version] = binaryRange.exec(currentValue);
    return currentValue.replace(version, newVersion);
  }
  if (toRange.test(currentValue)) {
    const [, , version] = toRange.exec(currentValue);
    return currentValue.replace(version, newVersion);
  }
  return currentValue;
}

export { toSemverRange, getNewValue };
