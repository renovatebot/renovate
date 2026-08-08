import { CONFIG_VALIDATION } from '../../../constants/error-messages.ts';
import { regEx } from '../../../util/regex.ts';
import type { GenericVersion } from '../generic.ts';
import { GenericVersioningApi } from '../generic.ts';
import { parseRange, satisfiesComparator } from '../generic-range.ts';
import type { VersioningApiConstructor } from '../types.ts';

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
      typeof major === 'undefined' ? 0 : Number.parseInt(major, 10),
      typeof minor === 'undefined' ? 0 : Number.parseInt(minor, 10),
      typeof patch === 'undefined' ? 0 : Number.parseInt(patch, 10),
    ];

    if (build) {
      release.push(Number.parseInt(build, 10));
      if (revision) {
        release.push(Number.parseInt(revision, 10));
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
      parsedVersion.compatibility === parsedCurrent?.compatibility
    );
  }

  override isValid(input: string): boolean {
    return (
      this.isVersion(input) ||
      parseRange(input, (v) => this.isVersion(v)) !== null
    );
  }

  override isVersion(version: string): boolean {
    return this._parse(version) !== null;
  }

  override isSingleVersion(input: string): boolean {
    const range = parseRange(input, (v) => this.isVersion(v));
    if (range) {
      return (
        range.length === 1 &&
        (range[0].operator === '=' || range[0].operator === '==')
      );
    }
    return this.isVersion(input);
  }

  override matches(version: string, range: string): boolean {
    const comparators = parseRange(range, (v) => this.isVersion(v));
    if (!comparators) {
      return this.equals(version, range);
    }
    return comparators.every((comparator) =>
      satisfiesComparator(
        this._compare(version, comparator.version),
        comparator.operator,
      ),
    );
  }

  override getSatisfyingVersion(
    versions: string[],
    range: string,
  ): string | null {
    if (parseRange(range, (v) => this.isVersion(v)) === null) {
      return super.getSatisfyingVersion(versions, range);
    }
    const matching = versions.filter((v) => this.matches(v, range));
    matching.sort((a, b) => this._compare(a, b));
    return matching.at(-1) ?? null;
  }

  override minSatisfyingVersion(
    versions: string[],
    range: string,
  ): string | null {
    if (parseRange(range, (v) => this.isVersion(v)) === null) {
      return super.minSatisfyingVersion(versions, range);
    }
    const matching = versions.filter((v) => this.matches(v, range));
    matching.sort((a, b) => this._compare(a, b));
    return matching.at(0) ?? null;
  }
}

export const api: VersioningApiConstructor = RegExpVersioningApi;

export default api;
