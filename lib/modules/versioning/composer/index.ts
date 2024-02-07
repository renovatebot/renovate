import is from '@sindresorhus/is';
import semver from 'semver';
import { parseRange } from 'semver-utils';
import { logger } from '../../../logger';
import type { RangeStrategy } from '../../../types/versioning';
import { regEx } from '../../../util/regex';
import { api as npm } from '../npm';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'composer';
export const displayName = 'Composer';
export const urls = [
  'https://getcomposer.org/doc/articles/versions.md',
  'https://packagist.org/packages/composer/semver',
  'https://madewithlove.be/tilde-and-caret-constraints/',
  'https://semver.mwl.be',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'pin',
  'replace',
  'update-lockfile',
];

function getVersionParts(input: string): [string, string] {
  const versionParts = input.split('-');
  if (versionParts.length === 1) {
    return [input, ''];
  }

  return [versionParts[0], '-' + versionParts[1]];
}

function padZeroes(input: string): string {
  const [output, stability] = getVersionParts(input);

  const sections = output.split('.');
  while (sections.length < 3) {
    sections.push('0');
  }
  return sections.join('.') + stability;
}

function convertStabilityModifier(input: string): string {
  // Handle stability modifiers.
  const versionParts = input.split('@');
  if (versionParts.length === 1) {
    return input;
  }

  // 1.0@beta2 to 1.0-beta.2
  const stability = versionParts[1].replace(
    regEx(/(?:^|\s)(beta|alpha|rc)([1-9][0-9]*)(?: |$)/gi),
    '$1.$2',
  );

  // If there is a stability part, npm semver expects the version
  // to be full
  return padZeroes(versionParts[0]) + '-' + stability;
}

function normalizeVersion(input: string): string {
  let output = input;
  output = output.replace(regEx(/(^|>|>=|\^|~)v/i), '$1');
  return convertStabilityModifier(output);
}

/**
 * @param versions Version list in any format, it recognizes the specific patch format x.x.x-pXX
 * @param range Range in composer format
 * @param minMode If true, it will calculate minSatisfyingVersion, if false, it calculates the maxSatisfyingVersion
 * @returns min or max satisfyingVersion from the input
 */
function calculateSatisfyingVersionIntenal(
  versions: string[],
  range: string,
  minMode: boolean,
): string | null {
  // Because composer -p versions are considered stable, we have to remove the suffix for the npm.XXX functions.
  const versionsMapped = versions.map((x) => {
    return {
      origianl: x,
      cleaned: removeComposerSpecificPatchPart(x),
      npmVariant: composer2npm(removeComposerSpecificPatchPart(x)[0]),
    };
  });

  const npmVersions = versionsMapped.map((x) => x.npmVariant);
  const npmVersion = minMode
    ? npm.minSatisfyingVersion(npmVersions, composer2npm(range))
    : npm.getSatisfyingVersion(npmVersions, composer2npm(range));

  if (!npmVersion) {
    return null;
  }

  // After we find the npm versions, we select from them back in the mapping the possible patches.
  const candidates = versionsMapped
    .filter((x) => x.npmVariant === npmVersion)
    .sort((a, b) => (minMode ? 1 : -1) * sortVersions(a.origianl, b.origianl));

  return candidates[0].origianl;
}

/**
 * @param intput Version in any format, it recognizes the specific patch format x.x.x-pXX
 * @returns If input contains the specific patch, it returns the input with removed the patch and true, otherwise it retunrs the same string and false.
 */
function removeComposerSpecificPatchPart(input: string): [string, boolean] {
  // the regex is based on the original from composer implementation https://github.com/composer/semver/blob/fa1ec24f0ab1efe642671ec15c51a3ab879f59bf/src/VersionParser.php#L137
  const pattern = /^v?\d+(\.\d+(\.\d+(\.\d+)?)?)?(?<suffix>-p[1-9]\d*)$/gi;
  const match = pattern.exec(input);

  return match
    ? [input.replace(match.groups!.suffix, ''), true]
    : [input, false];
}

