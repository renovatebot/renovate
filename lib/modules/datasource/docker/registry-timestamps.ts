import { logger } from '../../../logger/index.ts';
import type { RegistryType } from '../../../types/host-rules.ts';
import * as hostRules from '../../../util/host-rules.ts';
import type { Timestamp } from '../../../util/timestamp.ts';
import type { Release } from '../types.ts';
import { dockerDatasourceId } from './common.ts';
import { getGitlabTagTimestamps } from './gitlab.ts';
import type { RegistryTimestampsFetcher } from './types.ts';

const fetchers: Record<RegistryType, RegistryTimestampsFetcher> = {
  gitlab: getGitlabTagTimestamps,
};

/**
 * Registry hosts whose `registryType` is known without configuration.
 */
const wellKnownRegistryTypes: Record<string, RegistryType> = {
  'https://registry.gitlab.com': 'gitlab',
};

/**
 * Returns the `registryType` and `registryApiUrl` for a registry host, from a matching host rule or the well-known registry hosts.
 */
export function getRegistryType(
  registryHost: string,
): { registryType: RegistryType; registryApiUrl?: string } | null {
  const { registryType, registryApiUrl } = hostRules.find({
    hostType: dockerDatasourceId,
    url: registryHost,
  });
  if (registryType) {
    return { registryType, registryApiUrl };
  }

  const wellKnownType = wellKnownRegistryTypes[registryHost];
  if (wellKnownType) {
    return { registryType: wellKnownType };
  }

  return null;
}

/**
 * Adds a `releaseTimestamp` to each release whose tag the registry's API reports a push time for.
 */
export async function addRegistryTimestamps(
  registryHost: string,
  dockerRepository: string,
  releases: Release[],
): Promise<Release[]> {
  const registry = getRegistryType(registryHost);
  if (!registry) {
    return releases;
  }

  const { registryType, registryApiUrl } = registry;
  let timestamps: Map<string, Timestamp> | null = null;
  try {
    timestamps = await fetchers[registryType]({
      registryHost,
      dockerRepository,
      registryApiUrl,
    });
  } catch (err) {
    logger.debug(
      { err },
      `Docker: failed to fetch ${registryType} release timestamps for ${registryHost}/${dockerRepository}`,
    );
  }
  if (!timestamps) {
    return releases;
  }

  return releases.map((release) => {
    const releaseTimestamp = timestamps.get(release.version);
    return releaseTimestamp ? { ...release, releaseTimestamp } : release;
  });
}
