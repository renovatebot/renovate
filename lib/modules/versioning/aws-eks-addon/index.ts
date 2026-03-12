import { RegExpVersioningApi } from '../regex/index.ts';
import type { VersioningApi } from '../types.ts';

export const id = 'aws-eks-addon';
export const displayName = 'aws-eks-addon';
export const urls = [];
export const supportsRanges = false;

export class AwsEKSAddonVersioningApi extends RegExpVersioningApi {
  static versionRegex =
    '^v?(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(?<compatibility>-eksbuild\\.)(?<build>\\d+)$';

  public constructor() {
    super(AwsEKSAddonVersioningApi.versionRegex);
  }
}

export const api: VersioningApi = new AwsEKSAddonVersioningApi();

export default api;
