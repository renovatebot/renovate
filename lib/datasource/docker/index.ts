import URL from 'url';
import parseLinkHeader from 'parse-link-header';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../../util/cache/package';
import {
  api as dockerVersioning,
  id as dockerVersioningId,
} from '../../versioning/docker';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import {
  defaultRegistryUrls,
  ecrRegex,
  extractDigestFromResponse,
  getAuthHeaders,
  getLabels,
  getManifestResponse,
  getRegistryRepository,
  http,
  id,
} from './common';
import { getTagsQuayRegistry } from './quay';

// TODO: add got typings when available (#9646)
// TODO: replace www-authenticate with https://www.npmjs.com/package/auth-header (#9645)

export { id };
export const customRegistrySupport = true;
export { defaultRegistryUrls };
export const defaultVersioning = dockerVersioningId;
export const registryStrategy = 'first';

export const defaultConfig = {
  commitMessageTopic: '{{{depName}}} Docker tag',
  commitMessageExtra:
    'to v{{#if isMajor}}{{{newMajor}}}{{else}}{{{newVersion}}}{{/if}}',
  digest: {
    branchTopic: '{{{depNameSanitized}}}-{{{currentValue}}}',
    commitMessageExtra: 'to {{newDigestShort}}',
    commitMessageTopic:
      '{{{depName}}}{{#if currentValue}}:{{{currentValue}}}{{/if}} Docker digest',
    group: {
      commitMessageTopic: '{{{groupName}}}',
      commitMessageExtra: '',
    },
  },
  pin: {
    commitMessageExtra: '',
    groupName: 'Docker digests',
    group: {
      commitMessageTopic: '{{{groupName}}}',
      branchTopic: 'digests-pin',
    },
  },
  group: {
    commitMessageTopic: '{{{groupName}}} Docker tags',
  },
};

async function getDockerApiTags(
  registryHost: string,
  dockerRepository: string
): Promise<string[] | null> {
  let tags: string[] = [];
  // AWS ECR limits the maximum number of results to 1000
  // See https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_DescribeRepositories.html#ECR-DescribeRepositories-request-maxResults
  const limit = ecrRegex.test(registryHost) ? 1000 : 10000;
  let url = `${registryHost}/v2/${dockerRepository}/tags/list?n=${limit}`;
  const headers = await getAuthHeaders(registryHost, dockerRepository);
  if (!headers) {
    logger.debug('Failed to get authHeaders for getTags lookup');
    return null;
  }
  let page = 1;
  do {
    const res = await http.getJson<{ tags: string[] }>(url, { headers });
    tags = tags.concat(res.body.tags);
    const linkHeader = parseLinkHeader(res.headers.link as string);
    url = linkHeader?.next ? URL.resolve(url, linkHeader.next.url) : null;
    page += 1;
  } while (url && page < 20);
  return tags;
}

async function getTags(
  registryHost: string,
  dockerRepository: string
): Promise<string[] | null> {
  try {
    const cacheNamespace = 'datasource-docker-tags';
    const cacheKey = `${registryHost}:${dockerRepository}`;
    const cachedResult = await packageCache.get<string[]>(
      cacheNamespace,
      cacheKey
    );
    // istanbul ignore if
    if (cachedResult !== undefined) {
      return cachedResult;
    }

    const isQuay = registryHost === 'https://quay.io';
    let tags: string[] | null;
    if (isQuay) {
      tags = await getTagsQuayRegistry(dockerRepository);
    } else {
      tags = await getDockerApiTags(registryHost, dockerRepository);
    }
    const cacheMinutes = 30;
    await packageCache.set(cacheNamespace, cacheKey, tags, cacheMinutes);
    return tags;
  } catch (err) /* istanbul ignore next */ {
    if (err instanceof ExternalHostError) {
      throw err;
    }
    if (err.statusCode === 404 && !registryHost.includes('/')) {
      logger.debug(
        `Retrying Tags for ${registryHost}/${dockerRepository} using library/ prefix`
      );
      return getTags(registryHost, 'library/' + dockerRepository);
    }
    // prettier-ignore
    if (err.statusCode === 429 && registryHost.endsWith('docker.io')) { // lgtm [js/incomplete-url-substring-sanitization]
      logger.warn(
        { registryHost, dockerRepository, err },
        'docker registry failure: too many requests'
      );
      throw new ExternalHostError(err);
    }
    // prettier-ignore
    if (err.statusCode === 401 && registryHost.endsWith('docker.io')) { // lgtm [js/incomplete-url-substring-sanitization]
      logger.warn(
        { registryHost, dockerRepository, err },
        'docker registry failure: unauthorized'
      );
      throw new ExternalHostError(err);
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      logger.warn(
        { registryHost, dockerRepository, err },
        'docker registry failure: internal error'
      );
      throw new ExternalHostError(err);
    }
    throw err;
  }
}

