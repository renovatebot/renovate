import semver from 'semver';
import type { RangeStrategy } from '../../../types/versioning';
import { regEx } from '../../../util/regex';
import { GenericVersion, GenericVersioningApi } from '../generic';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'oci-helm';
export const displayName = 'OCI Helm';
export const urls = [
  'https://semver.org/',
  'https://helm.sh/docs/chart_best_practices/dependencies/#versions',
  'https://github.com/Masterminds/semver#basic-comparisons',
  'https://helm.sh/docs/topics/registries/#oci-feature-deprecation-and-behavior-changes-with-v380',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'pin',
  'replace',
  'widen',
];

// Combining...
// - https://github.com/Masterminds/semver/blob/2f39fdc11c33c38e8b8b15b1f04334ba84e751f2/version.go#L42
// - https://regex101.com/r/vkijKf/1/ (official one from https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string)
// ...into https://regex101.com/r/Visopn/1 with group names
// ...prepended by range group to properly parse range values
const versionRegex = regEx(
  /^^(?<range>~|<|<=|>|>=|\^)?v?(?<major>[0-9]\d*)(\.(?<minor>[0-9]\d*))?(\.(?<patch>[0-9]\d*))?(?:-(?<prerelease>(?:[0-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?<metadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
);

class OciHelmVersioningApi extends GenericVersioningApi {
  private _oci2semver(value: string): string {
    return value && value.replaceAll('_', '+');
  }

  private _semver2oci(value: string): string {
    return value && value.replaceAll('+', '_');
  }

  private _calculateSatisfyingVersionIntenal(
    versions: string[],
    range: string,
    minMode: boolean,
  ): string | null {
    // versions values contain "_" instead of "+" as meta separator, so we need to convert those values
    const semverVersions = versions.map((v) => this._oci2semver(v));
    let semverRange = this._oci2semver(range);
    const satisfyingVersion = minMode
      ? semver.minSatisfying(semverVersions, semverRange)
      : semver.maxSatisfying(semverVersions, semverRange);

    return satisfyingVersion && this._semver2oci(satisfyingVersion);
  }

  protected override _parse(version: string): GenericVersion | null {
    if (!version) {
      return null;
    }
    const matchGroups = versionRegex.exec(this._oci2semver(version))?.groups;
    if (!matchGroups) {
      return null;
    }
    const { major, minor, patch, prerelease, metadata: suffix } = matchGroups;
    const release = [
      Number.parseInt(major, 10),
      typeof minor === 'undefined' ? 0 : Number.parseInt(minor, 10),
      typeof patch === 'undefined' ? 0 : Number.parseInt(patch, 10),
    ];
    return {
      release,
      prerelease,
      suffix,
    };
  }

  override isValid(version: string): boolean {
    return (
      !!version &&
      version
        .split(regEx(/\s*\|\|?\s*/g))
        .map((part): boolean => !!this._parse(part))
        .every((v) => v)
    );
  }

  override getNewValue({ newVersion }: NewValueConfig): string | null {
    return newVersion ? this._oci2semver(newVersion) : null;
  }

  override getSatisfyingVersion(
    versions: string[],
    range: string,
  ): string | null {
    return this._calculateSatisfyingVersionIntenal(versions, range, false);
  }

  override minSatisfyingVersion(
    versions: string[],
    range: string,
  ): string | null {
    return this._calculateSatisfyingVersionIntenal(versions, range, true);
  }

  override isSingleVersion(version: string): boolean {
    return !!semver.valid(this._oci2semver(version));
  }

  valueToVersion(version: string): string {
    return this._oci2semver(version);
  }
}

export const api: VersioningApi = new OciHelmVersioningApi();

export default api;
