import { regEx } from '../../util/regex';
import { GenericVersion, GenericVersioningApi } from '../loose/generic';
import type { VersioningApi } from '../types';

export const id = 'aws-machine-image';
export const displayName = 'aws-machine-image';

export const urls = [];

export const supportsRanges = false;

const awsMachineImageRegex = regEx('^ami-(?<suffix>[a-z0-9]{17})$');

class AwsMachineImageVersioningApi extends GenericVersioningApi {
  protected _parse(version: string): GenericVersion | null {
    if (version) {
      const matchGroups = awsMachineImageRegex.exec(version)?.groups;
      if (matchGroups) {
        const { suffix } = matchGroups;
        return { release: [1, 0, 0], suffix };
      }
    }
    return null;
  }

  protected override _compare(_version: string, _other: string): number {
    return 0;
  }
}

export const api: VersioningApi = new AwsMachineImageVersioningApi();

export default api;
