import { parseRange } from 'semver-utils';
import { parse } from 'semver';
import { VERSION } from 'upath';
import { logger } from '../../logger';
import { api as npm } from '../npm';
import { api as pep440 } from '../pep440';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'poetry';
export const displayName = 'Poetry';
export const urls = ['https://python-poetry.org/docs/versions/'];
export const supportsRanges = true;
export const supportedRangeStrategies = ['bump', 'extend', 'pin', 'replace'];

// regex used by poetry.core.version.Version to parse union of SemVer
// (with a subset of pre/post/dev tags) and PEP440
// see: https://github.com/python-poetry/poetry-core/blob/01c0472d9cef3e1a4958364122dd10358a9bd719/poetry/core/version/version.py

// prettier-ignore
const VERSION_PATTERN = new RegExp(
  [
    '^',
    'v?',
    '(?:',
      '(?:(?<epoch>[0-9]+)!)?',           // epoch
      '(?<release>[0-9]+(?:\\.[0-9]+)*)', // release segment
      '(?<pre>',                          // pre-release
        '[-_.]?',
        '(?<pre_l>(a|b|c|rc|alpha|beta|pre|preview))',
        '[-_.]?',
        '(?<pre_n>[0-9]+)?',
      ')?',
      '(?<post>',                         // post release
        '(?:-(?<post_n1>[0-9]+))',
        '|',
        '(?:',
          '[-_.]?',
          '(?<post_l>post|rev|r)',
          '[-_.]?',
          '(?<post_n2>[0-9]+)?',
        ')',
      ')?',
      '(?<dev>',                          // dev release
        '[-_.]?',
        '(?<dev_l>dev)',
        '[-_.]?',
        '(?<dev_n>[0-9]+)?',
      ')?',
    ')',
    '(?:\\+(?<local>[a-z0-9]+(?:[-_.][a-z0-9]+)*))?', // local version
    '$'
  ].join('')
);

const RANGE_COMPARATOR_PATTERN = /(\s*(?:\^|~|[><!]?=|[><]|\|\|)\s*)/;

function parseLetterTag(letter?: string, number?: string) {
  if (letter != undefined) {
    if (number == undefined) {
      number = '0';
    }
    // apply the same normalizations as poetry
    var spellings = {
      alpha: 'a',
      beta: 'b',
      c: 'rc',
      pre: 'rc',
      preview: 'rc',
      r: 'post',
      rev: 'post',
    };
    return { letter: spellings[letter] || letter, number: number };
  }
  if (letter == undefined && number != undefined) {
    return { letter: 'post', number: number };
  }
}

// Parse versions like poetry.core.masonry.version.Version does (union of SemVer
// and PEP440, with normalization of certain prerelease tags), and emit in SemVer
// format. NOTE: this silently discards the epoch field in PEP440 versions, as
// it has no equivalent in SemVer.
function poetry2semver(
  poetry_version: string,
  padRelease: boolean = true
): string {
  const match = poetry_version.match(VERSION_PATTERN);
  // trim leading zeros from valid numbers
  let releaseParts = (match?.groups?.release || '')
    .split('.')
    .map((segment) => (isNaN(parseInt(segment)) ? segment : parseInt(segment)));
  while (padRelease && releaseParts.length < 3) {
    releaseParts.push(0);
  }
  const pre = parseLetterTag(match.groups.pre_l, match.groups.pre_n);
  const post = parseLetterTag(match.groups.post_l, match.groups.post_n);
  const dev = parseLetterTag(match.groups.dev_l, match.groups.dev_n);

  let parts = [releaseParts.map((num) => num.toString()).join('.')];
  if (pre != undefined) {
    parts.push('-' + pre.letter + '.' + pre.number);
  }
  if (post != undefined) {
    parts.push('-' + post.letter + '.' + post.number);
  }
  if (dev != undefined) {
    parts.push('-' + dev.letter + '.' + dev.number);
  }

  return parts.join('');
}

// Reverse normalizations applied by poetry2semver
function semver2poetry(version?: string): string | null {
  if (!version) {
    return null;
  }
  const s = parse(version);
  if (!s) {
    return null;
  }
  var spellings = {
    a: 'alpha',
    b: 'beta',
    c: 'rc',
    dev: 'alpha',
  };
  s.prerelease = s.prerelease.map((letter) => spellings[letter] || letter);
  return s.format();
}

function notEmpty(s: string): boolean {
  return s !== '';
}

function getVersionParts(input: string): [string, string] {
  const versionParts = input.split('-');
  if (versionParts.length === 1) {
    return [input, ''];
  }

  return [versionParts[0], '-' + versionParts[1]];
}

function padZeroes(input: string): string {
  if (/[~^*]/.test(input)) {
    // ignore ranges
    return input;
  }

  return poetry2semver(input);
}

// Translate a poetry-style version range to npm format
//
// This function works like cargo2npm, but it doesn't
// add a '^', because poetry treats versions without operators as
// exact versions.
function poetry2npm(input: string): string {
  // replace commas with spaces, then split at valid semver comparators
  const chunks = input
    .split(',')
    .map((str) => str.trim())
    .filter(notEmpty)
    .join(' ')
    .split(RANGE_COMPARATOR_PATTERN);
  const transformed = chunks
    .map((chunk) => {
      if (isVersion(chunk)) {
        // do not pad versions with zeros in a range
        return poetry2semver(chunk, false);
      } else {
        return chunk;
      }
    })
    .join('');
  return transformed;
}

