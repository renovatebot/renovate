import { regEx } from '../../../util/regex';
import { coerceString } from '../../../util/string';
import type { GenericVersion } from '../generic';
import { GenericVersioningApi } from '../generic';
import type { VersioningApi } from '../types';

export const id = 'aws-eks-addon';
export const displayName = 'aws-eks-addon';

export const urls = [];

export const supportsRanges = false;

const versionPattern = regEx(
  '^v?(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(?<metadata>-eksbuild\\.\\d+)?$',
);

export class AwsEKSAddonVersioningApi extends GenericVersioningApi {
  protected _parse(version: string): GenericVersion | null {
    if (!version) {
      return null;
    }
    const matches = versionPattern.exec(version);
    if (!matches?.groups) {
      return null;
    }
    const { major, minor, patch, metadata: suffix } = matches.groups;
    if (!suffix) {
      return null;
    }
    const release = [Number(major), Number(minor), Number(patch)];
    return { release, suffix };
  }

  protected override _compare(version: string, other: string): number {
    const compare: number = super._compare(version, other);
    if (compare !== 0) {
      return compare;
    }
    const parsed1: GenericVersion | null = this._parse(version);
    const parsed2: GenericVersion | null = this._parse(other);

    const suffix1 = coerceString(parsed1?.suffix);
    const suffix2 = coerceString(parsed2?.suffix);
    return suffix1.localeCompare(suffix2);
  }

  override isCompatible(version: string, current: string): boolean {
    const parsed1 = this._parse(version);
    const parsed2 = this._parse(current);
    return !!(parsed1 && parsed2);
  }
}

export const api: VersioningApi = new AwsEKSAddonVersioningApi();

export default api;
