import { isNonEmptyString } from '@sindresorhus/is';
import semver from 'semver';
import stable from 'semver-stable';
import type { RangeStrategy } from '../../../types/versioning.ts';
import { regEx } from '../../../util/regex.ts';
import { stripVersionPrefix } from '../../../util/string.ts';
import { api as npm } from '../npm/index.ts';
import { isBreaking as semverIsBreaking } from '../semver/index.ts';
import type { NewValueConfig, VersioningApi } from '../types.ts';

export const id = 'nimble';
export const displayName = 'Nimble';
export const urls = [
  '[Nimble Package Manager - Dependencies](https://github.com/nim-lang/nimble#dependencies)',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'replace',
  'pin',
  'update-lockfile',
];

function cleanVer(version: string): string {
  return stripVersionPrefix(version.trim());
}

/**
 * Pads a version string with `.0` components so it has 3 components for semver
 * comparison, while preserving any prerelease/build suffix.
 */
function padVersion(version: string): string {
  const cleaned = cleanVer(version);
  const match = regEx(
    /^(?<core>\d+(?:\.\d+)*)(?<suffix>(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/,
  ).exec(cleaned);
  if (!match?.groups) {
    return cleaned;
  }
  const parts = match.groups.core.split('.');
  while (parts.length < 3) {
    parts.push('0');
  }
  return `${parts.join('.')}${match.groups.suffix}`;
}

export function isVersion(input: string): boolean {
  if (!input) {
    return false;
  }
  const trimmed = input.trim();
  if (
    trimmed.startsWith('#') ||
    regEx(/^[><=!~^&]/).test(trimmed) ||
    trimmed.includes('&') ||
    trimmed.includes(' ')
  ) {
    return false;
  }
  return !!semver.valid(padVersion(trimmed));
}

/**
 * Computes the next incompatible version according to Nimble's
 * `getNextIncompatibleVersion(version, semver)` in `nimblepkg/version.nim`.
 */
function getNextIncompatibleVersion(
  versionStr: string,
  isCaret: boolean,
): string {
  const cleaned = cleanVer(versionStr).replace(regEx(/[-+].*$/), '');
  const numbers = cleaned.split('.');
  const originalNumberLen = numbers.length;
  while (numbers.length < 3) {
    numbers.push('0');
  }

  let zeros = 0;
  for (let n = 0; n < 2; n += 1) {
    if (numbers[n] === '0') {
      zeros += 1;
    } else {
      break;
    }
  }

  let increasePosition = 0;
  if (isCaret) {
    if (originalNumberLen > 1) {
      if (zeros === 0) {
        increasePosition = 0;
      } else if (zeros === 1) {
        increasePosition = 1;
      } else {
        increasePosition = 2;
      }
    }
  } else {
    increasePosition = Math.max(0, originalNumberLen - 2);
  }

  numbers[increasePosition] = String(
    Number.parseInt(numbers[increasePosition], 10) + 1,
  );
  for (let pos = increasePosition + 1; pos < numbers.length; pos += 1) {
    numbers[pos] = '0';
  }
  return numbers.join('.');
}

function clauseToNpm(clause: string): string | null {
  const trimmed = clause.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }
  if (trimmed === 'any' || trimmed === '*') {
    return '*';
  }

  const match = regEx(/^(?<op>>=|<=|==|\^=|~=|>|<|=)?\s*(?<ver>\S+)$/).exec(
    trimmed,
  );
  if (!match?.groups) {
    return null;
  }

  const op = match.groups.op ?? '';
  const rawVer = match.groups.ver;
  if (!isVersion(rawVer)) {
    return null;
  }
  const padded = padVersion(rawVer);

  switch (op) {
    case '':
    case '==':
    case '=':
      return padded;
    case '>=':
    case '<=':
    case '>':
    case '<':
      return `${op}${padded}`;
    case '^=':
    case '~=':
    default: {
      const upper = getNextIncompatibleVersion(rawVer, op === '^=');
      return `>=${padded} <${upper}`;
    }
  }
}

export function nimble2npm(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const parts = trimmed.split('&');
  if (parts.length > 2) {
    // Nimble's parseVersionRange disallows more than one `&`
    return null;
  }

  const converted: string[] = [];
  for (const part of parts) {
    const c = clauseToNpm(part);
    if (!c) {
      return null;
    }
    converted.push(c);
  }

  return converted.join(' ');
}

export function isValid(input: string): boolean {
  if (!input) {
    return false;
  }
  const npmRange = nimble2npm(input);
  return !!npmRange && npm.isValid(npmRange);
}

export function isSingleVersion(constraint: string): boolean {
  if (!constraint) {
    return false;
  }
  const trimmed = constraint.trim();
  if (trimmed.includes('&')) {
    return false;
  }
  if (isVersion(trimmed)) {
    return true;
  }
  const eqMatch = regEx(/^==?\s*(?<ver>\S+)$/).exec(trimmed);
  return !!eqMatch?.groups && isVersion(eqMatch.groups.ver);
}

function isStable(version: string): boolean {
  if (!isVersion(version)) {
    return false;
  }
  return stable.is(padVersion(version));
}

function getMajor(version: string): number | null {
  return isVersion(version) ? semver.major(padVersion(version)) : null;
}

function getMinor(version: string): number | null {
  return isVersion(version) ? semver.minor(padVersion(version)) : null;
}

function getPatch(version: string): number | null {
  return isVersion(version) ? semver.patch(padVersion(version)) : null;
}

function equals(a: string, b: string): boolean {
  if (!isVersion(a) || !isVersion(b)) {
    return false;
  }
  return semver.eq(padVersion(a), padVersion(b));
}

function isGreaterThan(a: string, b: string): boolean {
  if (!isVersion(a) || !isVersion(b)) {
    return false;
  }
  return semver.gt(padVersion(a), padVersion(b));
}

function sortVersions(a: string, b: string): number {
  if (!isVersion(a) || !isVersion(b)) {
    return 0;
  }
  return semver.compare(padVersion(a), padVersion(b));
}

function matches(version: string, range: string): boolean {
  if (!isVersion(version)) {
    return false;
  }
  const npmRange = nimble2npm(range);
  if (!npmRange) {
    return false;
  }
  return npm.matches(padVersion(version), npmRange);
}

function isLessThanRange(version: string, range: string): boolean {
  if (!isVersion(version)) {
    return false;
  }
  const npmRange = nimble2npm(range);
  if (!npmRange) {
    return false;
  }
  return !!npm.isLessThanRange?.(padVersion(version), npmRange);
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const satisfying = versions
    .filter((v) => matches(v, range))
    .sort(sortVersions);
  return satisfying.at(-1) ?? null;
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  const satisfying = versions
    .filter((v) => matches(v, range))
    .sort(sortVersions);
  return satisfying[0] ?? null;
}

function getPinnedValue(newVersion: string): string {
  return `== ${cleanVer(newVersion)}`;
}

function adaptPrecision(newVersion: string, templateVersion: string): string {
  const cleanTarget = cleanVer(newVersion);
  const cleanTemplate = cleanVer(templateVersion).replace(regEx(/[-+].*$/), '');
  const count = cleanTemplate.split('.').length;
  const targetParts = cleanTarget.replace(regEx(/[-+].*$/), '').split('.');
  const isPrereleaseOrBuild = regEx(/[-+]/).test(cleanTarget);
  if (count < 3 && !isPrereleaseOrBuild) {
    return targetParts.slice(0, count).join('.');
  }
  return cleanTarget;
}

function updateSingleClause(
  clause: string,
  rangeStrategy: RangeStrategy,
  newVersion: string,
): string {
  const trimmed = clause.trim();
  const target = cleanVer(newVersion);

  const match = regEx(
    /^(?<op>>=|<=|==|\^=|~=|>|<|=)?(?<space>\s*)(?<ver>\S+)$/,
  ).exec(trimmed);
  /* v8 ignore if -- guarded by isValid/getNewValue */
  if (!match?.groups) {
    return trimmed;
  }

  const op = match.groups.op ?? '';
  const space = match.groups.space;
  const oldVer = match.groups.ver;

  if (!op) {
    return target;
  }

  if (op === '==' || op === '=') {
    return `${op}${space}${target}`;
  }

  if (op === '^=' || op === '~=') {
    if (rangeStrategy === 'bump') {
      return `${op}${space}${target}`;
    }
    return `${op}${space}${adaptPrecision(target, oldVer)}`;
  }

  if (op === '>=' || op === '>') {
    return `${op}${space}${target}`;
  }

  if (op === '<=') {
    if (matches(target, trimmed)) {
      return trimmed;
    }
    return `<=${space}${adaptPrecision(target, oldVer)}`;
  }

  // op === '<'
  if (matches(target, trimmed)) {
    return trimmed;
  }
  const cleanOld = cleanVer(oldVer).replace(regEx(/[-+].*$/), '');
  const parts = cleanOld.split('.');
  const paddedTarget = padVersion(target);
  const maj = semver.major(paddedTarget);
  const min = semver.minor(paddedTarget);
  const pat = semver.patch(paddedTarget);

  if (parts.length === 1) {
    return `<${space}${maj + 1}`;
  }
  if (parts.length === 2) {
    return `<${space}${maj}.${min + 1}`;
  }
  if (cleanOld.endsWith('.0.0')) {
    return `<${space}${maj + 1}.0.0`;
  }
  if (cleanOld.endsWith('.0')) {
    return `<${space}${maj}.${min + 1}.0`;
  }
  return `<${space}${maj}.${min}.${pat + 1}`;
}

export function getNewValue({
  currentValue,
  rangeStrategy,
  newVersion,
}: NewValueConfig): string {
  if (!currentValue || currentValue === '*' || currentValue === 'any') {
    return currentValue;
  }
  if (!isValid(currentValue) || !isVersion(newVersion)) {
    return currentValue;
  }

  const target = cleanVer(newVersion);

  if (rangeStrategy === 'pin') {
    return getPinnedValue(target);
  }

  if (rangeStrategy === 'update-lockfile') {
    if (matches(target, currentValue)) {
      return currentValue;
    }
    return getNewValue({
      currentValue,
      rangeStrategy: 'replace',
      newVersion: target,
    });
  }

  const isReplaceOrWiden =
    rangeStrategy === 'replace' || rangeStrategy === 'widen';
  if (isReplaceOrWiden && matches(target, currentValue)) {
    return currentValue;
  }

  if (isSingleVersion(currentValue)) {
    return updateSingleClause(currentValue, rangeStrategy, target);
  }

  if (currentValue.includes('&')) {
    const separator = currentValue.includes(' & ') ? ' & ' : '&';
    const [leftRaw, rightRaw] = currentValue
      .split('&')
      .map((s) => s.trim())
      .filter(isNonEmptyString);

    if (rangeStrategy === 'widen') {
      const newLeft = matches(target, leftRaw)
        ? leftRaw
        : updateSingleClause(leftRaw, 'widen', target);
      const newRight = matches(target, rightRaw)
        ? rightRaw
        : updateSingleClause(rightRaw, 'widen', target);
      return `${newLeft}${separator}${newRight}`;
    }

    // For `bump` or `replace` on `>= X & < Y`
    const newLeft = updateSingleClause(leftRaw, rangeStrategy, target);
    const newRight = matches(target, rightRaw)
      ? rightRaw
      : updateSingleClause(rightRaw, rangeStrategy, target);
    return `${newLeft}${separator}${newRight}`;
  }

  // Single operator constraint (e.g. `>= 1.0.0`, `^= 1.0.0`, `~= 1.0.0`, `< 2.0.0`)
  const trimmed = currentValue.trim();
  const isCaretOrTilde = trimmed.startsWith('^=') || trimmed.startsWith('~=');
  if (rangeStrategy === 'widen' && isCaretOrTilde) {
    const isCaret = trimmed.startsWith('^=');
    const space = trimmed.slice(2).startsWith(' ') ? ' ' : '';
    const oldVer = trimmed.slice(2).trim();
    const upper = getNextIncompatibleVersion(target, isCaret);
    return `>=${space}${oldVer} & <${space}${upper}`;
  }

  return updateSingleClause(currentValue, rangeStrategy, target);
}

function subset(subRange: string, superRange: string): boolean | undefined {
  const npmSub = nimble2npm(subRange);
  const npmSuper = nimble2npm(superRange);
  if (!npmSub || !npmSuper) {
    return false;
  }
  return npm.subset!(npmSub, npmSuper);
}

function intersects(range1: string, range2: string): boolean {
  const npm1 = nimble2npm(range1);
  const npm2 = nimble2npm(range2);
  if (!npm1 || !npm2) {
    return false;
  }
  return npm.intersects!(npm1, npm2);
}

function isBreaking(current: string, version: string): boolean {
  if (!isVersion(current) || !isVersion(version)) {
    return false;
  }
  return semverIsBreaking(padVersion(current), padVersion(version));
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getNewValue,
  getPatch,
  getPinnedValue,
  isBreaking,
  isCompatible: isVersion,
  isGreaterThan,
  isLessThanRange,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  sortVersions,
  subset,
  intersects,
};

export default api;
