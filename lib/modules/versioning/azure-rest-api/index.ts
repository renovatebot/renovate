import { regEx } from '../../../util/regex';
import { GenericVersion, GenericVersioningApi } from '../generic';
import type { VersioningApi } from '../types';

export const id = 'azure-rest-api';
export const displayName = 'azure-rest-api';

export const urls = [
  'https://github.com/microsoft/api-guidelines/blob/vNext/azure/Guidelines.md#api-versioning',
];

export const supportsRanges = false;

const AZURE_REST_API_VERSION_REGEX = regEx(
  /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})(?<prerelease>-[a-z]+)?$/,
);

class AzureRestApiVersioningApi extends GenericVersioningApi {
  protected _parse(version: string): GenericVersion | null {
    if (!version) {
      return null;
    }

    const matchGroups = AZURE_REST_API_VERSION_REGEX.exec(version)?.groups;

    if (!matchGroups) {
      return null;
    }

    const { year, month, day, prerelease } = matchGroups;

    return {
      release: [parseInt(`${year}${month}${day}`), 0, 0],
      prerelease,
    };
  }

  protected override _compare(_version: string, _other: string): number {
    if (_version === _other) {
      return 0;
    }

    return _version > _other ? 1 : -1;
  }
}

export const api: VersioningApi = new AzureRestApiVersioningApi();

export default api;
