import type { GetReleasesConfig, ReleaseResult } from '../types';
import { getReleases as directReleases } from './releases-direct';
import * as goproxy from './releases-goproxy';

export { id } from './common';

export const customRegistrySupport = false;

export async function getReleases(
  config: GetReleasesConfig
): Promise<ReleaseResult | null> {
  const res = await goproxy.getReleases(config);
  if (res) {
    return res;
  }

  return directReleases(config);
}
