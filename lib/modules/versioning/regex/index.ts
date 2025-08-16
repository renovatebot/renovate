import { CONFIG_VALIDATION } from '../../../constants/error-messages';
import { regEx } from '../../../util/regex';
import type { GenericVersion } from '../generic';
import { GenericVersioningApi } from '../generic';
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
  protected readonly _config: RegExp;

  constructor(_new_config: string | undefined) {
    super();
    const new_config = _new_config ?? '^(?<major>\\d+)?$';

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
    const groups = this._config?.exec(version)?.groups;
    if (!groups) {
      return null;
    }

    const { major, minor, patch, build, revision, prerelease, compatibility } =
      groups;
    const release = [
      typeof major === 'undefined' ? 0 : Number.parseInt(major),
      typeof minor === 'undefined' ? 0 : Number.parseInt(minor),
      typeof patch === 'undefined' ? 0 : Number.parseInt(patch),
    ];

    if (build) {
      release.push(Number.parseInt(build));
      if (revision) {
        release.push(Number.parseInt(revision));
      }
    }

    return {
      release,
      prerelease,
      compatibility,
    };
  }

  override isCompatible(version: string, current: string): boolean {
    const parsedVersion = this._parse(version);
    const parsedCurrent = this._parse(current);
    return !!(
      parsedVersion &&
      parsedCurrent &&
      parsedVersion.compatibility === parsedCurrent.compatibility
    );
  }
}

export const api: VersioningApiConstructor = RegExpVersioningApi;

export default api;
