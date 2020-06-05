import is from '@sindresorhus/is';
import { logger } from '../logger';
import * as runCache from '../util/cache/run';
import { clone } from '../util/clone';
import * as allVersioning from '../versioning';
import datasources from './api.generated';
import {
  Datasource,
  DatasourceError,
  DigestConfig,
  GetPkgReleasesConfig,
  GetReleasesConfig,
  Release,
  ReleaseResult,
} from './common';
import { addMetaData } from './metadata';

export * from './common';

export const getDatasources = (): Map<string, Promise<Datasource>> =>
  datasources;
export const getDatasourceList = (): string[] => Array.from(datasources.keys());

const cacheNamespace = 'datasource-releases';

function load(datasource: string): Promise<Datasource> {
  return datasources.get(datasource);
}

type GetReleasesInternalConfig = GetReleasesConfig & GetPkgReleasesConfig;

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
  config: GetReleasesInternalConfig
): Promise<ReleaseResult | null> {
  const { datasource: datasourceName } = config;
  if (!datasourceName || !datasources.has(datasourceName)) {
    logger.warn('Unknown datasource: ' + datasourceName);
    return null;
  }
  const datasource = await load(datasourceName);
  const registryUrls = resolveRegistryUrls(datasource, config.registryUrls);
  const dep = await datasource.getReleases({
    ...config,
    registryUrls,
  });
  addMetaData(dep, datasourceName, config.lookupName);
  return dep;
}

function getRawReleases(
  config: GetReleasesInternalConfig
): Promise<ReleaseResult | null> {
  const cacheKey =
    cacheNamespace +
    config.datasource +
    config.lookupName +
    config.registryUrls;
  // By returning a Promise and reusing it, we should only fetch each package at most once
  const cachedResult = runCache.get(cacheKey);
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  const promisedRes = fetchReleases(config);
  runCache.set(cacheKey, promisedRes);
  return promisedRes;
}

export async function getPkgReleases(
  config: GetPkgReleasesConfig
): Promise<ReleaseResult | null> {
  if (!config.datasource) {
    logger.warn('No datasource found');
    return null;
  }
  const lookupName = config.lookupName || config.depName;
  if (!lookupName) {
    logger.error({ config }, 'Datasource getReleases without lookupName');
    return null;
  }
  let res: ReleaseResult;
  try {
    res = clone(
      await getRawReleases({
        ...config,
        lookupName,
      })
    );
  } catch (e) /* istanbul ignore next */ {
    if (e instanceof DatasourceError) {
      e.datasource = config.datasource;
      e.lookupName = lookupName;
    }
    throw e;
  }
  if (!res) {
    return res;
  }
  // Filter by versioning
  const version = allVersioning.get(config.versioning);
  // Return a sorted list of valid Versions
  function sortReleases(release1: Release, release2: Release): number {
    return version.sortVersions(release1.version, release2.version);
  }
  if (res.releases) {
    res.releases = res.releases
      .filter((release) => version.isVersion(release.version))
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

export async function getDefaultConfig(datasource: string): Promise<object> {
  const loadedDatasource = await load(datasource);
  return loadedDatasource?.defaultConfig || {};
}
