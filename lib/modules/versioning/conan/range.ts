import * as semver from 'semver';
import { SemVer, parseRange } from 'semver-utils';
import { logger } from '../../../logger';
import { coerceString } from '../../../util/string';
import type { NewValueConfig } from '../types';
import {
  cleanVersion,
  containsOperators,
  getOptions,
  makeVersion,
  matchesWithOptions,
} from './common';

// always include prereleases
export function getMajor(version: string): null | number {
  const cleanedVersion = cleanVersion(version);
  const options = getOptions(version);
  options.includePrerelease = true;
  const cleanerVersion = makeVersion(cleanedVersion, options);
  if (typeof cleanerVersion === 'string') {
    return Number(cleanerVersion.split('.')[0]);
  }
  return null;
}

// always include prereleases
export function getMinor(version: string): null | number {
  const cleanedVersion = cleanVersion(version);
  const options = getOptions(version);
  options.includePrerelease = true;
  const cleanerVersion = makeVersion(cleanedVersion, options);
  if (typeof cleanerVersion === 'string') {
    return Number(cleanerVersion.split('.')[1]);
  }
  return null;
}

// always include prereleases
export function getPatch(version: string): null | number {
  const cleanedVersion = cleanVersion(version);
  const options = getOptions(version);
  options.includePrerelease = true;
  const cleanerVersion = makeVersion(cleanedVersion, options);

  if (typeof cleanerVersion === 'string') {
    const newVersion = semver.valid(
      semver.coerce(cleanedVersion, {
        loose: false,
      }),
      options,
    );
    return Number(newVersion?.split('.')[2]);
  }
  return null;
}

export function fixParsedRange(range: string): any {
  const ordValues = [];

  // don't bump or'd single version values
  const originalSplit = range.split(' ');
  for (let i = 0; i < originalSplit.length; i += 1) {
    if (
      !containsOperators(originalSplit[i]) &&
      !originalSplit[i].includes('||')
    ) {
      if (i !== 0 && originalSplit[i - 1].includes('||')) {
        ordValues.push(`|| ${originalSplit[i]}`);
      } else if (i !== originalSplit.length && originalSplit[i + 1] === '||') {
        ordValues.push(`${originalSplit[i]} ||`);
      }
    } else {
      ordValues.push(originalSplit[i]);
    }
  }

  const parsedRange = parseRange(range);
  const cleanRange = range.replace(/([<=>^~])( )?/g, '');
  const splitRange = cleanRange.split(' ');
  const semverRange: SemVer[] = [];

  for (let i = 0; i < splitRange.length; i += 1) {
    if (!splitRange[i].includes('||')) {
      const splitVersion = splitRange[i].split('.');
      const major = splitVersion[0];
      const minor = splitVersion[1];
      const patch = splitVersion[2];
      const operator = ordValues[i].includes('||')
        ? '||'
        : parsedRange[i].operator;
      const NewSemVer: SemVer = {
        major,
      };

      let full = `${coerceString(operator)}${major}`;
      if (minor) {
        NewSemVer.minor = minor;
        full = `${full}.${minor}`;
        if (patch) {
          NewSemVer.patch = patch;
          full = `${full}.${patch}`;
        }
      }
      if (operator) {
        NewSemVer.operator = operator;
        full = range.includes(`${operator} `)
          ? `${operator} ${full.replace(operator, '')}`
          : `${operator}${full.replace(operator, '')}`;
      }

      full = ordValues[i].includes('||') ? ordValues[i] : full;

      NewSemVer.semver = full;

      semverRange.push(NewSemVer);
    }
  }
  return semverRange;
}

