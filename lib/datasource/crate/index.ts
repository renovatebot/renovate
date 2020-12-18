import { ExternalHostError } from '../../types/errors/external-host-error';
import * as fs from 'fs-extra';
import * as packageCache from '../../util/cache/package';
import { Http } from '../../util/http';
import { GetReleasesConfig, Release, ReleaseResult } from '../common';
import { ensureCacheDir } from '../../util/fs';
import Git from 'simple-git';
import { join } from 'path';
import { logger } from '../../logger';

export const id = 'crate';

export const registryStrategy = 'first';

const registryClonePaths: Record<string, string> = {};

const http = new Http(id);

const CRATES_IO_BASE_URL =
  'https://raw.githubusercontent.com/rust-lang/crates.io-index/master/';

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

export async function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const cacheNamespace = 'datasource-crate';
  const cacheKey = registryUrl ? `${registryUrl}/${lookupName}` : lookupName;
  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    cacheKey
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  let registryInfo = await fetchRegistryInfo(registryUrl);
  let dependencyUrl = getDependencyUrl(registryInfo, lookupName);

  let payload = await fetchCrateRecordsPayload(registryInfo, lookupName);
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
  const cacheMinutes = 10;
  await packageCache.set(cacheNamespace, cacheKey, result, cacheMinutes);
  return result;
}

enum RegistryFlavor {
  /// https://crates.io, supports rawgit access
  CratesIo,

  /// https://cloudsmith.io, needs git clone
  Cloudsmith,

  /// unknown, assuming private git repository
  Other,
}

interface RegistryInfo {
  flavor: RegistryFlavor;

  /// raw URL of the registry, as specified in cargo config
  rawUrl?: string;

  /// parsed URL of the registry
  url?: URL;

  /// path where the registry is cloned
  clonePath?: string;
}

async function fetchRegistryInfo(registryUrl?: string): Promise<RegistryInfo> {
  if (!registryUrl) {
    return defaultRegistry();
  }

  let url: URL;
  try {
    url = new URL(registryUrl);
  } catch (err) {
    console.debug({ registryUrl }, 'could not parse registry URL');
  }

  let flavor: RegistryFlavor;
  if (url.hostname === 'dl.cloudsmith.io') {
    flavor = RegistryFlavor.Cloudsmith;
  } else {
    flavor = RegistryFlavor.Other;
  }

  let clonePath = registryClonePaths[registryUrl];
  if (!clonePath) {
    clonePath = await ensureCacheDir(url.hostname);
    logger.info({ clonePath, registryUrl }, `Cloning private cargo registry`);
    {
      let git = Git();
      await git.clone(registryUrl, clonePath, {
        '--depth': 1,
      });
    }
    registryClonePaths[registryUrl] = clonePath;
  }

  return {
    flavor,
    rawUrl: registryUrl,
    url,
    clonePath,
  };
}

function defaultRegistry(): RegistryInfo {
  return {
    flavor: RegistryFlavor.CratesIo,
  };
}

/// Computes the dependency URL for a crate, given
/// registry informatoin
function getDependencyUrl(info: RegistryInfo, lookupName: string): string {
  switch (info.flavor) {
    case RegistryFlavor.CratesIo:
      return `https://crates.io/crates/${lookupName}`;
    case RegistryFlavor.Cloudsmith:
      // input: https://dl.cloudsmith.io/basic/$org/$repo/cargo/index.git
      let tokens = info.url.pathname.split('/');
      let org = tokens[2];
      let repo = tokens[3];
      return `https://cloudsmith.io/~${org}/repos/${repo}/packages/detail/cargo/${lookupName}`;
    default:
      return `${info.rawUrl}/${lookupName}`;
  }
}

async function fetchCrateRecordsPayload(
  info: RegistryInfo,
  lookupName: string
): Promise<string> {
  if (info.clonePath) {
    let path = join(info.clonePath, ...getIndexSuffix(lookupName));
    return await fs.readFile(path, { encoding: 'utf8' });
  } else {
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
    }
  }
}
