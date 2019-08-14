import {
  compare,
  eq,
  gt,
  ltr,
  maxSatisfying,
  minSatisfying,
  Range,
  satisfies,
} from 'semver';
import { logger } from '../../logger';
import { RangeStrategy, VersioningApi } from '../common';

const safe = require('safe-regex');

interface Version {
  // major, minor, and patch act in the standard semver fashion, but without
  // correctness requirements: if any one or two is omitted, they are treated
  // as zero. At least one must be present
  major: number;
  minor: number;
  patch: number;
  // prereleases are treated in the standard semver manner, if present
  prerelease: string;
  // architectures, if present, are treated as a compatibility layer: we will
  // never try to update to a version with a different architecture. Other than
  // for juding compatibility (exact string match), the architecture is ignored
  architecture: string;
}

// config is expected to be overridden by a user-specified RegExp value
// sample values:
//
// * emulates the "semver" configuration:
//   RegExp('^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(-(?<prerelease>.*))?$')
// * emulates the "docker" configuration:
//   RegExp('^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(-(?<architecture>.*))?$')
// * matches the versoining scheme used by the Python images on DockerHub:
//   RegExp('^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(?<prerelease>[^.-]+)?(-(?<architecture>.*))?$');
let config: RegExp = null;

// convenience method for passing a string into a Version given current config.
function parse(version: string): Version | null {
  const match = version.match(config);
  if (match === null) {
    return null;
  }

  const groups = match.groups;
  return {
    major: typeof groups.major === 'undefined' ? 0 : Number(groups.major),
    minor: typeof groups.minor === 'undefined' ? 0 : Number(groups.minor),
    patch: typeof groups.patch === 'undefined' ? 0 : Number(groups.patch),
    prerelease: groups.prerelease,
    architecture: groups.architecture,
  };
}

// convenience method for passing a Version object into any semver.* method.
function asSemver(version: Version): string {
  let vstring = `${version.major}.${version.minor}.${version.patch}`;
  if (typeof version.prerelease !== 'undefined') {
    vstring += `-${version.prerelease}`;
  }
  return vstring;
}

function configure(new_config: string): void {
  // without at least one of {major, minor, patch} specified in the regex,
  // this versioner will not work properly
  if (
    !new_config.includes('<major>') &&
    !new_config.includes('<minor>') &&
    !new_config.includes('<patch>')
  ) {
    const error = new Error('config-validation');
    error.configFile = new_config;
    error.validationError =
      'regex versionScheme needs at least one major, minor or patch group defined';
    throw error;
  }

  // TODO: should we validate the user has not added extra unsupported
  // capture groups?

  if (!safe(new_config)) {
    logger.warn('Unsafe regex versionScheme found');
    const error = new Error('config-validation');
    error.configFile = new_config;
    error.validationError = 'Unsafe regex versionSheme found';
    throw error;
  }

  config = RegExp(new_config);
}

const isValid = (version: string): string | boolean | null =>
  parse(version) !== null;
const isCompatible = (version: string, range: string): boolean =>
  parse(version).architecture === parse(range).architecture;
const isStable = (version: string): boolean =>
  typeof parse(version).prerelease === 'undefined';

const getMajor = (version: string): number | null => parse(version).major;
const getMinor = (version: string): number | null => parse(version).minor;
const getPatch = (version: string): number | null => parse(version).patch;

const equals = (version: string, other: string): boolean =>
  eq(asSemver(parse(version)), asSemver(parse(other)));
const isGreaterThan = (version: string, other: string): boolean =>
  gt(asSemver(parse(version)), asSemver(parse(other)));
const isLessThanRange = (version: string, range: string): boolean =>
  ltr(asSemver(parse(version)), range);
const maxSatisfyingVersion = (
  versions: string[],
  range: string
): string | null => maxSatisfying(versions.map(v => asSemver(parse(v))), range);
const minSatisfyingVersion = (
  versions: string[],
  range: string
): string | null => minSatisfying(versions.map(v => asSemver(parse(v))), range);
const getNewValue = (
  _currentValue: string,
  _rangeStrategy: RangeStrategy,
  _fromVersion: string,
  toVersion: string
): string => toVersion;
const sortVersions = (version: string, other: string): number =>
  compare(asSemver(parse(version)), asSemver(parse(other)));

const matches = (version: string, range: string | Range): boolean =>
  satisfies(asSemver(parse(version)), range);

export const api: VersioningApi = {
  configure,

  isCompatible,
  isSingleVersion: isValid,
  isStable,
  isValid,
  isVersion: isValid,

  getMajor,
  getMinor,
  getPatch,

  equals,
  isGreaterThan,
  isLessThanRange,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,

  matches,
};

export default api;
