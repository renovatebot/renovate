import URL from 'url';
import { ECR } from '@aws-sdk/client-ecr';
import hasha from 'hasha';
import parseLinkHeader from 'parse-link-header';
import wwwAuthenticate from 'www-authenticate';
import { HOST_DISABLED } from '../../constants/error-messages';
import { logger } from '../../logger';
import { HostRule } from '../../types';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../../util/cache/package';
import * as hostRules from '../../util/host-rules';
import { Http, HttpResponse } from '../../util/http';
import type { OutgoingHttpHeaders } from '../../util/http/types';
import { ensureTrailingSlash, trimTrailingSlash } from '../../util/url';
import * as dockerVersioning from '../../versioning/docker';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { Image, ImageList, MediaType } from './types';

// TODO: add got typings when available
// TODO: replace www-authenticate with https://www.npmjs.com/package/auth-header ?

export const id = 'docker';
export const customRegistrySupport = true;
export const defaultRegistryUrls = ['https://index.docker.io'];
export const defaultVersioning = dockerVersioning.id;
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

const http = new Http(id);

const ecrRegex = /\d+\.dkr\.ecr\.([-a-z0-9]+)\.amazonaws\.com/;

export interface RegistryRepository {
  registry: string;
  repository: string;
}

export function getRegistryRepository(
  lookupName: string,
  registryUrl: string
): RegistryRepository {
  if (registryUrl !== defaultRegistryUrls[0]) {
    const registryEndingWithSlash = ensureTrailingSlash(
      registryUrl.replace(/^https?:\/\//, '')
    );
    if (lookupName.startsWith(registryEndingWithSlash)) {
      let registry = trimTrailingSlash(registryUrl);
      if (!/^https?:\/\//.test(registry)) {
        registry = `https://${registry}`;
      }
      return {
        registry,
        repository: lookupName.replace(registryEndingWithSlash, ''),
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
  if (!registry) {
    registry = registryUrl;
  }
  if (registry === 'docker.io') {
    registry = 'index.docker.io';
  }
  if (!/^https?:\/\//.exec(registry)) {
    registry = `https://${registry}`;
  }
  const opts = hostRules.find({ hostType: id, url: registry });
  if (opts?.insecureRegistry) {
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

async function getECRAuthToken(
  region: string,
  opts: HostRule
): Promise<string | null> {
  const config = { region, accessKeyId: undefined, secretAccessKey: undefined };
  if (opts.username && opts.password) {
    config.accessKeyId = opts.username;
    config.secretAccessKey = opts.password;
  }
  const ecr = new ECR(config);
  try {
    const data = await ecr.getAuthorizationToken({});
    const authorizationToken = data?.authorizationData?.[0]?.authorizationToken;
    if (authorizationToken) {
      return authorizationToken;
    }
    logger.warn(
      'Could not extract authorizationToken from ECR getAuthorizationToken response'
    );
  } catch (err) {
    logger.trace({ err }, 'err');
    logger.debug('ECR getAuthorizationToken error');
  }
  return null;
}

async function getAuthHeaders(
  registry: string,
  dockerRepository: string
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
      logger.debug(`Using Basic auth for docker registry ${dockerRepository}`);
      await http.get(apiCheckUrl, opts);
      return opts.headers;
    }

    // prettier-ignore
    const authUrl = `${String(authenticateHeader.parms.realm)}?service=${String(authenticateHeader.parms.service)}&scope=repository:${dockerRepository}:pull`;
    logger.trace(
      `Obtaining docker registry token for ${dockerRepository} using url ${authUrl}`
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
        { registry, dockerRepository },
        'Unauthorized docker lookup'
      );
      logger.debug({ err });
      return null;
    }
    if (err.statusCode === 403) {
      logger.debug(
        { registry, dockerRepository },
        'Not allowed to access docker registry'
      );
      logger.debug({ err });
      return null;
    }
    // prettier-ignore
    if (err.name === 'RequestError' && registry.endsWith('docker.io')) { // lgtm [js/incomplete-url-substring-sanitization]
      throw new ExternalHostError(err);
    }
    // prettier-ignore
    if (err.statusCode === 429 && registry.endsWith('docker.io')) { // lgtm [js/incomplete-url-substring-sanitization]
      throw new ExternalHostError(err);
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      throw new ExternalHostError(err);
    }
    if (err.message === HOST_DISABLED) {
      logger.trace({ registry, dockerRepository, err }, 'Host disabled');
      return null;
    }
    logger.warn(
      { registry, dockerRepository, err },
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

// TODO: make generic to return json object
async function getManifestResponse(
  registry: string,
  dockerRepository: string,
  tag: string
): Promise<HttpResponse> {
  logger.debug(`getManifestResponse(${registry}, ${dockerRepository}, ${tag})`);
  try {
    const headers = await getAuthHeaders(registry, dockerRepository);
    if (!headers) {
      logger.debug('No docker auth found - returning');
      return null;
    }
    headers.accept =
      'application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json';
    const url = `${registry}/v2/${dockerRepository}/manifests/${tag}`;
    const manifestResponse = await http.get(url, {
      headers,
    });
    return manifestResponse;
  } catch (err) /* istanbul ignore next */ {
    if (err instanceof ExternalHostError) {
      throw err;
    }
    if (err.statusCode === 401) {
      logger.debug(
        { registry, dockerRepository },
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
          dockerRepository,
          tag,
        },
        'Docker Manifest is unknown'
      );
      return null;
    }
    // prettier-ignore
    if (err.statusCode === 429 && registry.endsWith('docker.io')) { // lgtm [js/incomplete-url-substring-sanitization]
      throw new ExternalHostError(err);
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      throw new ExternalHostError(err);
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
        dockerRepository,
        tag,
      },
      'Unknown Error looking up docker manifest'
    );
    return null;
  }
}

async function getConfigDigest(
  registry: string,
  dockerRepository: string,
  tag: string
): Promise<string> {
  const manifestResponse = await getManifestResponse(
    registry,
    dockerRepository,
    tag
  );
  // If getting the manifest fails here, then abort
  // This means that the latest tag doesn't have a manifest, which shouldn't
  // be possible
  // istanbul ignore if
  if (!manifestResponse) {
    return null;
  }
  const manifest = JSON.parse(manifestResponse.body) as ImageList | Image;
  if (manifest.schemaVersion !== 2) {
    logger.debug(
      { registry, dockerRepository, tag },
      'Manifest schema version is not 2'
    );
    return null;
  }

  if (
    manifest.mediaType === MediaType.manifestListV2 &&
    manifest.manifests.length
  ) {
    logger.trace(
      { registry, dockerRepository, tag },
      'Found manifest list, using first image'
    );
    return getConfigDigest(
      registry,
      dockerRepository,
      manifest.manifests[0].digest
    );
  }

  if (manifest.mediaType === MediaType.manifestV2) {
    return manifest.config?.digest || null;
  }

  logger.debug({ manifest }, 'Invalid manifest - returning');
  return null;
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
  const { registry, repository } = getRegistryRepository(
    lookupName,
    registryUrl
  );
  logger.debug(`getDigest(${registry}, ${repository}, ${newValue})`);
  const newTag = newValue || 'latest';
  const cacheNamespace = 'datasource-docker-digest';
  const cacheKey = `${registry}:${repository}:${newTag}`;
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
      registry,
      repository,
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

async function getTags(
  registry: string,
  repository: string
): Promise<string[] | null> {
  let tags: string[] = [];
  try {
    const cacheNamespace = 'datasource-docker-tags';
    const cacheKey = `${registry}:${repository}`;
    const cachedResult = await packageCache.get<string[]>(
      cacheNamespace,
      cacheKey
    );
    // istanbul ignore if
    if (cachedResult !== undefined) {
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
      url = linkHeader?.next ? URL.resolve(url, linkHeader.next.url) : null;
      page += 1;
    } while (url && page < 20);
    const cacheMinutes = 30;
    await packageCache.set(cacheNamespace, cacheKey, tags, cacheMinutes);
    return tags;
  } catch (err) /* istanbul ignore next */ {
    if (err instanceof ExternalHostError) {
      throw err;
    }
    if (err.statusCode === 404 && !repository.includes('/')) {
      logger.debug(
        `Retrying Tags for ${registry}/${repository} using library/ prefix`
      );
      return getTags(registry, 'library/' + repository);
    }
    // prettier-ignore
    if (err.statusCode === 429 && registry.endsWith('docker.io')) { // lgtm [js/incomplete-url-substring-sanitization]
      logger.warn(
        { registry, dockerRepository: repository, err },
        'docker registry failure: too many requests'
      );
      throw new ExternalHostError(err);
    }
    // prettier-ignore
    if (err.statusCode === 401 && registry.endsWith('docker.io')) { // lgtm [js/incomplete-url-substring-sanitization]
      logger.warn(
        { registry, dockerRepository: repository, err },
        'docker registry failure: unauthorized'
      );
      throw new ExternalHostError(err);
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      logger.warn(
        { registry, dockerRepository: repository, err },
        'docker registry failure: internal error'
      );
      throw new ExternalHostError(err);
    }
    throw err;
  }
}

/*
 * docker.getLabels
 *
 * This function will:
 *  - Return the labels for the requested image
 */

async function getLabels(
  registry: string,
  dockerRepository: string,
  tag: string
): Promise<Record<string, string>> {
  logger.debug(`getLabels(${registry}, ${dockerRepository}, ${tag})`);
  const cacheNamespace = 'datasource-docker-labels';
  const cacheKey = `${registry}:${dockerRepository}:${tag}`;
  const cachedResult = await packageCache.get<Record<string, string>>(
    cacheNamespace,
    cacheKey
  );
  // istanbul ignore if
  if (cachedResult !== undefined) {
    return cachedResult;
  }
  try {
    let labels: Record<string, string> = {};
    const configDigest = await getConfigDigest(registry, dockerRepository, tag);
    if (!configDigest) {
      return {};
    }

    const headers = await getAuthHeaders(registry, dockerRepository);
    // istanbul ignore if: Should never be happen
    if (!headers) {
      logger.debug('No docker auth found - returning');
      return {};
    }
    const url = `${registry}/v2/${dockerRepository}/blobs/${configDigest}`;
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
    await packageCache.set(cacheNamespace, cacheKey, labels, cacheMinutes);
    return labels;
  } catch (err) /* istanbul ignore next: should be tested in future */ {
    if (err instanceof ExternalHostError) {
      throw err;
    }
    if (err.statusCode === 400 || err.statusCode === 401) {
      logger.debug(
        { registry, dockerRepository, err },
        'Unauthorized docker lookup'
      );
    } else if (err.statusCode === 404) {
      logger.warn(
        {
          err,
          registry,
          dockerRepository,
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
          dockerRepository,
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
        { registry, dockerRepository, tag, err },
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
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const { registry, repository } = getRegistryRepository(
    lookupName,
    registryUrl
  );
  const tags = await getTags(registry, repository);
  if (!tags) {
    return null;
  }
  const releases = tags.map((version) => ({ version }));
  const ret: ReleaseResult = {
    releases,
  };

  const latestTag = tags.includes('latest') ? 'latest' : tags[tags.length - 1];
  const labels = await getLabels(registry, repository, latestTag);
  if (labels && 'org.opencontainers.image.source' in labels) {
    ret.sourceUrl = labels['org.opencontainers.image.source'];
  }
  return ret;
}