function findLatestStable(tags: string[]): string {
  const versions = tags
    .filter((v) => dockerVersioning.isValid(v) && dockerVersioning.isStable(v))
    .sort((a, b) => dockerVersioning.sortVersions(a, b));

  return versions.pop() ?? tags.slice(-1).pop();
}

/**
 * docker.getDigest
 *
 * The `newValue` supplied here should be a valid tag for the docker image.
 *
 * This function will:
 *  - Look up a sha256 digest for a tag on its registry
 *  - Return the digest as a string
 */
export async function getDigest(
  { registryUrl, lookupName }: GetReleasesConfig,
  newValue?: string
): Promise<string | null> {
  const { registryHost, dockerRepository } = getRegistryRepository(
    lookupName,
    registryUrl
  );
  logger.debug(`getDigest(${registryHost}, ${dockerRepository}, ${newValue})`);
  const newTag = newValue || 'latest';
  const cacheNamespace = 'datasource-docker-digest';
  const cacheKey = `${registryHost}:${dockerRepository}:${newTag}`;
  let digest: string = null;
  try {
    const cachedResult = await packageCache.get<string>(
      cacheNamespace,
      cacheKey
    );
    // istanbul ignore if
    if (cachedResult !== undefined) {
      return cachedResult;
    }
    const manifestResponse = await getManifestResponse(
      registryHost,
      dockerRepository,
      newTag
    );
    if (manifestResponse) {
      digest = extractDigestFromResponse(manifestResponse) || null;
      logger.debug({ digest }, 'Got docker digest');
    }
  } catch (err) /* istanbul ignore next */ {
    if (err instanceof ExternalHostError) {
      throw err;
    }
    logger.debug(
      {
        err,
        lookupName,
        newTag,
      },
      'Unknown Error looking up docker image digest'
    );
  }
  const cacheMinutes = 30;
  await packageCache.set(cacheNamespace, cacheKey, digest, cacheMinutes);
  return digest;
}

/**
 * docker.getReleases
 *
 * A docker image usually looks something like this: somehost.io/owner/repo:8.1.0-alpine
 * In the above:
 *  - 'somehost.io' is the registry
 *  - 'owner/repo' is the package name
 *  - '8.1.0-alpine' is the tag
 *
 * This function will filter only tags that contain a semver version
 */
export async function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const { registryHost, dockerRepository } = getRegistryRepository(
    lookupName,
    registryUrl
  );
  const tags = await getTags(registryHost, dockerRepository);
  if (!tags) {
    return null;
  }
  const releases = tags.map((version) => ({ version }));
  const ret: ReleaseResult = {
    releases,
  };

  const latestTag = tags.includes('latest') ? 'latest' : findLatestStable(tags);
  const labels = await getLabels(registryHost, dockerRepository, latestTag);
  if (labels && 'org.opencontainers.image.source' in labels) {
    ret.sourceUrl = labels['org.opencontainers.image.source'];
  }
  return ret;
}
