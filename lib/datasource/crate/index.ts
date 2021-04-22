import hasha from 'hasha';
import Git from 'simple-git';
import { join } from 'upath';
import { getAdminConfig } from '../../config/admin';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as memCache from '../../util/cache/memory';
import * as packageCache from '../../util/cache/package';
import { privateCacheDir, readFile } from '../../util/fs';
import { Http } from '../../util/http';
import * as cargoVersioning from '../../versioning/cargo';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';

export const id = 'crate';
export const customRegistrySupport = true;
export const defaultRegistryUrls = ['https://crates.io'];
export const defaultVersioning = cargoVersioning.id;
export const registryStrategy = 'first';

const http = new Http(id);

const CRATES_IO_BASE_URL =
  'https://raw.githubusercontent.com/rust-lang/crates.io-index/master/';

export enum RegistryFlavor {
  /** https://crates.io, supports rawgit access */
  CratesIo,

  /** https://cloudsmith.io, needs git clone */
  Cloudsmith,

  /** unknown, assuming private git repository */
  Other,
}

export interface RegistryInfo {
  flavor: RegistryFlavor;

  /** raw URL of the registry, as specified in cargo config */
  rawUrl?: string;

  /** parsed URL of the registry */
  url?: URL;

  /** path where the registry is cloned */
  clonePath?: string;
}

export function getIndexSuffix(lookupName: string): string[] {
  const len = lookupName.length;

  if (len === 1) {
    return ['1', lookupName];
  }
  if (len === 2) {
    return ['2', lookupName];
  }
  if (len === 3) {
    return ['3', lookupName[0], lookupName];
  }

  return [lookupName.slice(0, 2), lookupName.slice(2, 4), lookupName];
}

interface CrateRecord {
  vers: string;
  yanked: boolean;
}

export async function fetchCrateRecordsPayload(
  info: RegistryInfo,
  lookupName: string
): Promise<string> {
  if (info.clonePath) {
    const path = join(info.clonePath, ...getIndexSuffix(lookupName));
    return readFile(path, 'utf8');
  }

  if (info.flavor === RegistryFlavor.CratesIo) {
    const crateUrl = CRATES_IO_BASE_URL + getIndexSuffix(lookupName).join('/');
    try {
      return (await http.get(crateUrl)).body;
    } catch (err) {
      if (
        err.statusCode === 429 ||
        (err.statusCode >= 500 && err.statusCode < 600)
      ) {
        throw new ExternalHostError(err);
      }

      throw err;
    }
  }

  throw new Error(`unsupported crate registry flavor: ${info.flavor}`);
}

/**
 * Computes the dependency URL for a crate, given
 * registry information
 */
function getDependencyUrl(info: RegistryInfo, lookupName: string): string {
  switch (info.flavor) {
    case RegistryFlavor.CratesIo:
      return `https://crates.io/crates/${lookupName}`;
    case RegistryFlavor.Cloudsmith: {
      // input: https://dl.cloudsmith.io/basic/$org/$repo/cargo/index.git
      const tokens = info.url.pathname.split('/');
      const org = tokens[2];
      const repo = tokens[3];
      return `https://cloudsmith.io/~${org}/repos/${repo}/packages/detail/cargo/${lookupName}`;
    }
    default:
      return `${info.rawUrl}/${lookupName}`;
  }
}

/**
 * Given a Git URL, computes a semi-human-readable name for a folder in which to
 * clone the repository.
 */
function cacheDirFromUrl(url: URL): string {
  const proto = url.protocol.replace(/:$/, '');
  const host = url.hostname;
  const hash = hasha(url.pathname, {
    algorithm: 'sha256',
  }).substr(0, 7);

  return `crate-registry-${proto}-${host}-${hash}`;
}

/**
 * Fetches information about a registry, by url.
 * If no url is given, assumes crates.io.
 * If an url is given, assumes it's a valid Git repository
 * url and clones it to cache.
 */
