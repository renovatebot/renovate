import is from '@sindresorhus/is';
import equal from 'fast-deep-equal';
import { HOST_DISABLED } from '../constants/error-messages';
import { logger } from '../logger';
import { ExternalHostError } from '../types/errors/external-host-error';
import * as memCache from '../util/cache/memory';
import { clone } from '../util/clone';
import * as allVersioning from '../versioning';
import datasources from './api.generated';
import {
  Datasource,
  DigestConfig,
  GetPkgReleasesConfig,
  GetReleasesConfig,
  Release,
  ReleaseResult,
} from './common';
import { addMetaData } from './metadata';

export * from './common';

export const getDatasources = (): Map<string, Datasource> => datasources;
export const getDatasourceList = (): string[] => Array.from(datasources.keys());

const cacheNamespace = 'datasource-releases';

function load(datasource: string): Datasource {
  return datasources.get(datasource);
}

type GetReleasesInternalConfig = GetReleasesConfig & GetPkgReleasesConfig;

function logError(datasource, lookupName, err): void {
  const { statusCode, code: errCode, url } = err;
  if (statusCode === 404) {
    logger.debug({ datasource, lookupName, url }, 'Datasource 404');
  } else if (statusCode === 401 || statusCode === 403) {
    logger.debug({ datasource, lookupName, url }, 'Datasource unauthorized');
  } else if (errCode) {
    logger.debug(
      { datasource, lookupName, url, errCode },
      'Datasource connection error'
    );
  } else {
    logger.debug({ datasource, lookupName, err }, 'Datasource unknown error');
  }
}

async function getRegistryReleases(
  datasource,
  config: GetReleasesConfig,
  registryUrl: string
): Promise<ReleaseResult> {
  const res = await datasource.getReleases({ ...config, registryUrl });
  return res;
}

async function firstRegistry(
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
  return getRegistryReleases(datasource, config, registryUrl);
}

async function huntRegistries(
  config: GetReleasesInternalConfig,
  datasource: Datasource,
  registryUrls: string[]
): Promise<ReleaseResult> {
  let res: ReleaseResult;
  let caughtError;
  for (const registryUrl of registryUrls) {
    try {
      res = await getRegistryReleases(datasource, config, registryUrl);
      if (res) {
        break;
      }
    } catch (err) {
      if (err instanceof ExternalHostError) {
        throw err;
      }
      // We'll always save the last-thrown error
      caughtError = err;
      logger.trace({ err }, 'datasource hunt failure');
    }
  }
  if (res) {
    return res;
  }
  if (caughtError) {
    throw caughtError;
  }
  return null;
}

async function mergeRegistries(
  config: GetReleasesInternalConfig,
  datasource: Datasource,
  registryUrls: string[]
): Promise<ReleaseResult> {
  let combinedRes: ReleaseResult;
  let caughtError;
  for (const registryUrl of registryUrls) {
    try {
      const res = await getRegistryReleases(datasource, config, registryUrl);
      if (combinedRes) {
        combinedRes = { ...res, ...combinedRes };
        combinedRes.releases = [...combinedRes.releases, ...res.releases];
      } else {
        combinedRes = res;
      }
    } catch (err) {
      if (err instanceof ExternalHostError) {
        throw err;
      }
      // We'll always save the last-thrown error
      caughtError = err;
      logger.trace({ err }, 'datasource merge failure');
    }
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
  if (combinedRes) {
    return combinedRes;
  }
  if (caughtError) {
    throw caughtError;
  }
  return null;
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
  const datasource = load(datasourceName);
  const registryUrls = resolveRegistryUrls(datasource, config.registryUrls);
  let dep: ReleaseResult = null;
  try {
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
  } catch (err) {
    if (err.message === HOST_DISABLED || err.err?.message === HOST_DISABLED) {
      return null;
    }
    if (err instanceof ExternalHostError) {
      throw err;
    }
    logError(datasource.id, config.lookupName, err);
  }
  if (!dep || equal(dep, { releases: [] })) {
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
  const cachedResult = memCache.get(cacheKey);
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  const promisedRes = fetchReleases(config);
  memCache.set(cacheKey, promisedRes);
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
    if (e instanceof ExternalHostError) {
      e.hostType = config.datasource;
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

export function supportsDigests(config: DigestConfig): boolean {
  return 'getDigest' in load(config.datasource);
}

export async function getDigest(
  config: DigestConfig,
  value?: string
): Promise<string | null> {
  const datasource = load(config.datasource);
  const lookupName = config.lookupName || config.depName;
  const registryUrls = resolveRegistryUrls(datasource, config.registryUrls);
  return datasource.getDigest(
    { lookupName, registryUrl: registryUrls[0] },
    value
  );
}

export function getDefaultConfig(datasource: string): Promise<object> {
  const loadedDatasource = load(datasource);
  return Promise.resolve(loadedDatasource?.defaultConfig || {});
}
