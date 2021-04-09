import URL from 'url';

import pAll from 'p-all';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as memCache from '../../util/cache/memory';
import * as packageCache from '../../util/cache/package';
import * as hostRules from '../../util/host-rules';
import { Http, HttpOptions } from '../../util/http';
import * as composerVersioning from '../../versioning/composer';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export const id = 'packagist';
export const customRegistrySupport = true;
export const defaultRegistryUrls = ['https://packagist.org'];
export const defaultVersioning = composerVersioning.id;
export const registryStrategy = 'hunt';

const http = new Http(id);

// We calculate auth at this datasource layer so that we can know whether it's safe to cache or not
function getHostOpts(url: string): HttpOptions {
  let opts: HttpOptions = {};
  const { username, password } = hostRules.find({
    hostType: id,
    url,
  });
  if (username && password) {
    opts = { ...opts, username, password };
  }
  return opts;
}

interface PackageMeta {
  includes?: Record<string, { sha256: string }>;
  packages: Record<string, RegistryFile>;
  'provider-includes': Record<string, { sha256: string }>;
  providers: Record<string, { sha256: string }>;
  'providers-url'?: string;
}

interface RegistryFile {
  key: string;
  sha256: string;
}
interface RegistryMeta {
  files?: RegistryFile[];
  providerPackages: Record<string, string>;
  providersUrl?: string;
  providersLazyUrl?: string;
  includesFiles?: RegistryFile[];
  packages?: Record<string, RegistryFile>;
}

async function getRegistryMeta(regUrl: string): Promise<RegistryMeta | null> {
  const url = URL.resolve(regUrl.replace(/\/?$/, '/'), 'packages.json');
  const opts = getHostOpts(url);
  const res = (await http.getJson<PackageMeta>(url, opts)).body;
  const meta: RegistryMeta = {
    providerPackages: {},
  };
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
  if (res['providers-url']) {
    meta.providersUrl = res['providers-url'];
  }
  if (res['providers-lazy-url']) {
    meta.providersLazyUrl = res['providers-lazy-url'];
  }
  if (res['provider-includes']) {
    meta.files = [];
    for (const [key, val] of Object.entries(res['provider-includes'])) {
      const file = {
        key,
        sha256: val.sha256,
      };
      meta.files.push(file);
    }
  }
  if (res.providers) {
    for (const [key, val] of Object.entries(res.providers)) {
      meta.providerPackages[key] = val.sha256;
    }
  }
  return meta;
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
  if (opts.password || opts.headers?.authorization) {
    return (await http.getJson<PackagistFile>(regUrl + '/' + fileName, opts))
      .body;
  }
  const cacheNamespace = 'datasource-packagist-files';
  const cacheKey = regUrl + key;
  // Check the persistent cache for public registries
  const cachedResult = await packageCache.get(cacheNamespace, cacheKey);
  // istanbul ignore if
  if (cachedResult && cachedResult.sha256 === sha256) {
    return cachedResult.res as Promise<PackagistFile>;
  }
  const res = (await http.getJson<PackagistFile>(regUrl + '/' + fileName, opts))
    .body;
  const cacheMinutes = 1440; // 1 day
  await packageCache.set(
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
  dep.releases = Object.keys(versions).map((version) => {
    const release = versions[version];
    dep.homepage = release.homepage || dep.homepage;
    if (release.source?.url) {
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
  providersLazyUrl: string;
  providerPackages: Record<string, string>;

  includesPackages: Record<string, ReleaseResult>;
}

async function getAllPackages(regUrl: string): Promise<AllPackages | null> {
  const registryMeta = await getRegistryMeta(regUrl);
  const {
    packages,
    providersUrl,
    providersLazyUrl,
    files,
    includesFiles,
    providerPackages,
  } = registryMeta;
  if (files) {
    const queue = files.map((file) => (): Promise<PackagistFile> =>
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
          includesPackages[key] = dep;
        }
      }
    }
  }
  const allPackages: AllPackages = {
    packages,
    providersUrl,
    providersLazyUrl,
    providerPackages,
    includesPackages,
  };
  return allPackages;
}

function getAllCachedPackages(regUrl: string): Promise<AllPackages | null> {
  const cacheKey = `packagist-${regUrl}`;
  const cachedResult = memCache.get<Promise<AllPackages | null>>(cacheKey);
  // istanbul ignore if
  if (cachedResult !== undefined) {
    return cachedResult;
  }
  const promisedRes = getAllPackages(regUrl);
  memCache.set(cacheKey, promisedRes);
  return promisedRes;
}

async function packagistOrgLookup(name: string): Promise<ReleaseResult> {
  const cacheNamespace = 'datasource-packagist-org';
  const cachedResult = await packageCache.get<ReleaseResult>(
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
  // TODO: fix types
  const res = (await http.getJson<any>(pkgUrl)).body.packages[name];
  if (res) {
    dep = extractDepReleases(res);
    logger.trace({ dep }, 'dep');
  }
  const cacheMinutes = 10;
  await packageCache.set(cacheNamespace, name, dep, cacheMinutes);
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
    const allPackages = await getAllCachedPackages(regUrl);
    const {
      packages,
      providersUrl,
      providersLazyUrl,
      providerPackages,
      includesPackages,
    } = allPackages;
    if (packages?.[name]) {
      const dep = extractDepReleases(packages[name]);
      return dep;
    }
    if (includesPackages?.[name]) {
      return includesPackages[name];
    }
    let pkgUrl;
    if (providerPackages?.[name]) {
      pkgUrl = URL.resolve(
        regUrl,
        providersUrl
          .replace('%package%', name)
          .replace('%hash%', providerPackages[name])
      );
    } else if (providersLazyUrl) {
      pkgUrl = URL.resolve(regUrl, providersLazyUrl.replace('%package%', name));
    } else {
      return null;
    }
    const opts = getHostOpts(regUrl);
    // TODO: fix types
    const versions = (await http.getJson<any>(pkgUrl, opts)).body.packages[
      name
    ];
    const dep = extractDepReleases(versions);
    logger.trace({ dep }, 'dep');
    return dep;
  } catch (err) /* istanbul ignore next */ {
    if (err.host === 'packagist.org') {
      if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
        throw new ExternalHostError(err);
      }
      if (err.statusCode && err.statusCode >= 500 && err.statusCode < 600) {
        throw new ExternalHostError(err);
      }
    }
    throw err;
  }
}

export function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult> {
  logger.trace(`getReleases(${lookupName})`);
  return packageLookup(registryUrl, lookupName);
}
