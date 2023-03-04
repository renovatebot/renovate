import { GenericVersion, GenericVersioningApi } from '../generic';
import type { VersioningApi } from '../types';

export const id = 'azure-rest-api';
export const displayName = 'azure-rest-api';

export const urls = [];

export const supportsRanges = false;

class AzureRestApiVersioningApi extends GenericVersioningApi {
  protected _parse(version: string): GenericVersion | null {
    if (version) {
      return {
        release: [1, 0, 0],
        suffix: version.substring(0, 10),
        prerelease: version.length > 10 ? version.substring(9) : undefined,
      };
    }
    return null;
  }

  protected override _compare(_version: string, _other: string): number {
    return 1;
  }
}

export const api: VersioningApi = new AzureRestApiVersioningApi();

export default api;
