import { logger } from '../../../logger';
import type { RangeStrategy } from '../../../types/versioning';
import { regEx } from '../../../util/regex';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'pvp';
export const displayName = 'Package Versioning Policy (Haskell)';
export const urls = [];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = ['auto'];

type Parsed = { lower: string; upper: string };
type Components = { major: number[]; minor: number[]; patch: number[] };

export function parse(input: string): Parsed | null {
  const noSpaces = input.replaceAll(' ', '');
  const r = regEx(/>=(?<lower>[\d.]+)&&<(?<upper>[\d.]+)/);
  const m = r.exec(noSpaces);
  if (!m?.groups) {
    return null;
  }
  return {
    lower: m.groups['lower'],
    upper: m.groups['upper'],
  };
}

export function extractAllComponents(version: string): number[] {
  const versionMajor = version.split('.');
  const versionIntMajor: number[] = versionMajor.map((x) => parseInt(x, 10));
  const ret = [];
  for (const l of versionIntMajor) {
    if (l < 0 || !isFinite(l)) {
      continue;
    }
    ret.push(l);
  }
  return ret;
}

function compareIntArray(
  versionIntMajor: number[],
  otherIntMajor: number[],
): 'lt' | 'eq' | 'gt' {
  for (
    let i = 0;
    i < Math.min(versionIntMajor.length, otherIntMajor.length);
    i++
  ) {
    if (versionIntMajor[i] > otherIntMajor[i]) {
      return 'gt';
    }
    if (versionIntMajor[i] < otherIntMajor[i]) {
      return 'lt';
    }
  }
  if (versionIntMajor.length === otherIntMajor.length) {
    return 'eq';
  }
  if (versionIntMajor.length > otherIntMajor.length) {
    return 'gt';
  }
  return 'lt';
}

function isGreaterThan(version: string, other: string): boolean {
  const versionIntMajor = extractAllComponents(version);
  const otherIntMajor = extractAllComponents(other);
  return compareIntArray(versionIntMajor, otherIntMajor) === 'gt';
}

function getMajor(version: string): number {
  // This basically can't be implemented correctly, since
  // 1.1 and 1.10 become equal when converted to float.
  // Consumers should use isSame instead.
  const l1 = version.split('.');
  return Number(l1.slice(0, 2).join('.'));
}

function getMinor(version: string): number | null {
  const l1 = version.split('.');
  if (l1.length < 3) {
    return null;
  }
  return Number(l1[2]);
}

function getPatch(version: string): number | null {
  const l1 = version.split('.');
  const components = l1.slice(3);
  if (components.length === 0) {
    return null;
  }
  return Number(components[0] + '.' + components.slice(1).join(''));
}

function matches(version: string, range: string): boolean {
  const parsed = parse(range);
  if (parsed === null) {
    return false;
  }
  const ver = extractAllComponents(version);
  const lower = extractAllComponents(parsed.lower);
  const upper = extractAllComponents(parsed.upper);
  return (
    'gt' === compareIntArray(upper, ver) &&
    ['eq', 'lt'].includes(compareIntArray(lower, ver))
  );
}

function satisfyingVersion(
  versions: string[],
  range: string,
  onGreaterThan: (isGreaterThan: boolean) => boolean,
): string | null {
  const copy = versions.slice(0);
  copy.sort((a, b) => (onGreaterThan(isGreaterThan(a, b)) ? -1 : 1));
  const result = copy.find((v) => matches(v, range));
  return result ?? null;
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return satisfyingVersion(versions, range, (x) => x);
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  return satisfyingVersion(versions, range, (x) => !x);
}

function isLessThanRange(version: string, range: string): boolean {
  const parsed = parse(range);
  if (parsed === null) {
    return false;
  }
  const compos = extractAllComponents(version);
  const lower = extractAllComponents(parsed.lower);
  return 'lt' === compareIntArray(compos, lower);
}

