import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../../util/cache/package';
import { Http } from '../../util/http';
import { GetReleasesConfig, Release, ReleaseResult } from '../common';
import { logger } from '../../logger';
import { ensureCacheDir } from '../../util/fs';
import Git, { SimpleGitTaskCallback } from 'simple-git';

export const id = 'crate';

export const registryStrategy = 'first';

const registryClonePaths: Record<string, string> = {};

const http = new Http(id);

const CRATES_IO_BASE_URL =
  'https://raw.githubusercontent.com/rust-lang/crates.io-index/master/';

export function getIndexSuffix(lookupName: string): string {
  const len = lookupName.length;

  if (len === 1) {
    return '1/' + lookupName;
  }
  if (len === 2) {
    return '2/' + lookupName;
  }
  if (len === 3) {
    return '3/' + lookupName[0] + '/' + lookupName;
  }

  return (
    lookupName.slice(0, 2) + '/' + lookupName.slice(2, 4) + '/' + lookupName
  );
}

interface CrateRecord {
  vers: string;
  yanked: boolean;
}

export async function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  console.log(
    `getReleases(lookupName = ${lookupName}, registryUrl = ${registryUrl})`
  );
  const cacheNamespace = 'datasource-crate';
  const cacheKey = registryUrl ? `${registryUrl}/${lookupName}` : lookupName;
  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    cacheKey
  );
  // istanbul ignore if
  if (cachedResult) {
    console.log(`returning cached result`);
    return cachedResult;
  }

  let registryInfo = await fetchRegistryInfo(registryUrl);
  console.log(`registryInfo: ${JSON.stringify(registryInfo, null, 2)}`);

  const crateUrl = CRATES_IO_BASE_URL + getIndexSuffix(lookupName);
  let dependencyUrl = `https://crates.io/crates/${lookupName}`;
  let parsedRegistryUrl: URL | undefined;
  try {
    parsedRegistryUrl = new URL(registryUrl);
  } catch (err) {
    logger.debug({ err }, 'failed to parse crate registry URL');
  }

  if (parsedRegistryUrl) {
    if (parsedRegistryUrl.hostname == 'dl.cloudsmith.io') {
      // input: https://dl.cloudsmith.io/basic/$org/$repo/cargo/index.git
      // output: https://cloudsmith.io/~$org/repos/$repo/packages/detail/cargo/$package/
      let tokens = parsedRegistryUrl.pathname.split('/');
      let org = tokens[2];
      let repo = tokens[3];
      dependencyUrl = `https://cloudsmith.io/~${org}/repos/${repo}/packages/detail/cargo/${lookupName}`;
    }
  }

  try {
    const lines = (await http.get(crateUrl)).body
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
    console.log(`Cloning repo... (to ${clonePath})`);
    {
      let git = Git();
      await git.clone(registryUrl, clonePath, {
        '--depth': 1,
      });
    }
    console.log(`Cloning repo... done!`);
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
