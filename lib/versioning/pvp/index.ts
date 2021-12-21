import { VersioningApi } from '../types';

export const id = 'pvp';
export const displayName = 'PVP';
export const urls = ['https://pvp.haskell.org'];
export const supportsRanges = true;

// https://pvp.haskell.org/#version-numbers
type PVP = {
  A: number; // Major
  B: number; // Major
  C: number; // Minor
  additional: number[]; // First element is patch. Can be empty (no patch version)
};

const hasLeadingZero = (str: string): boolean =>
  str.length > 1 && str.startsWith('0');

const anyElementHasLeadingZero = (strings: string[]): boolean => {
  const bools = strings.map((str) => hasLeadingZero(str));
  return bools.includes(true);
};

const throwInvalidVersionError = (version: string): void => {
  throw new Error(
    `${version} is not a valid version. See https://pvp.haskell.org.`
  );
};

const parse = (version: string): PVP => {
  const [a, b, c, ...additional] = version.split('.');
  if (anyElementHasLeadingZero([a, b, c, additional].flat())) {
    throwInvalidVersionError(version);
  }
  const a_ = parseInt(a);
  const b_ = parseInt(b);
  const c_ = parseInt(c);
  if (isNaN(a_) || isNaN(b_) || isNaN(c_)) {
    throwInvalidVersionError(version);
  }
  const additional_: number[] = [];
  additional.forEach((ele) => {
    const ele_ = parseInt(ele);
    if (isNaN(ele_)) {
      throwInvalidVersionError(version);
    } else {
      additional_.push(ele_);
    }
  });
  return { A: a_, B: b_, C: c_, additional: additional_ };
};

/**
 * Represents major version as a float
 * A.B
 * B is optional so if it is not included it defaults to A.0
 */
const getMajor = (version: string): number => {
  const { A, B } = parse(version);
  return parseFloat(`${A}.${B}`);
};

const getMinor = (version: string): number => {
  const { C } = parse(version);
  return C;
};

// Patch version is optional
const getPatch = (version: string): number | null => {
  const { additional } = parse(version);
  return additional[0];
};

const isValid = (version: string): boolean => {
  try {
    parse(version);
  } catch {
    return false;
  }
  return true;
};

/**
 * PVP does not specify a stable version
 * https://pvp.haskell.org/faq/#how-does-the-pvp-relate-to-semantic-versioning-semver
 */
const isStable = (): boolean => true;

const isVersion = (version: string): string | boolean | null =>
  !!isValid(version);

// credit: https://stackoverflow.com/a/22015930/12963115
const zip = (a: number[], b: number[]): [number?, number?][] =>
  Array.from(Array(Math.max(b.length, a.length)), (_, i) => [a[i], b[i]]);

/**
 * Compare 2 versions
 * Note if the last component (D) is not defined it is considered less than 0
 * e.g. 2.0.1.0 > 2.0.1
 */
const compare = (version: string, other: string): number => {
  const versionA = parse(version);
  const versionB = parse(other);

  const versionAL = [
    versionA.A,
    versionA.B,
    versionA.C,
    ...versionA.additional,
  ];
  const versionBL = [
    versionB.A,
    versionB.B,
    versionB.C,
    ...versionB.additional,
  ];
  const zippedVersions = zip(versionAL, versionBL);

  for (const currentComponents of zippedVersions) {
    const [component, otherComponent] = currentComponents;
    if (component > otherComponent || otherComponent === undefined) {
      return 1;
    } else if (component < otherComponent || component === undefined) {
      return -1;
    }
  }

  return 0;
};

const equals = (a: string, b: string): boolean => compare(a, b) === 0;
const isGreaterThan = (a: string, b: string): boolean => compare(a, b) === 1;

/**
 * Verifies the version is a single version but since we don't handle non single versions
 * so if it fails to parse then it's not a single version.
 */
const isSingleVersion = (version: string): string | boolean | null => {
  try {
    parse(version);
    return true;
  } catch {
    return false;
  }
};

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isCompatible: isVersion,
  isGreaterThan,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,
  sortVersions: compare,
  // TODO Range related functions not sure how to implement these if we won't be handling ranges
  getNewValue,
  isLessThanRange,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
};
