import is from '@sindresorhus/is';
import semver from 'semver';
import semverUtils from 'semver-utils';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { isSemVerXRange } from '../semver/common';
import type { NewValueConfig } from '../types';

const {
  inc: increment,
  valid: isVersion,
  major,
  minor,
  patch,
  prerelease,
  satisfies,
} = semver;

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

function stripV(value: string): string {
  return value.replace(/^v/, '');
}

// TODO: #22198
export function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string | null {
  if (
    !['pin', 'update-lockfile'].includes(rangeStrategy) &&
    isSemVerXRange(currentValue)
  ) {
    return null;
  }
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
  const parsedRange = semverUtils.parseRange(currentValue);
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
      // TODO: types (#22198)
      return `${splitCurrent.join(element.operator)}${newValue!}`;
    }
    if (parsedRange.length > 1) {
      const previousElement = parsedRange[parsedRange.length - 2];
      if (previousElement.operator === '-') {
        const splitCurrent = currentValue.split('-');
        splitCurrent.pop();
        // TODO: types (#22198)
        return `${splitCurrent.join('-')}- ${newValue!}`;
      }
      if (element.operator?.startsWith('>')) {
        logger.warn(`Complex ranges ending in greater than are not supported`);
        return null;
      }
    }
    // TODO: types (#22198)
    return `${currentValue} || ${newValue!}`;
  }
  const toVersionMajor = major(newVersion);
  const toVersionMinor = minor(newVersion);
  const toVersionPatch = patch(newVersion);
  const toNewVersion = prerelease(newVersion);
  const suffix = toNewVersion ? `-${toNewVersion[0]}` : '';
  // Simple range
  if (rangeStrategy === 'bump') {
    if (parsedRange.length === 1) {
      if (!element.operator) {
        return stripV(newVersion);
      }
      if (element.operator === '^') {
        return `^${stripV(newVersion)}`;
      }
      if (element.operator === '~') {
        return `~${stripV(newVersion)}`;
      }
      if (element.operator === '=') {
        return `=${stripV(newVersion)}`;
      }
      if (element.operator === '>=') {
        return currentValue.includes('>= ')
          ? `>= ${stripV(newVersion)}`
          : `>=${stripV(newVersion)}`;
      }
      if (element.operator.startsWith('<')) {
        return currentValue;
      }
    } else {
      return semverUtils
        .parseRange(currentValue)
        .map((x) => x.semver)
        .filter(is.string)
        .map((subRange) => {
          const bumpedSubRange = getNewValue({
            currentValue: subRange,
            rangeStrategy: 'bump',
            currentVersion,
            newVersion,
          });
          if (bumpedSubRange && satisfies(newVersion, bumpedSubRange)) {
            return bumpedSubRange;
          }

          return getNewValue({
            currentValue: subRange,
            rangeStrategy: 'replace',
            currentVersion,
            newVersion,
          });
        })
        .filter((x) => x !== null && x !== '')
        .join(' ');
    }
    logger.debug(
      'Unsupported range type for rangeStrategy=bump: ' + currentValue,
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
    return `=${stripV(newVersion)}`;
  }
  if (element.operator === '~') {
    if (suffix.length) {
      return `~${toVersionMajor}.${toVersionMinor}.${toVersionPatch}${suffix}`;
    }
    return `~${toVersionMajor}.${toVersionMinor}.0`;
  }
  if (element.operator === '<=') {
    let res;
    if (!!element.patch || suffix.length) {
      res = `<=${stripV(newVersion)}`;
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
      // TODO: types (#22198)
      res = `<${increment(newVersion, 'patch')!}`;
    } else if (element.minor) {
      res = `<${toVersionMajor}.${toVersionMinor + 1}`;
    } else {
      res = `<${toVersionMajor + 1}`;
    }
    if (currentValue.includes('< ')) {
      res = res.replace(regEx(/</g), '< ');
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
