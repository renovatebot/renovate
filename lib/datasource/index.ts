import { logger } from '../logger';
import { addMetaData } from './metadata';
import * as versioning from '../versioning';

import * as cargo from './cargo';
import * as dart from './dart';
import * as docker from './docker';
import * as hex from './hex';
import * as github from './github';
import * as gitlab from './gitlab';
import * as gitTags from './git-tags';
import * as gitSubmodules from './git-submodules';
import * as go from './go';
import * as gradleVersion from './gradle-version';
import * as helm from './helm';
import * as maven from './maven';
import * as npm from './npm';
import * as nuget from './nuget';
import * as orb from './orb';
import * as packagist from './packagist';
import * as pypi from './pypi';
import * as rubygems from './rubygems';
import * as rubyVersion from './ruby-version';
import * as sbt from './sbt';
import * as terraform from './terraform';
import * as terraformProvider from './terraform-provider';
import {
  Datasource,
  PkgReleaseConfig,
  Release,
  ReleaseResult,
  DigestConfig,
} from './common';

export * from './common';

const datasources: Record<string, Datasource> = {
  cargo,
  dart,
  docker,
  helm,
  hex,
  github,
  gitlab,
  gitTags,
  gitSubmodules,
  go,
  gradleVersion,
  maven,
  npm,
  nuget,
  orb,
  packagist,
  pypi,
  rubygems,
  rubyVersion,
  sbt,
  terraform,
  terraformProvider,
};

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
  const res = await getRawReleases({
    ...config,
    lookupName: config.lookupName || config.depName,
  });
  if (!res) {
    return res;
  }
  const versionScheme =
    config && config.versionScheme ? config.versionScheme : 'semver';
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
  return !!datasources[config.datasource].getDigest;
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
