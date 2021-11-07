import type { GetReleasesConfig, ReleaseResult } from '../types';
import * as direct from './releases-direct';
import * as goproxy from './releases-goproxy';

export { id } from './common';

export const customRegistrySupport = false;

export function getReleases(
  config: GetReleasesConfig
): Promise<ReleaseResult | null> {
  return process.env.GOPROXY
    ? goproxy.getReleases(config)
    : direct.getReleases(config);
}