export function getComponents(splitOne: string): Components | null {
  const c = extractAllComponents(splitOne);
  if (c.length === 0) {
    return null;
  }
  return {
    major: c.slice(0, 2),
    minor: c.slice(2, 3),
    patch: c.slice(3),
  };
}

function plusOne(majorOne: number[]): string {
  return `${majorOne[0]}.${majorOne[1] + 1}`;
}

function getNewValue({
  currentValue,
  newVersion,
  rangeStrategy,
}: NewValueConfig): string | null {
  if (rangeStrategy !== 'auto') {
    logger.info(
      { rangeStrategy, currentValue, newVersion },
      `PVP can't handle this range strategy.`,
    );
    return null;
  }
  const parsed = parse(currentValue);
  if (parsed === null) {
    logger.info(
      { currentValue, newVersion },
      'could not parse PVP version range',
    );
    return null;
  }
  if (isLessThanRange(newVersion, currentValue)) {
    // ignore new releases in old release series
    return null;
  }
  if (matches(newVersion, currentValue)) {
    // the upper bound is already high enough
    return null;
  }
  // isLessThanRange returns true when newVersion is invalid. so we can assert it non-null
  const compos = getComponents(newVersion);
  const majorPlusOne = plusOne(compos!.major);
  // istanbul ignore next: since all versions that can be parsed, can also be bumped, this can never happen
  if (!matches(newVersion, `>=${parsed.lower} && <${majorPlusOne}`)) {
    logger.warn(
      { newVersion },
      "Even though the major bound was bumped, the newVersion still isn't accepted.",
    );
    return null;
  }
  return `>=${parsed.lower} && <${majorPlusOne}`;
}

function isSame(
  type: 'major' | 'minor' | 'patch',
  a: string,
  b: string,
): boolean {
  const aComponents = getComponents(a);
  const bComponents = getComponents(b);
  if (aComponents === null || bComponents === null) {
    return false;
  }
  if (type === 'major') {
    return 'eq' === compareIntArray(aComponents.major, bComponents.major);
  } else if (type === 'minor') {
    return 'eq' === compareIntArray(aComponents.minor, bComponents.minor);
  } else {
    return 'eq' === compareIntArray(aComponents.patch, bComponents.patch);
  }
}

function subset(subRange: string, superRange: string): boolean | undefined {
  const sub = parse(subRange);
  const sup = parse(superRange);
  if (sub === null || sup === null) {
    return undefined;
  }
  const subLower = extractAllComponents(sub.lower);
  const subUpper = extractAllComponents(sub.upper);
  const supLower = extractAllComponents(sup.lower);
  const supUpper = extractAllComponents(sup.upper);
  if ('lt' === compareIntArray(subLower, supLower)) {
    return false;
  }
  if ('gt' === compareIntArray(subUpper, supUpper)) {
    return false;
  }
  return true;
}

function isVersion(maybeRange: string | undefined | null): boolean {
  return typeof maybeRange === 'string' && parse(maybeRange) === null;
}

function isValid(ver: string): boolean {
  return extractAllComponents(ver).length >= 1;
}

function isSingleVersion(range: string): boolean {
  const noSpaces = range.trim();
  const r = regEx(/^[\d.]+$/);
  return noSpaces.startsWith('==') && r.test(noSpaces.slice(2));
}

function equals(a: string, b: string): boolean {
  return (
    'eq' === compareIntArray(extractAllComponents(a), extractAllComponents(b))
  );
}

function sortVersions(a: string, b: string): number {
  if (equals(a, b)) {
    return 0;
  }
  return isGreaterThan(a, b) ? 1 : -1;
}

function isStable(version: string): boolean {
  return true;
}

function isCompatible(version: string): boolean {
  return true;
}

export const api: VersioningApi = {
  isValid,
  isVersion,
  isStable,
  isCompatible,
  getMajor,
  getMinor,
  getPatch,
  isSingleVersion,
  sortVersions,
  equals,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  isLessThanRange,
  isGreaterThan,
  getNewValue,
  isSame,
  subset,
};
export default api;
