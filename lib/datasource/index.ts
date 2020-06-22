import is from '@sindresorhus/is';
import _ from 'lodash';
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

function firstRegistry(
  config: GetReleasesInternalConfig,
  datasource: Datasource,
  registryUrls: string[]
): Promise<ReleaseResult> {
  if (registryUrls.length > 1) {
    logger.warn(
      { datasource: datasource.id, depName: config.depName, registryUrls },
      'Excess registryUrls found for datasource lookup - using first configured only'
    );
  }
  const registryUrl = registryUrls[0];
  return datasource.getReleases({
    ...config,
    registryUrl,
  });
}

async function huntRegistries(
  config: GetReleasesInternalConfig,
  datasource: Datasource,
  registryUrls: string[]
): Promise<ReleaseResult> {
  let res: ReleaseResult;
  let datasourceError;
  for (const registryUrl of registryUrls) {
    try {
      res = await datasource.getReleases({
        ...config,
        registryUrl,
      });
      if (res) {
        break;
      }
    } catch (err) {
      if (err instanceof DatasourceError) {
        throw err;
      }
      // We'll always save the last-thrown error
      datasourceError = err;
      logger.trace({ err }, 'datasource hunt failure');
    }
  }
  if (res === undefined && datasourceError) {
    // if we failed to get a result and also got an error then throw it
    throw datasourceError;
  }
  return res;
}

async function mergeRegistries(
  config: GetReleasesInternalConfig,
  datasource: Datasource,
  registryUrls: string[]
): Promise<ReleaseResult> {
  let combinedRes: ReleaseResult;
  let datasourceError;
  for (const registryUrl of registryUrls) {
    try {
      const res = await datasource.getReleases({
        ...config,
        registryUrl,
      });
      if (combinedRes) {
        combinedRes = { ...res, ...combinedRes };
        combinedRes.releases = [...combinedRes.releases, ...res.releases];
      } else {
        combinedRes = res;
      }
    } catch (err) {
      if (err instanceof DatasourceError) {
        throw err;
      }
      // We'll always save the last-thrown error
      datasourceError = err;
      logger.trace({ err }, 'datasource merge failure');
    }
  }
  if (combinedRes === undefined && datasourceError) {
    // if we failed to get a result and also got an error then throw it
    throw datasourceError;
  }
  // De-duplicate releases
  if (combinedRes?.releases?.length) {
    const seenVersions = new Set<string>();
    combinedRes.releases = combinedRes.releases.filter((release) => {
      if (seenVersions.has(release.version)) {
        return false;
      }
      seenVersions.add(release.version);
      return true;
    });
  }
  return combinedRes;
}

function resolveRegistryUrls(
  datasource: Datasource,
  extractedUrls: string[]
): string[] {
  const { defaultRegistryUrls = [], appendRegistryUrls = [] } = datasource;
  const customUrls = extractedUrls?.filter(Boolean);
  let registryUrls: string[];
  if (is.nonEmptyArray(customUrls)) {
    registryUrls = [...extractedUrls, ...appendRegistryUrls];
  } else {
    registryUrls = [...defaultRegistryUrls, ...appendRegistryUrls];
  }
  return registryUrls.filter(Boolean);
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
  let dep: ReleaseResult;
  if (datasource.registryStrategy) {
    // istanbul ignore if
    if (!registryUrls.length) {
      logger.warn(
        { datasource: datasourceName, depName: config.depName },
        'Missing registryUrls for registryStrategy'
      );
      return null;
    }
    if (datasource.registryStrategy === 'first') {
      dep = await firstRegistry(config, datasource, registryUrls);
    } else if (datasource.registryStrategy === 'hunt') {
      dep = await huntRegistries(config, datasource, registryUrls);
    } else if (datasource.registryStrategy === 'merge') {
      dep = await mergeRegistries(config, datasource, registryUrls);
    }
  } else {
    dep = await datasource.getReleases({
      ...config,
      registryUrls,
    });
  }
  if (!dep || _.isEqual(dep, { releases: [] })) {
    return null;
  }
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
  const datasource = await load(config.datasource);
  const lookupName = config.lookupName || config.depName;
  const registryUrls = resolveRegistryUrls(datasource, config.registryUrls);
  return datasource.getDigest(
    { lookupName, registryUrl: registryUrls[0] },
    value
  );
}

export async function getDefaultConfig(datasource: string): Promise<object> {
  const loadedDatasource = await load(datasource);
  return loadedDatasource?.defaultConfig || {};
}