export function replaceRange({
  currentValue,
  newVersion,
}: NewValueConfig): string {
  const parsedRange = parseRange(currentValue);
  const element = parsedRange[parsedRange.length - 1];
  const toVersionMajor = getMajor(newVersion);
  const toVersionMinor = getMinor(newVersion);
  const toVersionPatch = getPatch(newVersion);
  const suffix = semver.prerelease(newVersion)
    ? '-' + String(semver.prerelease(newVersion)?.[0])
    : '';

  if (element.operator === '~>') {
    return `~> ${toVersionMajor}.${toVersionMinor}.0`;
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
    if (!!element.patch || suffix.length) {
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
  if (element.operator === '<' && toVersionMajor) {
    let res;
    if (currentValue.endsWith('.0.0')) {
      const newMajor = toVersionMajor + 1;
      res = `<${newMajor}.0.0`;
    } else if (element.patch) {
      res = `<${semver.inc(newVersion, 'patch')}`;
    } else if (element.minor && toVersionMinor) {
      res = `<${toVersionMajor}.${toVersionMinor + 1}`;
    } else {
      res = `<${toVersionMajor + 1}`;
    }
    if (currentValue.includes('< ')) {
      res = res.replace(/</g, '< ');
    }
    return res;
  }
  if (element.operator === '>') {
    let res;
    if (currentValue.endsWith('.0.0') && toVersionMajor) {
      const newMajor = toVersionMajor + 1;
      res = `>${newMajor}.0.0`;
    } else if (element.patch) {
      res = `>${toVersionMajor}.${toVersionMinor}.${toVersionPatch}`;
    } else if (element.minor) {
      res = `>${toVersionMajor}.${toVersionMinor}`;
    } else {
      res = `>${toVersionMajor}`;
    }
    if (currentValue.includes('> ')) {
      res = res.replace(/</g, '> ');
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
      return `${newVersion}`;
    }
    return `${toVersionMajor}`;
  }
  return newVersion;
}

export function widenRange(
  { currentValue, currentVersion, newVersion }: NewValueConfig,
  options: semver.Options,
): string | null {
  const parsedRange = parseRange(currentValue);
  const element = parsedRange[parsedRange.length - 1];

  if (matchesWithOptions(newVersion, currentValue, options)) {
    return currentValue;
  }
  const newValue = replaceRange({
    currentValue,
    rangeStrategy: 'replace',
    currentVersion,
    newVersion,
  });
  if (element.operator?.startsWith('<')) {
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

export function bumpRange(
  { currentValue, currentVersion, newVersion }: NewValueConfig,
  options: semver.Options,
): string | null {
  if (!containsOperators(currentValue) && currentValue.includes('||')) {
    return widenRange(
      {
        currentValue,
        rangeStrategy: 'widen',
        currentVersion,
        newVersion,
      },
      options,
    );
  }
  const parsedRange = parseRange(currentValue);
  const element = parsedRange[parsedRange.length - 1];

  const toVersionMajor = getMajor(newVersion);
  const toVersionMinor = getMinor(newVersion);
  const suffix = semver.prerelease(newVersion)
    ? '-' + String(semver.prerelease(newVersion)?.[0])
    : '';

  if (parsedRange.length === 1) {
    if (!element.operator) {
      return replaceRange({
        currentValue,
        rangeStrategy: 'replace',
        currentVersion,
        newVersion,
      });
    }
    if (element.operator.startsWith('~')) {
      const split = currentValue.split('.');
      if (suffix.length) {
        return `${element.operator}${newVersion}`;
      }
      if (split.length === 1) {
        // ~4
        return `${element.operator}${toVersionMajor}`;
      }
      if (split.length === 2) {
        // ~4.1
        return `${element.operator}${toVersionMajor}.${toVersionMinor}`;
      }
      return `${element.operator}${newVersion}`;
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
    const newRange = fixParsedRange(currentValue);
    const versions = newRange.map((x: any) => {
      // don't bump or'd single version values
      if (x.operator === '||') {
        return x.semver;
      }
      if (x.operator) {
        const bumpedSubRange = bumpRange(
          {
            currentValue: x.semver,
            rangeStrategy: 'bump',
            currentVersion,
            newVersion,
          },
          options,
        );
        if (
          bumpedSubRange &&
          matchesWithOptions(newVersion, bumpedSubRange, options)
        ) {
          return bumpedSubRange;
        }
      }

      return replaceRange({
        currentValue: x.semver,
        rangeStrategy: 'replace',
        currentVersion,
        newVersion,
      });
    });
    return versions.filter((x: any) => x !== null && x !== '').join(' ');
  }
  logger.debug(
    'Unsupported range type for rangeStrategy=bump: ' + currentValue,
  );
  return null;
}
