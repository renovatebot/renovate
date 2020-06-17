import { OutgoingHttpHeaders } from 'http';
import URL from 'url';
import is from '@sindresorhus/is';
import AWS from 'aws-sdk';
import hasha from 'hasha';
import parseLinkHeader from 'parse-link-header';
import wwwAuthenticate from 'www-authenticate';
import { logger } from '../../logger';
import { HostRule } from '../../types';
import * as globalCache from '../../util/cache/global';
import * as hostRules from '../../util/host-rules';
import { Http, HttpResponse } from '../../util/http';
import { DatasourceError, GetReleasesConfig, ReleaseResult } from '../common';

// TODO: add got typings when available
// TODO: replace www-authenticate with https://www.npmjs.com/package/auth-header ?

export const id = 'docker';

export const defaultConfig = {
  managerBranchPrefix: 'docker-',
  commitMessageTopic: '{{{depName}}} Docker tag',
  major: { enabled: false },
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

const http = new Http(id);

const ecrRegex = /\d+\.dkr\.ecr\.([-a-z0-9]+)\.amazonaws\.com/;

export interface RegistryRepository {
  registry: string;
  repository: string;
}

export function getRegistryRepository(
  lookupName: string,
  registryUrls: string[]
): RegistryRepository {
  if (is.nonEmptyArray(registryUrls)) {
    const dockerRegistry = registryUrls[0]
      .replace('https://', '')
      .replace(/\/?$/, '/');
    if (lookupName.startsWith(dockerRegistry)) {
      return {
        registry: dockerRegistry,
        repository: lookupName.replace(dockerRegistry, ''),
      };
    }
  }
  let registry: string;
  const split = lookupName.split('/');
  if (split.length > 1 && (split[0].includes('.') || split[0].includes(':'))) {
    [registry] = split;
    split.shift();
  }
  let repository = split.join('/');
  if (!registry && is.nonEmptyArray(registryUrls)) {
    [registry] = registryUrls;
  }
  if (!registry || registry === 'docker.io') {
    registry = 'index.docker.io';
  }
  if (!/^https?:\/\//.exec(registry)) {
    registry = `https://${registry}`;
  }
  const opts = hostRules.find({ hostType: id, url: registry });
  if (opts && opts.insecureRegistry) {
    registry = registry.replace('https', 'http');
  }
  if (registry.endsWith('.docker.io') && !repository.includes('/')) {
    repository = 'library/' + repository;
  }
  return {
    registry,
    repository,
  };
}

function getECRAuthToken(
  region: string,
  opts: HostRule
): Promise<string | null> {
  const config = { region, accessKeyId: undefined, secretAccessKey: undefined };
  if (opts.username && opts.password) {
    config.accessKeyId = opts.username;
    config.secretAccessKey = opts.password;
  }
  const ecr = new AWS.ECR(config);
  return new Promise<string>((resolve) => {
    ecr.getAuthorizationToken({}, (err, data) => {
      if (err) {
        logger.trace({ err }, 'err');
        logger.debug('ECR getAuthorizationToken error');
        resolve(null);
      } else {
        const authorizationToken =
          data &&
          data.authorizationData &&
          data.authorizationData[0] &&
          data.authorizationData[0].authorizationToken;
        if (authorizationToken) {
          resolve(authorizationToken);
        } else {
          logger.warn(
            'Could not extract authorizationToken from ECR getAuthorizationToken response'
          );
          resolve(null);
        }
      }
    });
  });
}

async function getAuthHeaders(
  registry: string,
  repository: string
): Promise<OutgoingHttpHeaders | null> {
  try {
    const apiCheckUrl = `${registry}/v2/`;
    const apiCheckResponse = await http.get(apiCheckUrl, {
      throwHttpErrors: false,
    });
    if (apiCheckResponse.headers['www-authenticate'] === undefined) {
      return {};
    }
    const authenticateHeader = new wwwAuthenticate.parsers.WWW_Authenticate(
      apiCheckResponse.headers['www-authenticate']
    );

    const opts: HostRule & {
      headers?: Record<string, string>;
    } = hostRules.find({ hostType: id, url: apiCheckUrl });
    opts.json = true;
    if (ecrRegex.test(registry)) {
      const [, region] = ecrRegex.exec(registry);
      const auth = await getECRAuthToken(region, opts);
      if (auth) {
        opts.headers = { authorization: `Basic ${auth}` };
      }
    } else if (opts.username && opts.password) {
      const auth = Buffer.from(`${opts.username}:${opts.password}`).toString(
        'base64'
      );
      opts.headers = { authorization: `Basic ${auth}` };
    }
    delete opts.username;
    delete opts.password;

    if (authenticateHeader.scheme.toUpperCase() === 'BASIC') {
      logger.debug(`Using Basic auth for docker registry ${repository}`);
      await http.get(apiCheckUrl, opts);
      return opts.headers;
    }

    // prettier-ignore
    const authUrl = `${authenticateHeader.parms.realm}?service=${authenticateHeader.parms.service}&scope=repository:${repository}:pull`;
    logger.trace(
      `Obtaining docker registry token for ${repository} using url ${authUrl}`
    );
    const authResponse = (
      await http.getJson<{ token?: string; access_token?: string }>(
        authUrl,
        opts
      )
    ).body;

    const token = authResponse.token || authResponse.access_token;
    // istanbul ignore if
    if (!token) {
      logger.warn('Failed to obtain docker registry token');
      return null;
    }
    return {
      authorization: `Bearer ${token}`,
    };
  } catch (err) /* istanbul ignore next */ {
    if (err.host === 'quay.io') {
      // TODO: debug why quay throws errors
      return null;
    }
    if (err.statusCode === 401) {
      logger.debug(
        { registry, dockerRepository: repository },
        'Unauthorized docker lookup'
      );
      logger.debug({ err });
      return null;
    }
    if (err.statusCode === 403) {
      logger.debug(
        { registry, dockerRepository: repository },
        'Not allowed to access docker registry'
      );
      logger.debug({ err });
      return null;
    }
    // prettier-ignore
    if (err.name === 'RequestError' && registry.endsWith('docker.io')) { // lgtm [js/incomplete-url-substring-sanitization]
      throw new DatasourceError(err);
    }
    // prettier-ignore
    if (err.statusCode === 429 && registry.endsWith('docker.io')) { // lgtm [js/incomplete-url-substring-sanitization]
      throw new DatasourceError(err);
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      throw new DatasourceError(err);
    }
    logger.warn(
      { registry, dockerRepository: repository, err },
      'Error obtaining docker token'
    );
    return null;
  }
}

function digestFromManifestStr(str: hasha.HashaInput): string {
  return 'sha256:' + hasha(str, { algorithm: 'sha256' });
}

function extractDigestFromResponse(manifestResponse: HttpResponse): string {
  if (manifestResponse.headers['docker-content-digest'] === undefined) {
    return digestFromManifestStr(manifestResponse.body);
  }
  return manifestResponse.headers['docker-content-digest'] as string;
}

async function getManifestResponse(
  registry: string,
  repository: string,
  tag: string
): Promise<HttpResponse> {
  logger.debug(`getManifestResponse(${registry}, ${repository}, ${tag})`);
  try {
    const headers = await getAuthHeaders(registry, repository);
    if (!headers) {
      logger.debug('No docker auth found - returning');
      return null;
    }
    headers.accept = 'application/vnd.docker.distribution.manifest.v2+json';
    const url = `${registry}/v2/${repository}/manifests/${tag}`;
    const manifestResponse = await http.get(url, {
      headers,
    });
    return manifestResponse;
  } catch (err) /* istanbul ignore next */ {
    if (err instanceof DatasourceError) {
      throw err;
    }
    if (err.statusCode === 401) {
      logger.debug(
        { registry, dockerRepository: repository },
        'Unauthorized docker lookup'
      );
      logger.debug({ err });
      return null;
    }
    if (err.statusCode === 404) {
      logger.debug(
        {
          err,
          registry,
          dockerRepository: repository,
          tag,
        },
        'Docker Manifest is unknown'
      );
      return null;
    }
    // prettier-ignore
    if (err.statusCode === 429 && registry.endsWith('docker.io')) { // lgtm [js/incomplete-url-substring-sanitization]
      throw new DatasourceError(err);
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      throw new DatasourceError(err);
    }
    if (err.code === 'ETIMEDOUT') {
      logger.debug(
        { registry },
        'Timeout when attempting to connect to docker registry'
      );
      logger.debug({ err });
      return null;
    }
    logger.debug(
      {
        err,
        registry,
        dockerRepository: repository,
        tag,
      },
      'Unknown Error looking up docker manifest'
    );
    return null;
  }
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
  { registryUrls, lookupName }: GetReleasesConfig,
  newValue?: string
): Promise<string | null> {
  const { registry, repository } = getRegistryRepository(
    lookupName,
    registryUrls
  );
  logger.debug(`getDigest(${registry}, ${repository}, ${newValue})`);
  const newTag = newValue || 'latest';
  try {
    const cacheNamespace = 'datasource-docker-digest';
    const cacheKey = `${registry}:${repository}:${newTag}`;
    const cachedResult = await globalCache.get(cacheNamespace, cacheKey);
    // istanbul ignore if
    if (cachedResult) {
      return cachedResult;
    }
    const manifestResponse = await getManifestResponse(
      registry,
      repository,
      newTag
    );
    if (!manifestResponse) {
      return null;
    }
    const digest = extractDigestFromResponse(manifestResponse);
    logger.debug({ digest }, 'Got docker digest');
    const cacheMinutes = 30;
    await globalCache.set(cacheNamespace, cacheKey, digest, cacheMinutes);
    return digest;
  } catch (err) /* istanbul ignore next */ {
    if (err instanceof DatasourceError) {
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
    return null;
  }
}

async function getTags(
  registry: string,
  repository: string
): Promise<string[] | null> {
  let tags: string[] = [];
  try {
    const cacheNamespace = 'datasource-docker-tags';
    const cacheKey = `${registry}:${repository}`;
    const cachedResult = await globalCache.get<string[]>(
      cacheNamespace,
      cacheKey
    );
    // istanbul ignore if
    if (cachedResult) {
      return cachedResult;
    }
    // AWS ECR limits the maximum number of results to 1000
    // See https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_DescribeRepositories.html#ECR-DescribeRepositories-request-maxResults
    const limit = ecrRegex.test(registry) ? 1000 : 10000;
    let url = `${registry}/v2/${repository}/tags/list?n=${limit}`;
    const headers = await getAuthHeaders(registry, repository);
    if (!headers) {
      logger.debug('Failed to get authHeaders for getTags lookup');
      return null;
    }
    let page = 1;
    do {
      const res = await http.getJson<{ tags: string[] }>(url, { headers });
      tags = tags.concat(res.body.tags);
      const linkHeader = parseLinkHeader(res.headers.link as string);
      url =
        linkHeader && linkHeader.next
          ? URL.resolve(url, linkHeader.next.url)
          : null;
      page += 1;
    } while (url && page < 20);
    const cacheMinutes = 15;
    await globalCache.set(cacheNamespace, cacheKey, tags, cacheMinutes);
    return tags;
  } catch (err) /* istanbul ignore next */ {
    if (err instanceof DatasourceError) {
      throw err;
    }
    logger.debug(
      {
        err,
      },
      'docker.getTags() error'
    );
    if (err.statusCode === 404 && !repository.includes('/')) {
      logger.debug(
        `Retrying Tags for ${registry}/${repository} using library/ prefix`
      );
      return getTags(registry, 'library/' + repository);
    }
    if (err.statusCode === 401 || err.statusCode === 403) {
      logger.debug(
        { registry, dockerRepository: repository, err },
        'Not authorised to look up docker tags'
      );
      return null;
    }
    // prettier-ignore
    if (err.statusCode === 429 && registry.endsWith('docker.io')) { // lgtm [js/incomplete-url-substring-sanitization]
      logger.warn(
        { registry, dockerRepository: repository, err },
        'docker registry failure: too many requests'
      );
      throw new DatasourceError(err);
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      logger.warn(
        { registry, dockerRepository: repository, err },
        'docker registry failure: internal error'
      );
      throw new DatasourceError(err);
    }
    if (err.code === 'ETIMEDOUT') {
      logger.debug(
        { registry },
        'Timeout when attempting to connect to docker registry'
      );
      return null;
    }
    logger.warn(
      { registry, dockerRepository: repository, err },
      'Error getting docker image tags'
    );
    return null;
  }
}

/*
 * docker.getLabels
 *
 * This function will:
 *  - Return the labels for the requested image
 */

// istanbul ignore next
async function getLabels(
  registry: string,
  repository: string,
  tag: string
): Promise<Record<string, string>> {
  logger.debug(`getLabels(${registry}, ${repository}, ${tag})`);
  const cacheNamespace = 'datasource-docker-labels';
  const cacheKey = `${registry}:${repository}:${tag}`;
  const cachedResult = await globalCache.get<Record<string, string>>(
    cacheNamespace,
    cacheKey
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  try {
    const manifestResponse = await getManifestResponse(
      registry,
      repository,
      tag
    );
    // If getting the manifest fails here, then abort
    // This means that the latest tag doesn't have a manifest, which shouldn't
    // be possible
    if (!manifestResponse) {
      logger.debug(
        {
          registry,
          dockerRepository: repository,
          tag,
        },
        'docker registry failure: failed to get manifest for tag'
      );
      return {};
    }
    const manifest = JSON.parse(manifestResponse.body);
    // istanbul ignore if
    if (manifest.schemaVersion !== 2) {
      logger.debug(
        { registry, dockerRepository: repository, tag },
        'Manifest schema version is not 2'
      );
      return {};
    }
    let labels: Record<string, string> = {};
    const configDigest = manifest.config.digest;
    const headers = await getAuthHeaders(registry, repository);
    if (!headers) {
      logger.debug('No docker auth found - returning');
      return {};
    }
    const url = `${registry}/v2/${repository}/blobs/${configDigest}`;
    const configResponse = await http.get(url, {
      headers,
    });
    labels = JSON.parse(configResponse.body).config.Labels;

    if (labels) {
      logger.debug(
        {
          labels,
        },
        'found labels in manifest'
      );
    }
    const cacheMinutes = 60;
    await globalCache.set(cacheNamespace, cacheKey, labels, cacheMinutes);
    return labels;
  } catch (err) {
    if (err instanceof DatasourceError) {
      throw err;
    }
    if (err.statusCode === 400 || err.statusCode === 401) {
      logger.debug(
        { registry, dockerRepository: repository, err },
        'Unauthorized docker lookup'
      );
    } else if (err.statusCode === 404) {
      logger.warn(
        {
          err,
          registry,
          dockerRepository: repository,
          tag,
        },
        'Config Manifest is unknown'
      );
    } else if (
      err.statusCode === 429 &&
      registry.endsWith('docker.io') // lgtm [js/incomplete-url-substring-sanitization]
    ) {
      logger.warn({ err }, 'docker registry failure: too many requests');
    } else if (err.statusCode >= 500 && err.statusCode < 600) {
      logger.debug(
        {
          err,
          registry,
          dockerRepository: repository,
          tag,
        },
        'docker registry failure: internal error'
      );
    } else if (
      err.code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
      err.code === 'ETIMEDOUT'
    ) {
      logger.debug({ registry, err }, 'Error connecting to docker registry');
    } else if (registry === 'https://quay.io') {
      // istanbul ignore next
      logger.debug(
        'Ignoring quay.io errors until they fully support v2 schema'
      );
    } else {
      logger.info(
        { registry, dockerRepository: repository, tag, err },
        'Unknown error getting Docker labels'
      );
    }
    return {};
  }
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
  registryUrls,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const { registry, repository } = getRegistryRepository(
    lookupName,
    registryUrls
  );
  const tags = await getTags(registry, repository);
  if (!tags) {
    return null;
  }
  const releases = tags.map((version) => ({ version }));
  const ret: ReleaseResult = {
    dockerRegistry: registry,
    dockerRepository: repository,
    releases,
  };

  const latestTag = tags.includes('latest') ? 'latest' : tags[tags.length - 1];
  const labels = await getLabels(registry, repository, latestTag);
  // istanbul ignore if
  if (labels && 'org.opencontainers.image.source' in labels) {
    ret.sourceUrl = labels['org.opencontainers.image.source'];
  }
  return ret;
}
