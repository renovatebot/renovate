import type { GetReleasesConfig, ReleaseResult } from '../types';
import * as goproxy from './goproxy';
import { getReleases as directReleases } from './releases-direct';

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