// Translate an npm-style version range to poetry format
//
// NOTE: This function is largely copied from cargo versioning code.
// Poetry uses commas (like in cargo) instead of spaces (like in npm)
// for AND operation.
function npm2poetry(range: string): string {
  // apply poetry-style normalizations to versions embedded in range string
  // (i.e. anything that is not a range operator, potentially surrounded by whitespace)
  range = range
    .split(RANGE_COMPARATOR_PATTERN)
    .map((chunk) => {
      if (npm.isVersion(chunk)) {
        return semver2poetry(chunk);
      } else {
        return chunk;
      }
    })
    .join('');

  // Note: this doesn't remove the ^
  const res = range
    .split(' ')
    .map((str) => str.trim())
    .filter(notEmpty);

  const operators = ['^', '~', '=', '>', '<', '<=', '>='];
  for (let i = 0; i < res.length - 1; i += 1) {
    if (operators.includes(res[i])) {
      const newValue = res[i] + ' ' + res[i + 1];
      res.splice(i, 2, newValue);
    }
  }
  return res.join(', ').replace(/\s*,?\s*\|\|\s*,?\s*/, ' || ');
}

const equals = (a: string, b: string): boolean => {
  try {
    return npm.equals(padZeroes(a), padZeroes(b));
  } catch (err) /* istanbul ignore next */ {
    return pep440.equals(a, b);
  }
};

const getMajor = (version: string): number =>
  npm.getMajor(poetry2semver(version));

const getMinor = (version: string): number =>
  npm.getMinor(poetry2semver(version));

const getPatch = (version: string): number =>
  npm.getPatch(poetry2semver(version));

const isGreaterThan = (a: string, b: string): boolean =>
  npm.isGreaterThan(poetry2semver(a), poetry2semver(b));

const isLessThanRange = (version: string, range: string): boolean =>
  isVersion(version) &&
  npm.isLessThanRange(poetry2semver(version), poetry2npm(range));

export const isValid = (input: string): string | boolean =>
  npm.isValid(poetry2npm(input)) || pep440.isValid(input);

const isStable = (version: string): boolean => npm.isStable(padZeroes(version));

const isVersion = (input: string): boolean => VERSION_PATTERN.test(input);

const matches = (version: string, range: string): boolean =>
  isVersion(version) && npm.matches(poetry2semver(version), poetry2npm(range));

const getSatisfyingVersion = (versions: string[], range: string): string =>
  semver2poetry(
    npm.getSatisfyingVersion(versions.map(poetry2semver), poetry2npm(range))
  );

const minSatisfyingVersion = (versions: string[], range: string): string =>
  semver2poetry(
    npm.minSatisfyingVersion(versions.map(poetry2semver), poetry2npm(range))
  );

const isSingleVersion = (constraint: string): string | boolean =>
  (constraint.trim().startsWith('=') &&
    isVersion(constraint.trim().substring(1).trim())) ||
  isVersion(constraint.trim());

function handleShort(
  operator: string,
  currentValue: string,
  newVersion: string
): string {
  const toVersionMajor = getMajor(newVersion);
  const toVersionMinor = getMinor(newVersion);
  const split = currentValue.split('.');
  if (split.length === 1) {
    // [^,~]4
    return `${operator}${toVersionMajor}`;
  }
  if (split.length === 2) {
    // [^,~]4.1
    return `${operator}${toVersionMajor}.${toVersionMinor}`;
  }
  return null;
}

function getNewValue({
  currentValue,
  rangeStrategy,
  currentVersion,
  newVersion,
}: NewValueConfig): string {
  if (rangeStrategy === 'replace') {
    const npmCurrentValue = poetry2npm(currentValue);
    try {
      const massagedNewVersion = poetry2semver(newVersion);
      if (
        isVersion(massagedNewVersion) &&
        npm.matches(massagedNewVersion, npmCurrentValue)
      ) {
        return currentValue;
      }
    } catch (err) /* istanbul ignore next */ {
      logger.info(
        { err },
        'Poetry versioning: Error caught checking if newVersion satisfies currentValue'
      );
    }
    const parsedRange = parseRange(npmCurrentValue);
    const element = parsedRange[parsedRange.length - 1];
    if (parsedRange.length === 1 && element.operator) {
      if (element.operator === '^') {
        const version = handleShort('^', npmCurrentValue, newVersion);
        if (version) {
          return npm2poetry(version);
        }
      }
      if (element.operator === '~') {
        const version = handleShort('~', npmCurrentValue, newVersion);
        if (version) {
          return npm2poetry(version);
        }
      }
    }
  }

  // Explicitly check whether this is a fully-qualified version
  if (
    (newVersion.match(VERSION_PATTERN)?.groups?.release || '').split('.')
      .length != 3
  ) {
    logger.debug(
      'Cannot massage python version to npm - returning currentValue'
    );
    return currentValue;
  }
  try {
    const newSemver = npm.getNewValue({
      currentValue: poetry2npm(currentValue),
      rangeStrategy,
      currentVersion: poetry2semver(currentVersion),
      newVersion: poetry2semver(newVersion),
    });
    const newPoetry = npm2poetry(newSemver);
    return newPoetry;
  } catch (err) /* istanbul ignore next */ {
    logger.debug(
      { currentValue, rangeStrategy, currentVersion, newVersion, err },
      'Could not generate new value using npm.getNewValue()'
    );
    return currentValue;
  }
}

function sortVersions(a: string, b: string): number {
  return npm.sortVersions(poetry2semver(a), poetry2semver(b));
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  getNewValue,
  getSatisfyingVersion,
  isCompatible: isVersion,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  minSatisfyingVersion,
  sortVersions,
};
export default api;