function composer2npm(input: string): string {
  return input
    .split(regEx(/\s*\|\|?\s*/g))
    .map((part): string => {
      const cleanInput = normalizeVersion(part);
      if (npm.isVersion(cleanInput)) {
        return cleanInput;
      }
      if (npm.isVersion(padZeroes(cleanInput))) {
        return padZeroes(cleanInput);
      }
      const [versionId, stability] = getVersionParts(cleanInput);
      let output = versionId;

      // ~4 to ^4 and ~4.1 to ^4.1
      output = output.replace(
        regEx(/(?:^|\s)~([1-9][0-9]*(?:\.[0-9]*)?)(?: |$)/g),
        '^$1',
      );
      // ~0.4 to >=0.4 <1
      output = output.replace(
        regEx(/(?:^|\s)~(0\.[1-9][0-9]*)(?: |$)/g),
        '>=$1 <1',
      );

      // add extra digits to <8-DEV and <8.0-DEV
      output = output
        .replace(regEx(/^(<\d+(\.\d+)?)$/g), '$1.0')
        .replace(regEx(/^(<\d+(\.\d+)?)$/g), '$1.0');

      return output + stability;
    })
    .map((part) => part.replace(/([a-z])([0-9])/gi, '$1.$2'))
    .join(' || ');
}

function equals(a: string, b: string): boolean {
  return npm.equals(composer2npm(a), composer2npm(b));
}

function getMajor(version: string): number | null {
  const semverVersion = semver.coerce(composer2npm(version));
  return semverVersion ? npm.getMajor(semverVersion) : null;
}

function getMinor(version: string): number | null {
  const semverVersion = semver.coerce(composer2npm(version));
  return semverVersion ? npm.getMinor(semverVersion) : null;
}

function getPatch(version: string): number | null {
  const semverVersion = semver.coerce(composer2npm(version));

  // This returns only the numbers without the optional `-pXX` patch version supported by composer. Fixing that would require a bigger
  // refactoring, because the API supports only numbers.
  return semverVersion ? npm.getPatch(semverVersion) : null;
}

function isGreaterThan(a: string, b: string): boolean {
  return sortVersions(a, b) === 1;
}

function isLessThanRange(version: string, range: string): boolean {
  return !!npm.isLessThanRange?.(composer2npm(version), composer2npm(range));
}

function isSingleVersion(input: string): boolean {
  return !!input && npm.isSingleVersion(composer2npm(input));
}

function isStable(version: string): boolean {
  if (version) {
    // Composer considers patches `-pXX` as stable: https://github.com/composer/semver/blob/fa1ec24f0ab1efe642671ec15c51a3ab879f59bf/src/VersionParser.php#L568 but npm not.
    // In order to be able to use the standard npm.isStable function, we remove the potential patch version for the check.
    const [withoutPatch] = removeComposerSpecificPatchPart(version);
    return npm.isStable(composer2npm(withoutPatch));
  }

  return false;
}

export function isValid(input: string): boolean {
  return !!input && npm.isValid(composer2npm(input));
}

export function isVersion(input: string): boolean {
  return !!input && npm.isVersion(composer2npm(input));
}

function matches(version: string, range: string): boolean {
  return npm.matches(composer2npm(version), composer2npm(range));
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return calculateSatisfyingVersionIntenal(versions, range, false);
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return calculateSatisfyingVersionIntenal(versions, range, true);
}

