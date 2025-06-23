import type { ReleaseResult } from '../modules/datasource/types';

export const registry = {
  async getPkgReleases(): Promise<ReleaseResult> {
    return {
      releases: [],
      sourceUrl: '',
      homepage: '',
      registryUrl: '',
    };
  },
};
