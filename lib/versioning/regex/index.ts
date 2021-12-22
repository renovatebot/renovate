import is from '@sindresorhus/is';
import semver from 'semver';
import { CONFIG_VALIDATION } from '../../constants/error-messages';
import { regEx } from '../../util/regex';
import { GenericVersion, GenericVersioningApi } from '../loose/generic';
import type { VersioningApiConstructor } from '../types';

export const id = 'regex';
export const displayName = 'Regular Expression';
export const urls = [];
export const supportsRanges = false;

export interface RegExpVersion extends GenericVersion {
  /**
   * compatibility, if present, are treated as a compatibility layer: we will
   * never try to update to a version with a different compatibility.
   */
  compatibility: string;
}

// convenience method for passing a Version object into any semver.* method.
function asSemver(version: RegExpVersion): string {
  let vstring = `${version.release[0]}.${version.release[1]}.${version.release[2]}`;
  if (is.nonEmptyString(version.prerelease)) {
    vstring += `-${version.prerelease}`;
  }
  return vstring;
}

export class RegExpVersioningApi extends GenericVersioningApi<RegExpVersion> {
  // config is expected to be overridden by a user-specified RegExp value
  // sample values:
  //
  // * emulates the "semver" configuration:
  //   RegExp('^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(-(?<prerelease>.*))?$')
  // * emulates the "docker" configuration:
  //   RegExp('^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(-(?<compatibility>.*))?$')
  // * matches the versioning approach used by the Python images on DockerHub:
  //   RegExp('^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(?<prerelease>[^.-]+)?(-(?<compatibility>.*))?$');
  // * matches the versioning approach used by the Bitnami images on DockerHub:
  //   RegExp('^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(:?-(?<compatibility>.*-r)(?<build>\\d+))?$');
  private _config: RegExp = null;

  constructor(_new_config: string) {
    super();
    const new_config = _new_config || '^(?<major>\\d+)?$';

    // without at least one of {major, minor, patch} specified in the regex,
    // this versioner will not work properly
    if (
      !new_config.includes('<major>') &&
      !new_config.includes('<minor>') &&
      !new_config.includes('<patch>')
    ) {
      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = new_config;
      error.validationError =
        'regex versioning needs at least one major, minor or patch group defined';
      throw error;
    }

    // TODO: should we validate the user has not added extra unsupported
    // capture groups? (#9717)
    this._config = regEx(new_config);
  }

  // convenience method for passing a string into a Version given current config.
  protected _parse(version: string): RegExpVersion | null {
    const match = this._config.exec(version);
    if (match === null) {
      return null;
    }

    const groups = match.groups;
    const release = [
      typeof groups.major === 'undefined' ? 0 : Number(groups.major),
      typeof groups.minor === 'undefined' ? 0 : Number(groups.minor),
      typeof groups.patch === 'undefined' ? 0 : Number(groups.patch),
    ];

    if (groups.build) {
      release.push(Number(groups.build));
    }

    return {
      release,
      prerelease: groups.prerelease,
      compatibility: groups.compatibility,
    };
  }

  override isCompatible(version: string, range: string): boolean {
    return (
      this._parse(version).compatibility === this._parse(range).compatibility
    );
  }

  override isLessThanRange(version: string, range: string): boolean {
    return semver.ltr(
      asSemver(this._parse(version)),
      asSemver(this._parse(range))
    );
  }

  override getSatisfyingVersion(
    versions: string[],
    range: string
  ): string | null {
    return semver.maxSatisfying(
      versions.map((v) => asSemver(this._parse(v))),
      asSemver(this._parse(range))
    );
  }

  override minSatisfyingVersion(
    versions: string[],
    range: string
  ): string | null {
    return semver.minSatisfying(
      versions.map((v) => asSemver(this._parse(v))),
      asSemver(this._parse(range))
    );
  }

  override matches(version: string, range: string): boolean {
    return semver.satisfies(
      asSemver(this._parse(version)),
      asSemver(this._parse(range))
    );
  }
}

export const api: VersioningApiConstructor = RegExpVersioningApi;

export default api;
