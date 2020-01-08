import is from '@sindresorhus/is';

import URL from 'url';
import delay from 'delay';
import pAll from 'p-all';
import { logger } from '../../logger';

import got, { GotJSONOptions } from '../../util/got';
import * as hostRules from '../../util/host-rules';
import { PkgReleaseConfig, ReleaseResult } from '../common';
import { DATASOURCE_FAILURE } from '../../constants/error-messages';

function getHostOpts(url: string): GotJSONOptions {
  const opts: GotJSONOptions = {
    json: true,
  };
  const { username, password } = hostRules.find({ hostType: 'packagist', url });
  if (username && password) {
    opts.auth = `${username}:${password}`;
  }
  return opts;
}

interface PackageMeta {
  includes?: Record<string, { sha256: string }>;
  packages: Record<string, RegistryFile>;
  'provider-includes': Record<string, { sha256: string }>;
  'providers-url'?: string;
}

interface RegistryFile {
  key: string;
  sha256: string;
}
interface RegistryMeta {
  files?: RegistryFile[];
  providersUrl?: string;
  includesFiles?: RegistryFile[];
  packages?: Record<string, RegistryFile>;
}

async function getRegistryMeta(regUrl: string): Promise<RegistryMeta | null> {
  try {
    const url = URL.resolve(regUrl.replace(/\/?$/, '/'), 'packages.json');
    const opts = getHostOpts(url);
    const res: PackageMeta = (await got(url, opts)).body;
    const meta: RegistryMeta = {};
    meta.packages = res.packages;
    if (res.includes) {
      meta.includesFiles = [];
      for (const [name, val] of Object.entries(res.includes)) {
        const file = {
          key: name.replace(val.sha256, '%hash%'),
          sha256: val.sha256,
        };
        meta.includesFiles.push(file);
      }
    }
    if (res['providers-url'] && res['provider-includes']) {
      meta.providersUrl = res['providers-url'];
      meta.files = [];
      for (const [key, val] of Object.entries(res['provider-includes'])) {
        const file = {
          key,
          sha256: val.sha256,
        };
        meta.files.push(file);
      }
    }
    return meta;
  } catch (err) {
    if (err.code === 'ETIMEDOUT') {
      logger.info({ regUrl }, 'Packagist timeout');
      return null;
    }
    if (err.statusCode === 401 || err.statusCode === 403) {
      logger.info({ regUrl }, 'Unauthorized Packagist repository');
      return null;
    }
    if (
      err.statusCode === 404 &&
      err.url &&
      err.url.endsWith('/packages.json')
    ) {
      logger.info({ regUrl }, 'Packagist repository not found');
      return null;
    }
    logger.warn({ err }, 'Packagist download error');
    return null;
  }
}

interface PackagistFile {
  providers: Record<string, RegistryFile>;
  packages?: Record<string, RegistryFile>;
}

async function getPackagistFile(
  regUrl: string,
  file: RegistryFile
): Promise<PackagistFile> {
  const { key, sha256 } = file;
  const fileName = key.replace('%hash%', sha256);
  const opts = getHostOpts(regUrl);
  if (opts.auth || (opts.headers && opts.headers.authorization)) {
    return (await got(regUrl + '/' + fileName, opts)).body;
  }
  const cacheNamespace = 'datasource-packagist-files';
  const cacheKey = regUrl + key;
  // Check the persistent cache for public registries
  const cachedResult = await renovateCache.get(cacheNamespace, cacheKey);
  // istanbul ignore if
  if (cachedResult && cachedResult.sha256 === sha256) {
    return cachedResult.res;
  }
  const res = (await got(regUrl + '/' + fileName, opts)).body;
  const cacheMinutes = 1440; // 1 day
  await renovateCache.set(
    cacheNamespace,
    cacheKey,
    { res, sha256 },
    cacheMinutes
  );
  return res;
}

function extractDepReleases(versions: RegistryFile): ReleaseResult {
  const dep: ReleaseResult = { releases: null };
  // istanbul ignore if
  if (!versions) {
    dep.releases = [];
    return dep;
  }
  dep.releases = Object.keys(versions).map(version => {
    const release = versions[version];
    dep.homepage = release.homepage || dep.homepage;
    if (release.source && release.source.url) {
      dep.sourceUrl = release.source.url;
    }
    return {
      version: version.replace(/^v/, ''),
      gitRef: version,
      releaseTimestamp: release.time,
    };
  });
  return dep;
}

interface AllPackages {
  packages: Record<string, RegistryFile>;
  providersUrl: string;
  providerPackages: Record<string, string>;

