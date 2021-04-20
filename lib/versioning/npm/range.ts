import {
  inc as increment,
  valid as isVersion,
  major,
  minor,
  patch,
  prerelease,
  satisfies,
} from 'semver';
import { parseRange } from 'semver-utils';
import { logger } from '../../logger';
import type { NewValueConfig } from '../types';

function replaceCaretValue(oldValue: string, newValue: string): string {
  const toVersionMajor = major(newValue);
  const toVersionMinor = minor(newValue);
  const toVersionPatch = patch(newValue);

  const currentMajor = major(oldValue);
  const currentMinor = minor(oldValue);
  const currentPatch = patch(oldValue);

  const oldTuple = [currentMajor, currentMinor, currentPatch];
  const newTuple = [toVersionMajor, toVersionMinor, toVersionPatch];
  const resultTuple = [];

  let leadingZero = true;
  let needReplace = false;
  for (let idx = 0; idx < 3; idx += 1) {
    const oldVal = oldTuple[idx];
    const newVal = newTuple[idx];

    let leadingDigit = false;
    if (oldVal !== 0 || newVal !== 0) {
      if (leadingZero) {
        leadingZero = false;
        leadingDigit = true;
      }
    }

    if (leadingDigit && newVal > oldVal) {
      needReplace = true;
    }

    if (!needReplace && newVal < oldVal) {
      return newValue;
    }

    resultTuple.push(leadingDigit ? newVal : 0);
  }

  return needReplace ? resultTuple.join('.') : oldValue;
}

export function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string {
  if (rangeStrategy === 'pin' || isVersion(currentValue)) {
    return newVersion;
  }
  if (rangeStrategy === 'update-lockfile') {
    if (satisfies(newVersion, currentValue)) {
      return currentValue;
    }
    return getNewValue({
      currentValue,
      rangeStrategy: 'replace',
      currentVersion,
      newVersion,
    });
  }
  const parsedRange = parseRange(currentValue);
  const element = parsedRange[parsedRange.length - 1];
  if (rangeStrategy === 'widen') {
    if (satisfies(newVersion, currentValue)) {
      return currentValue;
    }
    const newValue = getNewValue({
      currentValue,
      rangeStrategy: 'replace',
      currentVersion,
      newVersion,
    });
    if (element.operator?.startsWith('<')) {
      // TODO fix this
      const splitCurrent = currentValue.split(element.operator);
      splitCurrent.pop();
      return splitCurrent.join(element.operator) + newValue;
    }
    if (parsedRange.length > 1) {
      const previousElement = parsedRange[parsedRange.length - 2];
      if (previousElement.operator === '-') {
        const splitCurrent = currentValue.split('-');
        splitCurrent.pop();
        return splitCurrent.join('-') + '- ' + newValue;
      }
      if (element.operator?.startsWith('>')) {
        logger.warn(`Complex ranges ending in greater than are not supported`);
        return null;
      }
    }
    return `${currentValue} || ${newValue}`;
  }
  const toVersionMajor = major(newVersion);
  const toVersionMinor = minor(newVersion);
  const toVersionPatch = patch(newVersion);
  const suffix = prerelease(newVersion) ? '-' + prerelease(newVersion)[0] : '';
  // Simple range
  if (rangeStrategy === 'bump') {
    if (parsedRange.length === 1) {
      if (!element.operator) {
        return getNewValue({
          currentValue,
          rangeStrategy: 'replace',
          currentVersion,
          newVersion,
        });
      }
      if (element.operator === '^') {
        const split = currentValue.split('.');
        if (suffix.length) {
          return `^${newVersion}`;
        }
        if (split.length === 1) {
          // ^4
          return `^${toVersionMajor}`;
        }
        if (split.length === 2) {
          // ^4.1
          return `^${toVersionMajor}.${toVersionMinor}`;
        }
        return `^${newVersion}`;
      }
      if (element.operator === '~') {
        const split = currentValue.split('.');
        if (suffix.length) {
          return `~${newVersion}`;
        }
        if (split.length === 1) {
          // ~4
          return `~${toVersionMajor}`;
        }
        if (split.length === 2) {
          // ~4.1
          return `~${toVersionMajor}.${toVersionMinor}`;
        }
        return `~${newVersion}`;
      }
      if (element.operator === '=') {
        return `=${newVersion}`;
      }
      if (element.operator === '>=') {
        return currentValue.includes('>= ')
          ? `>= ${newVersion}`
          : `>=${newVersion}`;
      }
      if (element.operator.startsWith('<')) {
        return currentValue;
      }
    } else {
      const newRange = parseRange(currentValue);
      const versions = newRange.map((x) => {
        const subRange = x.semver;
        const bumpedSubRange = getNewValue({
          currentValue: subRange,
          rangeStrategy: 'bump',
          currentVersion,
          newVersion,
        });
        if (satisfies(newVersion, bumpedSubRange)) {
          return bumpedSubRange;
        }
        return getNewValue({
          currentValue: subRange,
          rangeStrategy: 'replace',
          currentVersion,
          newVersion,
        });
      });
      return versions.filter((x) => x !== null && x !== '').join(' ');
    }
    logger.debug(
      'Unsupported range type for rangeStrategy=bump: ' + currentValue
    );
    return null;
  }
  if (element.operator === '~>') {
    return `~> ${toVersionMajor}.${toVersionMinor}.0`;
  }
  if (element.operator === '^') {
    if (suffix.length || !currentVersion) {
      return `^${toVersionMajor}.${toVersionMinor}.${toVersionPatch}${suffix}`;
    }
    return `^${replaceCaretValue(currentVersion, newVersion)}`;
  }
  if (element.operator === '=') {
    return `=${newVersion}`;
  }
  if (element.operator === '~') {
    if (suffix.length) {
      return `~${toVersionMajor}.${toVersionMinor}.${toVersionPatch}${suffix}`;
    }
    return `~${toVersionMajor}.${toVersionMinor}.0`;
  }
  if (element.operator === '<=') {
    let res;
    if (element.patch || suffix.length) {
      res = `<=${newVersion}`;
    } else if (element.minor) {
      res = `<=${toVersionMajor}.${toVersionMinor}`;
    } else {
      res = `<=${toVersionMajor}`;
    }
    if (currentValue.includes('<= ')) {
      res = res.replace('<=', '<= ');
    }
    return res;
  }
  if (element.operator === '<') {
    let res;
    if (currentValue.endsWith('.0.0')) {
      const newMajor = toVersionMajor + 1;
      res = `<${newMajor}.0.0`;
    } else if (element.patch) {
      res = `<${increment(newVersion, 'patch')}`;
    } else if (element.minor) {
      res = `<${toVersionMajor}.${toVersionMinor + 1}`;
    } else {
      res = `<${toVersionMajor + 1}`;
    }
    if (currentValue.includes('< ')) {
      res = res.replace(/</g, '< ');
    }
    return res;
  }
  if (!element.operator) {
    if (element.minor) {
      if (element.minor === 'x') {
        return `${toVersionMajor}.x`;
      }
      if (element.minor === '*') {
        return `${toVersionMajor}.*`;
      }
      if (element.patch === 'x') {
        return `${toVersionMajor}.${toVersionMinor}.x`;
      }
      if (element.patch === '*') {
        return `${toVersionMajor}.${toVersionMinor}.*`;
      }
      return `${toVersionMajor}.${toVersionMinor}`;
    }
    return `${toVersionMajor}`;
  }
  return newVersion;
}
