import is from '@sindresorhus/is';
import { dequal } from 'dequal';
import { HOST_DISABLED } from '../constants/error-messages';
import { logger } from '../logger';
import { ExternalHostError } from '../types/errors/external-host-error';
import * as memCache from '../util/cache/memory';
import * as packageCache from '../util/cache/package';
import { clone } from '../util/clone';
import { regEx } from '../util/regex';
import * as allVersioning from '../versioning';
import datasources from './api';
import { addMetaData } from './metadata';
import type {
  DatasourceApi,
  DigestConfig,
  GetPkgReleasesConfig,
  GetReleasesConfig,
  Release,
  ReleaseResult,
} from './types';

export * from './types';
export { isGetPkgReleasesConfig } from './common';

export const getDatasources = (): Map<string, DatasourceApi> => datasources;
export const getDatasourceList = (): string[] => Array.from(datasources.keys());

const cacheNamespace = 'datasource-releases';

function load(datasource: string): DatasourceApi {
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
  datasource: DatasourceApi,
  config: GetReleasesConfig,
  registryUrl: string
): Promise<ReleaseResult> {
  const cacheKey = `${datasource.id} ${registryUrl} ${config.lookupName}`;
  if (datasource.caching) {
    const cachedResult = await packageCache.get<ReleaseResult>(
      cacheNamespace,
      cacheKey
    );
    // istanbul ignore if
    if (cachedResult) {
      logger.debug({ cacheKey }, 'Returning cached datasource response');
      return cachedResult;
    }
  }
  const res = await datasource.getReleases({ ...config, registryUrl });
  if (res?.releases.length) {
    res.registryUrl ??= registryUrl;
  }
  // cache non-null responses unless marked as private
  if (datasource.caching && res && !res.isPrivate) {
    logger.trace({ cacheKey }, 'Caching datasource response');
    const cacheMinutes = 15;
    await packageCache.set(cacheNamespace, cacheKey, res, cacheMinutes);
  }
  return res;
}

function firstRegistry(
  config: GetReleasesInternalConfig,
  datasource: DatasourceApi,
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
  datasource: DatasourceApi,
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
  datasource: DatasourceApi,
  registryUrls: string[]
): Promise<ReleaseResult> {
  let combinedRes: ReleaseResult;
  let caughtError;
  for (const registryUrl of registryUrls) {
    try {
      const res = await getRegistryReleases(datasource, config, registryUrl);
      if (res) {
        if (combinedRes) {
          for (const existingRelease of combinedRes.releases || []) {
            existingRelease.registryUrl = combinedRes.registryUrl;
          }
          for (const additionalRelease of res.releases || []) {
            additionalRelease.registryUrl = res.registryUrl;
          }
          combinedRes = { ...res, ...combinedRes };
          delete combinedRes.registryUrl;
          combinedRes.releases = [...combinedRes.releases, ...res.releases];
        } else {
          combinedRes = res;
        }
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
  datasource: DatasourceApi,
  extractedUrls: string[]
): string[] {
  const { defaultRegistryUrls = [] } = datasource;
  if (!datasource.customRegistrySupport) {
    if (is.nonEmptyArray(extractedUrls)) {
      logger.warn(
        { datasource: datasource.id, registryUrls: extractedUrls },
        'Custom datasources are not allowed for this datasource and will be ignored'
      );
    }
    return defaultRegistryUrls;
  }
  const customUrls = extractedUrls?.filter(Boolean);
  let registryUrls: string[];
  if (is.nonEmptyArray(customUrls)) {
    registryUrls = [...customUrls];
  } else {
    registryUrls = [...defaultRegistryUrls];
  }
  return registryUrls.filter(Boolean);
}

export function getDefaultVersioning(datasourceName: string): string {
  const datasource = load(datasourceName);
  return datasource.defaultVersioning || 'semver';
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
  const registryStrategy = datasource.registryStrategy || 'hunt';
  try {
    if (is.nonEmptyArray(registryUrls)) {
      if (registryStrategy === 'first') {
        dep = await firstRegistry(config, datasource, registryUrls);
      } else if (registryStrategy === 'hunt') {
        dep = await huntRegistries(config, datasource, registryUrls);
      } else if (registryStrategy === 'merge') {
        dep = await mergeRegistries(config, datasource, registryUrls);
      }
    } else {
      dep = await datasource.getReleases(config);
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
  if (!dep || dequal(dep, { releases: [] })) {
    return null;
  }
  addMetaData(dep, datasourceName, config.lookupName);
  return dep;
}

function getRawReleases(
  config: GetReleasesInternalConfig
): Promise<ReleaseResult | null> {
  const { datasource, lookupName, registryUrls } = config;
  const cacheKey = `${cacheNamespace}${datasource}${lookupName}${String(
    registryUrls
  )}`;
  // By returning a Promise and reusing it, we should only fetch each package at most once
  const cachedResult = memCache.get<Promise<ReleaseResult | null>>(cacheKey);
  // istanbul ignore if
  if (cachedResult !== undefined) {
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
  if (config.extractVersion) {
    const extractVersionRegEx = regEx(config.extractVersion);
    res.releases = res.releases
      .map((release) => {
        const version = extractVersionRegEx.exec(release.version)?.groups
          ?.version;
        if (version) {
          return { ...release, version }; // overwrite version
        }
        return null; // filter out any we can't extract
      })
      .filter(Boolean);
  }
  // Use the datasource's default versioning if none is configured
  const versioning =
    config.versioning || getDefaultVersioning(config.datasource);
  const version = allVersioning.get(versioning);
  // Return a sorted list of valid Versions
  function sortReleases(release1: Release, release2: Release): number {
    return version.sortVersions(release1.version, release2.version);
  }
  if (res.releases) {
    res.releases = res.releases
      .filter((release) => version.isVersion(release.version))
      .sort(sortReleases);
  }
  // Filter versions for uniqueness
  res.releases = res.releases.filter(
    (filterRelease, filterIndex) =>
      res.releases.findIndex(
        (findRelease) => findRelease.version === filterRelease.version
      ) === filterIndex
  );
  // Filter releases for compatibility
  for (const [constraintName, constraintValue] of Object.entries(
    config.constraints || {}
  )) {
    // Currently we only support if the constraint is a plain version
    // TODO: Support range/range compatibility filtering #8476
    if (version.isVersion(constraintValue)) {
      res.releases = res.releases.filter((release) => {
        if (!is.nonEmptyArray(release.constraints?.[constraintName])) {
          // A release with no constraints is OK
          return true;
        }
        return release.constraints[constraintName].some(
          // If any of the release's constraints match, then it's OK
          (releaseConstraint) =>
            !releaseConstraint ||
            version.matches(constraintValue, releaseConstraint)
        );
      });
    }
  }
  // Strip constraints from releases result
  res.releases.forEach((release) => {
    delete release.constraints; // eslint-disable-line no-param-reassign
  });
  return res;
}

export function supportsDigests(config: DigestConfig): boolean {
  return 'getDigest' in load(config.datasource);
}

export function getDigest(
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

export function getDefaultConfig(
  datasource: string
): Promise<Record<string, unknown>> {
  const loadedDatasource = load(datasource);
  return Promise.resolve<Record<string, unknown>>(
    loadedDatasource?.defaultConfig || Object.create({})
  );
}