function subset(subRange: string, superRange: string): boolean | undefined {
  try {
    return npm.subset!(composer2npm(subRange), composer2npm(superRange));
  } catch (err) {
    logger.trace({ err }, 'composer.subset error');
    return false;
  }
}

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string | null {
  if (rangeStrategy === 'pin') {
    return newVersion;
  }
  if (rangeStrategy === 'update-lockfile') {
    if (matches(newVersion, currentValue)) {
      return currentValue;
    }
    return getNewValue({
      currentValue,
      rangeStrategy: 'replace',
      currentVersion,
      newVersion,
    });
  }
  const currentMajor = currentVersion ? getMajor(currentVersion) : null;
  const toMajor = getMajor(newVersion);
  const toMinor = getMinor(newVersion);
  let newValue: string | null = null;
  if (isVersion(currentValue)) {
    newValue = newVersion;
  } else if (regEx(/^[~^](0\.[1-9][0-9]*)$/).test(currentValue)) {
    const operator = currentValue.substring(0, 1);
    // handle ~0.4 case first
    if (toMajor === 0) {
      // TODO: types (#22198)
      newValue = `${operator}0.${toMinor!}`;
    } else {
      // TODO: types (#22198)
      newValue = `${operator}${toMajor!}.0`;
    }
  } else if (regEx(/^[~^]([0-9]*)$/).test(currentValue)) {
    // handle ~4 case
    const operator = currentValue.substring(0, 1);
    // TODO: types (#22198)
    newValue = `${operator}${toMajor!}`;
  } else if (
    toMajor &&
    regEx(/^[~^]([0-9]*(?:\.[0-9]*)?)$/).test(currentValue)
  ) {
    const operator = currentValue.substring(0, 1);
    if (rangeStrategy === 'bump') {
      newValue = `${operator}${newVersion}`;
    } else if (
      (is.number(currentMajor) && toMajor > currentMajor) ||
      !toMinor
    ) {
      // handle ~4.1 case
      newValue = `${operator}${toMajor}.0`;
    } else {
      newValue = `${operator}${toMajor}.${toMinor}`;
    }
  } else if (
    currentVersion &&
    npm.isVersion(padZeroes(normalizeVersion(newVersion))) &&
    npm.isValid(normalizeVersion(currentValue)) &&
    composer2npm(currentValue) === normalizeVersion(currentValue)
  ) {
    newValue = npm.getNewValue({
      currentValue: normalizeVersion(currentValue),
      rangeStrategy,
      currentVersion: padZeroes(normalizeVersion(currentVersion)),
      newVersion: padZeroes(normalizeVersion(newVersion)),
    });
  }

  if (rangeStrategy === 'widen' && matches(newVersion, currentValue)) {
    newValue = currentValue;
  } else {
    const hasOr = currentValue.includes(' || ');
    if (hasOr || rangeStrategy === 'widen') {
      const splitValues = currentValue.split('||');
      const lastValue = splitValues[splitValues.length - 1];
      const replacementValue = getNewValue({
        currentValue: lastValue.trim(),
        rangeStrategy: 'replace',
        currentVersion,
        newVersion,
      });
      if (rangeStrategy === 'replace') {
        newValue = replacementValue;
      } else if (replacementValue) {
        const parsedRange = parseRange(replacementValue);
        const element = parsedRange[parsedRange.length - 1];
        if (element.operator?.startsWith('<')) {
          const splitCurrent = currentValue.split(element.operator);
          splitCurrent.pop();
          newValue = splitCurrent.join(element.operator) + replacementValue;
        } else {
          newValue = currentValue + ' || ' + replacementValue;
        }
      }
    }
  }

  if (!newValue) {
    logger.warn(
      { currentValue, rangeStrategy, currentVersion, newVersion },
      'Unsupported composer value',
    );
    newValue = newVersion;
  }
  if (currentValue.split('.')[0].includes('v')) {
    newValue = newValue.replace(regEx(/([0-9])/), 'v$1');
  }

  // Preserve original min-stability specifier
  if (currentValue.includes('@')) {
    newValue += '@' + currentValue.split('@')[1];
  }

  return newValue;
}

function sortVersions(a: string, b: string): number {
  const [aWithoutPatch, aContainsPatch] = removeComposerSpecificPatchPart(a);
  const [bWithoutPatch, bContainsPatch] = removeComposerSpecificPatchPart(b);

  if (aContainsPatch === bContainsPatch) {
    // If both [a and b] contain patch version or both [a and b] do not contain patch version, then npm comparison deliveres correct results
    return npm.sortVersions(composer2npm(a), composer2npm(b));
  } else if (
    npm.equals(composer2npm(aWithoutPatch), composer2npm(bWithoutPatch))
  ) {
    // If only one [a or b] contains patch version and the parts without patch versions are equal, then the version with patch is greater (this is the case where npm comparison fails)
    return aContainsPatch ? 1 : -1;
  } else {
    // All other cases can be compared correctly by npm
    return npm.sortVersions(composer2npm(a), composer2npm(b));
  }
}

function isCompatible(version: string): boolean {
  return isVersion(version);
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isCompatible,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,
  subset,
};
export default api;
