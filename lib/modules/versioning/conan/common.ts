import * as semver from 'semver';
import { regEx } from '../../../util/regex';

export function makeVersion(
  version: string,
  options: semver.RangeOptions
): string | boolean | null {
  const splitVersion = version.split('.');
  const prerelease = semver.prerelease(version, options);

  if (prerelease && !options.includePrerelease) {
    if (!Number.isNaN(parseInt(prerelease.toString()[0], 10))) {
      const stringVersion = `${splitVersion[0]}.${splitVersion[1]}.${splitVersion[2]}`;
      return semver.valid(stringVersion, options);
    }
    return false;
  }

  if (
    options.loose &&
    !semver.valid(version, options) &&
    splitVersion.length !== 3
  ) {
    return semver.valid(semver.coerce(version, options), options);
  }
  return semver.valid(version, options);
}

export function cleanVersion(version: string): string {
  if (version) {
    return version
      .replace(regEx(/,|\[|\]|"|include_prerelease=|loose=|True|False/g), '')
      .trim();
  }
  return version;
}

export function getOptions(input: string): {
  loose: boolean;
  includePrerelease: boolean;
} {
  let includePrerelease = false;
  let loose = true;
  if (input) {
    includePrerelease =
      input.includes('include_prerelease=True') &&
      !input.includes('include_prerelease=False');
    loose = input.includes('loose=True') || !input.includes('loose=False');
  }
  return { loose, includePrerelease };
}

export function containsOperators(input: string): boolean {
  return regEx('[<=>^~]').test(input);
}

export function matchesWithOptions(
  version: string,
  cleanRange: string,
  options: semver.RangeOptions
): boolean {
  let cleanedVersion = version;
  if (
    cleanedVersion &&
    semver.prerelease(cleanedVersion) &&
    options.includePrerelease
  ) {
    const coercedVersion = semver.coerce(cleanedVersion)?.raw;
    cleanedVersion = coercedVersion ? coercedVersion : '';
  }
  return semver.satisfies(cleanedVersion, cleanRange, options);
}

export function findSatisfyingVersion(
  versions: string[],
  range: string,
  compareRt: number
): string | null {
  const options = getOptions(range);
  let cur: any = null;
  let curSV: any = null;
  let index = 0;
  let curIndex = -1;

  for (const v of versions) {
    const versionFromList = makeVersion(v, options);
    if (typeof versionFromList === 'string') {
      const cleanedVersion = cleanVersion(versionFromList);
      const options = getOptions(range);
      const cleanRange = cleanVersion(range);
      if (matchesWithOptions(cleanedVersion, cleanRange, options)) {
        if (
          !cur ||
          semver.compare(curSV, versionFromList, options) === compareRt
        ) {
          cur = versionFromList;
          curIndex = index;
          curSV = new semver.SemVer(cur, options);
        }
      }
    }
    index += 1;
  }
  if (curIndex >= 0) {
    return versions[curIndex];
  }
  return null;
}
