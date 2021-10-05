import { logger } from '../../logger';
import { Http } from '../../util/http';
import { ensureTrailingSlash } from '../../util/url';
import * as loose from '../../versioning/loose';
import type {
  DigestConfig,
  GetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types';

export const id = 'conan';
export const customRegistrySupport = true;
export const defaultRegistryUrls = ['https://conan.bintray.com/'];
export const defaultVersioning = loose.id;
export const registryStrategy = 'merge';
export const caching = false;

const http = new Http(id);

const searchAPIString = 'v2/conans/search?q=';

export type ConanJSON = {
  results?: Record<string, string>;
};

export async function lookupConanPackage(
  packageName: string,
  hostUrl: string
): Promise<ReleaseResult | null> {
  logger.trace({ packageName, hostUrl }, 'Looking up conan api dependency');
  try {
    const url = ensureTrailingSlash(hostUrl);
    const lookupUrl = `${url}${searchAPIString}${packageName}`;

    logger.trace({ lookupUrl }, 'conan api got lookup');
    const rep = await http.getJson<ConanJSON>(lookupUrl);
    const versions = rep?.body;
    if (!versions) {
      logger.trace({ packageName }, 'conan package not found');
      return null;
    }
    logger.trace({ lookupUrl }, 'Got conan api result');
    const dep: ReleaseResult = { releases: [] };

    for (const resultString of Object.values(versions.results)) {
      const fromMatches = resultString.matchAll(
        /^(?<name>[a-z\-_0-9]+)\/(?<version>[^@/\n]+)(?<userChannel>@\S+\/\S+)?/gim
      );
      for (const fromMatch of fromMatches) {
        if (fromMatch.groups.version && fromMatch.groups.userChannel) {
          logger.debug(
            `Found a conan package ${fromMatch.groups.name} ${fromMatch.groups.version} ${fromMatch.groups.userChannel}`
          );
          const version = fromMatch.groups.version;
          let newDigest = fromMatch.groups.userChannel;
          if (newDigest === '@_/_') {
            newDigest = ' ';
          }
          const result: Release = {
            version,
            newDigest,
          };
          dep.releases.push(result);
        }
      }
    }
    return dep;
  } catch (err) {
    if (err.statusCode !== 404) {
      throw err;
    }
  }
  return null;
}

export async function getDigest(
  { lookupName, currentDigest, registryUrl }: DigestConfig,
  newValue?: string
): Promise<string | null> {
  const newLookup = `${lookupName}/${newValue}`;

  const digests: string[] = [];
  const fullDep: ReleaseResult = await lookupConanPackage(
    newLookup,
    registryUrl
  );

  if (fullDep) {
    // extract digests
    for (const release of fullDep.releases) {
      digests.push(release.newDigest);
    }
  }

  if (digests.length === 0) {
    return null;
  }

  // favor existing digest
  if (digests.includes(currentDigest)) {
    return currentDigest;
  }

  return '';
}

export async function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const dependency: ReleaseResult = await lookupConanPackage(
    lookupName,
    registryUrl
  );
  return dependency;
}
