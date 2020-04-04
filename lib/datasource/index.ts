import is from '@sindresorhus/is';
import { logger } from '../logger';
import { addMetaData } from './metadata';
import * as allVersioning from '../versioning';

import {
  Datasource,
  DatasourceError,
  PkgReleaseConfig,
  Release,
  ReleaseResult,
  DigestConfig,
} from './common';
import * as semverVersioning from '../versioning/semver';
import datasources from './api.generated';

export * from './common';

export const getDatasources = (): Map<string, Promise<Datasource>> =>
  datasources;
export const getDatasourceList = (): string[] => Array.from(datasources.keys());

const cacheNamespace = 'datasource-releases';

function load(datasource: string): Promise<Datasource> {
  return datasources.get(datasource);
}

function resolveRegistryUrls(
  datasource: Datasource,
  extractedUrls: string[]
): string[] {
  const { defaultRegistryUrls = [], appendRegistryUrls = [] } = datasource;
  return is.nonEmptyArray(extractedUrls)
    ? [...extractedUrls, ...appendRegistryUrls]
    : [...defaultRegistryUrls, ...appendRegistryUrls];
}

async function fetchReleases(
  config: PkgReleaseConfig
): Promise<ReleaseResult | null> {
  const { datasource: datasourceName } = config;
  if (!datasourceName) {
    logger.warn('No datasource found');
    return null;
  }
  if (!datasources.has(datasourceName)) {
    logger.warn('Unknown datasource: ' + datasourceName);
    return null;
  }
  const datasource = await load(datasourceName);
  const registryUrls = resolveRegistryUrls(datasource, config.registryUrls);
  const dep = await datasource.getPkgReleases({
    ...config,
    registryUrls,
  });
  addMetaData(dep, datasourceName, config.lookupName);
  return dep;
}

function getRawReleases(
  config: PkgReleaseConfig
): Promise<ReleaseResult | null> {
  const cacheKey =
    cacheNamespace +
    config.datasource +
    config.lookupName +
    config.registryUrls;
  // The repoCache is initialized for each repo
  // By returning a Promise and reusing it, we should only fetch each package at most once
  if (!global.repoCache[cacheKey]) {
    global.repoCache[cacheKey] = fetchReleases(config);
  }
  return global.repoCache[cacheKey];
}

export async function getPkgReleases(
  config: PkgReleaseConfig
): Promise<ReleaseResult | null> {
  const { datasource } = config;
  const lookupName = config.lookupName || config.depName;
  if (!lookupName) {
    logger.error({ config }, 'Datasource getPkgReleases without lookupName');
    return null;
  }
  let res: ReleaseResult;
  try {
    res = await getRawReleases({
      ...config,
      lookupName,
    });
  } catch (e) /* istanbul ignore next */ {
    if (e instanceof DatasourceError) {
      e.datasource = datasource;
      e.lookupName = lookupName;
    }
    throw e;
  }
  if (!res) {
    return res;
  }
  const versioning =
    config && config.versioning ? config.versioning : semverVersioning.id;
  // Filter by versioning
  const version = allVersioning.get(versioning);
  // Return a sorted list of valid Versions
  function sortReleases(release1: Release, release2: Release): number {
    return version.sortVersions(release1.version, release2.version);
  }
  if (res.releases) {
    res.releases = res.releases
      .filter(release => version.isVersion(release.version))
      .sort(sortReleases);
  }
  return res;
}

export async function supportsDigests(config: DigestConfig): Promise<boolean> {
  return 'getDigest' in (await load(config.datasource));
}

export async function getDigest(
  config: DigestConfig,
  value?: string
): Promise<string | null> {
  const lookupName = config.lookupName || config.depName;
  const { registryUrls } = config;
  return (await load(config.datasource)).getDigest(
    { lookupName, registryUrls },
    value
  );
}