  includesPackages: Record<string, ReleaseResult>;
}

async function getAllPackages(regUrl: string): Promise<AllPackages | null> {
  let repoCacheResult = global.repoCache[`packagist-${regUrl}`];
  // istanbul ignore if
  if (repoCacheResult) {
    while (repoCacheResult === 'pending') {
      await delay(200);
      repoCacheResult = global.repoCache[`packagist-${regUrl}`];
    }
    return repoCacheResult;
  }
  global.repoCache[`packagist-${regUrl}`] = 'pending';
  const registryMeta = await getRegistryMeta(regUrl);
  if (!registryMeta) {
    global.repoCache[`packagist-${regUrl}`] = null;
    return null;
  }
  const { packages, providersUrl, files, includesFiles } = registryMeta;
  const providerPackages: Record<string, string> = {};
  if (files) {
    const queue = files.map(file => (): Promise<PackagistFile> =>
      getPackagistFile(regUrl, file)
    );
    const resolvedFiles = await pAll(queue, { concurrency: 5 });
    for (const res of resolvedFiles) {
      for (const [name, val] of Object.entries(res.providers)) {
        providerPackages[name] = val.sha256;
      }
    }
  }
  const includesPackages: Record<string, ReleaseResult> = {};
  if (includesFiles) {
    for (const file of includesFiles) {
      const res = await getPackagistFile(regUrl, file);
      if (res.packages) {
        for (const [key, val] of Object.entries(res.packages)) {
          const dep = extractDepReleases(val);
          dep.name = key;
          includesPackages[key] = dep;
        }
      }
    }
  }
  const allPackages: AllPackages = {
    packages,
    providersUrl,
    providerPackages,
    includesPackages,
  };
  global.repoCache[`packagist-${regUrl}`] = allPackages;
  return allPackages;
}

async function packagistOrgLookup(name: string): Promise<ReleaseResult> {
  const cacheNamespace = 'datasource-packagist-org';
  const cachedResult = await renovateCache.get<ReleaseResult>(
    cacheNamespace,
    name
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  let dep: ReleaseResult = null;
  const regUrl = 'https://packagist.org';
  const pkgUrl = URL.resolve(regUrl, `/p/${name}.json`);
  const res = (await got(pkgUrl, {
    json: true,
    retry: 5,
  })).body.packages[name];
  if (res) {
    dep = extractDepReleases(res);
    dep.name = name;
    logger.trace({ dep }, 'dep');
  }
  const cacheMinutes = 10;
  await renovateCache.set(cacheNamespace, name, dep, cacheMinutes);
  return dep;
}

async function packageLookup(
  regUrl: string,
  name: string
): Promise<ReleaseResult | null> {
  try {
    if (regUrl === 'https://packagist.org') {
      const packagistResult = await packagistOrgLookup(name);
      return packagistResult;
    }
    const allPackages = await getAllPackages(regUrl);
    if (!allPackages) {
      return null;
    }
    const {
      packages,
      providersUrl,
      providerPackages,
      includesPackages,
    } = allPackages;
    if (packages && packages[name]) {
      const dep = extractDepReleases(packages[name]);
      dep.name = name;
      return dep;
    }
    if (includesPackages && includesPackages[name]) {
      return includesPackages[name];
    }
    if (!(providerPackages && providerPackages[name])) {
      return null;
    }
    const pkgUrl = URL.resolve(
      regUrl,
      providersUrl
        .replace('%package%', name)
        .replace('%hash%', providerPackages[name])
    );
    const opts = getHostOpts(regUrl);
    const versions = (await got(pkgUrl, opts)).body.packages[name];
    const dep = extractDepReleases(versions);
    dep.name = name;
    logger.trace({ dep }, 'dep');
    return dep;
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.info({ dependency: name }, `Dependency lookup failure: not found`);
      logger.debug({
        err,
      });
      return null;
    }
    if (
      (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') &&
      err.host === 'packagist.org'
    ) {
      logger.info('Packagist.org timeout');
      throw new Error(DATASOURCE_FAILURE);
    }
    logger.warn({ err, name }, 'packagist registry failure: Unknown error');
    return null;
  }
}

export async function getPkgReleases({
  lookupName,
  registryUrls,
}: PkgReleaseConfig): Promise<ReleaseResult> {
  logger.trace(`getPkgReleases(${lookupName})`);

  let res: ReleaseResult;
  const registries = is.nonEmptyArray(registryUrls)
    ? registryUrls
    : ['https://packagist.org'];
  for (const regUrl of registries) {
    res = await packageLookup(regUrl, lookupName);
    if (res) {
      break;
    }
  }
  return res;
}
