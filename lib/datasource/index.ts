import fs from 'fs';
import { logger } from '../logger';
import { addMetaData } from './metadata';
import * as versioning from '../versioning';

import {
  Datasource,
  DatasourceError,
  PkgReleaseConfig,
  Release,
  ReleaseResult,
  DigestConfig,
} from './common';
import { VERSION_SCHEME_SEMVER } from '../constants/version-schemes';

export * from './common';

const datasources: Record<string, Datasource> = {};

function isValidDatasourceModule(
  datasourceName: string,
  module: unknown
): module is Datasource {
  return !!module;
}

function loadDatasources(): void {
  const datasourceDirs = fs
    .readdirSync(__dirname, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .filter(name => !name.startsWith('__'))
    .sort();
  for (const datasourceName of datasourceDirs) {
    const module = require(`./${datasourceName}`); // eslint-disable-line
    if (isValidDatasourceModule(datasourceName, module)) {
      datasources[datasourceName] = module;
    } /* istanbul ignore next */ else {
      throw new Error(`Datasource module "${datasourceName}" is invalid.`);
    }
  }
}

loadDatasources();

const cacheNamespace = 'datasource-releases';

async function fetchReleases(
  config: PkgReleaseConfig
): Promise<ReleaseResult | null> {
  const { datasource } = config;
  if (!datasource) {
    logger.warn('No datasource found');
    return null;
  }
  if (!datasources[datasource]) {
    logger.warn('Unknown datasource: ' + datasource);
    return null;
  }
  const dep = await datasources[datasource].getPkgReleases(config);
  addMetaData(dep, datasource, config.lookupName);
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
  let res;
  try {
    res = await getRawReleases({
      ...config,
      lookupName,
    });
  } catch (e) /* istanbul ignore next */ {
    if (e instanceof DatasourceError) {
      logger.warn({ datasource, lookupName, err: e.err }, 'Datasource failure');
    }
    throw e;
  }
  if (!res) {
    return res;
  }
  const versionScheme =
    config && config.versionScheme
      ? config.versionScheme
      : VERSION_SCHEME_SEMVER;
  // Filter by version scheme
  const version = versioning.get(versionScheme);
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

export function supportsDigests(config: DigestConfig): boolean {
  return 'getDigest' in datasources[config.datasource];
}

export function getDigest(
  config: DigestConfig,
  value?: string
): Promise<string | null> {
  const lookupName = config.lookupName || config.depName;
  const { registryUrls } = config;
  return datasources[config.datasource].getDigest(
    { lookupName, registryUrls },
    value
  );
}
