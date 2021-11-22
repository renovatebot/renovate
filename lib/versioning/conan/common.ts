import * as semver from 'semver';
import { SemVer, parseRange } from 'semver-utils';
import { regEx } from '../../util/regex';

export function makeVersion(
  version: string,
  options: semver.Options
): string | boolean {
  const splitVersion = version.split('.');
  const prerelease = semver.prerelease(version, options);

  if (prerelease && !options.includePrerelease) {
    if (!Number.isNaN(+prerelease[0])) {
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
      .replace(/,|\[|\]|"|include_prerelease=|loose=|True|False/g, '')
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
  options: semver.Options
): boolean {
  let cleanedVersion = version;
  if (semver.prerelease(cleanedVersion) && options.includePrerelease) {
    cleanedVersion = semver.coerce(cleanedVersion).raw;
  }
  return semver.satisfies(cleanedVersion, cleanRange, options);
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

      let full = `${operator || ''}${major}`;
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