async function fetchRegistryInfo(
  config: GetReleasesConfig,
  registryUrl: string
): Promise<RegistryInfo | null> {
  let url: URL;
  try {
    url = new URL(registryUrl);
  } catch (err) {
    logger.debug({ registryUrl }, 'could not parse registry URL');
    return null;
  }

  let flavor: RegistryFlavor;
  if (url.hostname === 'crates.io') {
    flavor = RegistryFlavor.CratesIo;
  } else if (url.hostname === 'dl.cloudsmith.io') {
    flavor = RegistryFlavor.Cloudsmith;
  } else {
    flavor = RegistryFlavor.Other;
  }

  const registry: RegistryInfo = {
    flavor,
    rawUrl: registryUrl,
    url,
  };

  if (flavor !== RegistryFlavor.CratesIo) {
    if (!getAdminConfig().allowCustomCrateRegistries) {
      logger.warn(
        'crate datasource: allowCustomCrateRegistries=true is required for registries other than crates.io, bailing out'
      );
      return null;
    }

    const cacheKey = `crate-datasource/registry-clone-path/${registryUrl}`;
    const cacheKeyForError = `crate-datasource/registry-clone-path/${registryUrl}/error`;

    // We need to ensure we don't run `git clone` in parallel. Therefore we store
    // a promise of the running operation in the mem cache, which in the end resolves
    // to the file path of the cloned repository.

    const clonePathPromise: Promise<string> | null = memCache.get(cacheKey);
    let clonePath: string;

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (clonePathPromise) {
      clonePath = await clonePathPromise;
    } else {
      clonePath = join(privateCacheDir(), cacheDirFromUrl(url));
      logger.info({ clonePath, registryUrl }, `Cloning private cargo registry`);

      const git = Git();
      const clonePromise = git.clone(registryUrl, clonePath, {
        '--depth': 1,
      });

      memCache.set(
        cacheKey,
        clonePromise.then(() => clonePath).catch(() => null)
      );

      try {
        await clonePromise;
      } catch (err) {
        logger.warn(
          { err, lookupName: config.lookupName, registryUrl },
          'failed cloning git registry'
        );
        memCache.set(cacheKeyForError, err);

        return null;
      }
    }

    if (!clonePath) {
      const err = memCache.get(cacheKeyForError);
      logger.warn(
        { err, lookupName: config.lookupName, registryUrl },
        'Previous git clone failed, bailing out.'
      );

      return null;
    }

    registry.clonePath = clonePath;
  }

  return registry;
}

export function areReleasesCacheable(registryUrl: string): boolean {
  // We only cache public releases, we don't want to cache private
  // cloned data between runs.
  return registryUrl === 'https://crates.io';
}

export async function getReleases(
  config: GetReleasesConfig
): Promise<ReleaseResult | null> {
  const { lookupName, registryUrl } = config;

  // istanbul ignore if
  if (!registryUrl) {
    logger.warn(
      'crate datasource: No registryUrl specified, cannot perform getReleases'
    );
    return null;
  }

  const cacheable = areReleasesCacheable(registryUrl);
  const cacheNamespace = 'datasource-crate';
  const cacheKey = `${registryUrl}/${lookupName}`;

  if (cacheable) {
    const cachedResult = await packageCache.get<ReleaseResult>(
      cacheNamespace,
      cacheKey
    );
    // istanbul ignore if
    if (cachedResult) {
      logger.debug({ cacheKey }, 'Returning cached resource');
      return cachedResult;
    }
  }

  const registryInfo = await fetchRegistryInfo(config, registryUrl);
  if (!registryInfo) {
    logger.debug({ registryUrl }, 'Could not fetch registry info');
    return null;
  }

  const dependencyUrl = getDependencyUrl(registryInfo, lookupName);

  const payload = await fetchCrateRecordsPayload(registryInfo, lookupName);
  const lines = payload
    .split('\n') // break into lines
    .map((line) => line.trim()) // remove whitespace
    .filter((line) => line.length !== 0) // remove empty lines
    .map((line) => JSON.parse(line) as CrateRecord); // parse
  const result: ReleaseResult = {
    dependencyUrl,
    releases: [],
  };
  result.releases = lines
    .map((version) => {
      const release: Release = {
        version: version.vers,
      };
      if (version.yanked) {
        release.isDeprecated = true;
      }
      return release;
    })
    .filter((release) => release.version);
  if (!result.releases.length) {
    return null;
  }

  if (cacheable) {
    const cacheMinutes = 10;
    await packageCache.set(cacheNamespace, cacheKey, result, cacheMinutes);
  }

  return result;
}
