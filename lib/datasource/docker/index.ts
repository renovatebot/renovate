import URL from 'url';
import { ECR } from '@aws-sdk/client-ecr';
import type { ECRClientConfig } from '@aws-sdk/client-ecr';
import is from '@sindresorhus/is';
import { parse } from 'auth-header';
import hasha from 'hasha';
import { HOST_DISABLED } from '../../constants/error-messages';
import { logger } from '../../logger';
import type { HostRule } from '../../types';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../../util/cache/package';
import * as hostRules from '../../util/host-rules';
import { Http, HttpOptions, HttpResponse } from '../../util/http';
import { HttpError } from '../../util/http/types';
import type { OutgoingHttpHeaders } from '../../util/http/types';
import { hasKey } from '../../util/object';
import { regEx } from '../../util/regex';
import {
  ensurePathPrefix,
  ensureTrailingSlash,
  parseLinkHeader,
  parseUrl,
  trimTrailingSlash,
} from '../../util/url';
import {
  api as dockerVersioning,
  id as dockerVersioningId,
} from '../../versioning/docker';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { sourceLabels } from './common';
import { Image, ImageList, MediaType, RegistryRepository } from './types';

export const ecrRegex = regEx(/\d+\.dkr\.ecr\.([-a-z0-9]+)\.amazonaws\.com/);

export const id = 'docker';
export const http = new Http(id);

const DOCKER_HUB = 'https://index.docker.io';
export const defaultRegistryUrls = [DOCKER_HUB];

// TODO: add got typings when available (#9646)

export const customRegistrySupport = true;
export const defaultVersioning = dockerVersioningId;
export const registryStrategy = 'first';

function isDockerHost(host: string): boolean {
  const regex = regEx(/(?:^|\.)docker\.io$/);
  return regex.test(host);
}

async function getECRAuthToken(
  region: string,
  opts: HostRule
): Promise<string | null> {
  const config: ECRClientConfig = { region };
  if (opts.username && opts.password) {
    config.credentials = {
      accessKeyId: opts.username,
      secretAccessKey: opts.password,
      ...(opts.token && { sessionToken: opts.token }),
    };
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

export async function getAuthHeaders(
  registryHost: string,
  dockerRepository: string
): Promise<OutgoingHttpHeaders | null> {
  try {
    const apiCheckUrl = `${registryHost}/v2/`;
    const apiCheckResponse = await http.get(apiCheckUrl, {
      throwHttpErrors: false,
      noAuth: true,
    });

    if (apiCheckResponse.statusCode === 200) {
      logger.debug({ registryHost }, 'No registry auth required');
      return {};
    }
    if (
      apiCheckResponse.statusCode !== 401 ||
      !is.nonEmptyString(apiCheckResponse.headers['www-authenticate'])
    ) {
      logger.warn(
        { registryHost, res: apiCheckResponse },
        'Invalid registry response'
      );
      return null;
    }

    const authenticateHeader = parse(
      apiCheckResponse.headers['www-authenticate']
    );

    const opts: HostRule & HttpOptions = hostRules.find({
      hostType: id,
      url: apiCheckUrl,
    });
    if (ecrRegex.test(registryHost)) {
      logger.trace(
        { registryHost, dockerRepository },
        `Using ecr auth for Docker registry`
      );
      const [, region] = ecrRegex.exec(registryHost);
      const auth = await getECRAuthToken(region, opts);
      if (auth) {
        opts.headers = { authorization: `Basic ${auth}` };
      }
    } else if (opts.username && opts.password) {
      logger.trace(
        { registryHost, dockerRepository },
        `Using basic auth for Docker registry`
      );
      const auth = Buffer.from(`${opts.username}:${opts.password}`).toString(
        'base64'
      );
      opts.headers = { authorization: `Basic ${auth}` };
    } else if (opts.token) {
      const authType = opts.authType ?? 'Bearer';
      logger.trace(
        { registryHost, dockerRepository },
        `Using ${authType} token for Docker registry`
      );
      opts.headers = { authorization: `${authType} ${opts.token}` };
    }
    delete opts.username;
    delete opts.password;
    delete opts.token;

    // If realm isn't an url, we should directly use auth header
    // Can happen when we get a Basic auth or some other auth type
    // * WWW-Authenticate: Basic realm="Artifactory Realm"
    // * Www-Authenticate: Basic realm="https://123456789.dkr.ecr.eu-central-1.amazonaws.com/",service="ecr.amazonaws.com"
    // * www-authenticate: Bearer realm="https://ghcr.io/token",service="ghcr.io",scope="repository:user/image:pull"
    // * www-authenticate: Bearer realm="https://auth.docker.io/token",service="registry.docker.io"
    if (
      authenticateHeader.scheme.toUpperCase() !== 'BEARER' ||
      !is.string(authenticateHeader.params.realm) ||
      !is.string(authenticateHeader.params.service) ||
      parseUrl(authenticateHeader.params.realm) === null
    ) {
      logger.trace(
        { registryHost, dockerRepository, authenticateHeader },
        `Invalid realm, testing direct auth`
      );
      return opts.headers;
    }

    const authUrl = `${authenticateHeader.params.realm}?service=${authenticateHeader.params.service}&scope=repository:${dockerRepository}:pull`;
    logger.trace(
      { registryHost, dockerRepository, authUrl },
      `Obtaining docker registry token`
    );
    opts.noAuth = true;
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
      // TODO: debug why quay throws errors (#9604)
      return null;
    }
    if (err.statusCode === 401) {
      logger.debug(
        { registryHost, dockerRepository },
        'Unauthorized docker lookup'
      );
      logger.debug({ err });
      return null;
    }
    if (err.statusCode === 403) {
      logger.debug(
        { registryHost, dockerRepository },
        'Not allowed to access docker registry'
      );
      logger.debug({ err });
      return null;
    }
    if (err.name === 'RequestError' && isDockerHost(registryHost)) {
      throw new ExternalHostError(err);
    }
    if (err.statusCode === 429 && isDockerHost(registryHost)) {
      throw new ExternalHostError(err);
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      throw new ExternalHostError(err);
    }
    if (err.message === HOST_DISABLED) {
      logger.trace({ registryHost, dockerRepository, err }, 'Host disabled');
      return null;
    }
    logger.warn(
      { registryHost, dockerRepository, err },
      'Error obtaining docker token'
    );
    return null;
  }
}

export function getRegistryRepository(
  lookupName: string,
  registryUrl: string
): RegistryRepository {
  if (registryUrl !== DOCKER_HUB) {
    const registryEndingWithSlash = ensureTrailingSlash(
      registryUrl.replace(regEx(/^https?:\/\//), '')
    );
    if (lookupName.startsWith(registryEndingWithSlash)) {
      let registryHost = trimTrailingSlash(registryUrl);
      if (!regEx(/^https?:\/\//).test(registryHost)) {
        registryHost = `https://${registryHost}`;
      }
      let dockerRepository = lookupName.replace(registryEndingWithSlash, '');
      const fullUrl = `${registryHost}/${dockerRepository}`;
      const { origin, pathname } = parseUrl(fullUrl);
      registryHost = origin;
      dockerRepository = pathname.substring(1);
      return {
        registryHost,
        dockerRepository,
      };
    }
  }
  let registryHost: string;
  const split = lookupName.split('/');
  if (split.length > 1 && (split[0].includes('.') || split[0].includes(':'))) {
    [registryHost] = split;
    split.shift();
  }
  let dockerRepository = split.join('/');
  if (!registryHost) {
    registryHost = registryUrl.replace(
      'https://docker.io',
      'https://index.docker.io'
    );
  }
  if (registryHost === 'docker.io') {
    registryHost = 'index.docker.io';
  }
  if (!regEx(/^https?:\/\//).exec(registryHost)) {
    registryHost = `https://${registryHost}`;
  }
  const opts = hostRules.find({ hostType: id, url: registryHost });
  if (opts?.insecureRegistry) {
    registryHost = registryHost.replace('https', 'http');
  }
  if (registryHost.endsWith('.docker.io') && !dockerRepository.includes('/')) {
    dockerRepository = 'library/' + dockerRepository;
  }
  return {
    registryHost,
    dockerRepository,
  };
}

function digestFromManifestStr(str: hasha.HashaInput): string {
  return 'sha256:' + hasha(str, { algorithm: 'sha256' });
}

export function extractDigestFromResponseBody(
  manifestResponse: HttpResponse
): string {
  return digestFromManifestStr(manifestResponse.body);
}

// TODO: debug why quay throws errors (#9612)
export async function getManifestResponse(
  registryHost: string,
  dockerRepository: string,
  tag: string,
  mode: 'head' | 'get' = 'get'
): Promise<HttpResponse> {
  logger.debug(
    `getManifestResponse(${registryHost}, ${dockerRepository}, ${tag})`
  );
  try {
    const headers = await getAuthHeaders(registryHost, dockerRepository);
    if (!headers) {
      logger.debug('No docker auth found - returning');
      return null;
    }
    headers.accept =
      'application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json';
    const url = `${registryHost}/v2/${dockerRepository}/manifests/${tag}`;
    const manifestResponse = await http[mode](url, {
      headers,
      noAuth: true,
    });
    return manifestResponse;
  } catch (err) /* istanbul ignore next */ {
    if (err instanceof ExternalHostError) {
      throw err;
    }
    if (err.statusCode === 401) {
      logger.debug(
        { registryHost, dockerRepository },
        'Unauthorized docker lookup'
      );
      logger.debug({ err });
      return null;
    }
    if (err.statusCode === 404) {
      logger.debug(
        {
          err,
          registryHost,
          dockerRepository,
          tag,
        },
        'Docker Manifest is unknown'
      );
      return null;
    }
    if (err.statusCode === 429 && isDockerHost(registryHost)) {
      throw new ExternalHostError(err);
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      throw new ExternalHostError(err);
    }
    if (err.code === 'ETIMEDOUT') {
      logger.debug(
        { registryHost },
        'Timeout when attempting to connect to docker registry'
      );
      logger.debug({ err });
      return null;
    }
    logger.debug(
      {
        err,
        registryHost,
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

  if (
    manifest.mediaType === MediaType.manifestV2 &&
    is.string(manifest.config?.digest)
  ) {
    return manifest.config?.digest;
  }

  logger.debug({ manifest }, 'Invalid manifest - returning');
  return null;
}

/*
 * docker.getLabels
 *
 * This function will:
 *  - Return the labels for the requested image
 */

export async function getLabels(
  registryHost: string,
  dockerRepository: string,
  tag: string
): Promise<Record<string, string>> {
  logger.debug(`getLabels(${registryHost}, ${dockerRepository}, ${tag})`);
  const cacheNamespace = 'datasource-docker-labels';
  const cacheKey = `${registryHost}:${dockerRepository}:${tag}`;
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
    const configDigest = await getConfigDigest(
      registryHost,
      dockerRepository,
      tag
    );
    if (!configDigest) {
      return {};
    }

    const headers = await getAuthHeaders(registryHost, dockerRepository);
    // istanbul ignore if: Should never be happen
    if (!headers) {
      logger.debug('No docker auth found - returning');
      return {};
    }
    const url = `${registryHost}/v2/${dockerRepository}/blobs/${configDigest}`;
    const configResponse = await http.get(url, {
      headers,
      noAuth: true,
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
        { registryHost, dockerRepository, err },
        'Unauthorized docker lookup'
      );
    } else if (err.statusCode === 404) {
      logger.warn(
        {
          err,
          registryHost,
          dockerRepository,
          tag,
        },
        'Config Manifest is unknown'
      );
    } else if (err.statusCode === 429 && isDockerHost(registryHost)) {
      logger.warn({ err }, 'docker registry failure: too many requests');
    } else if (err.statusCode >= 500 && err.statusCode < 600) {
      logger.debug(
        {
          err,
          registryHost,
          dockerRepository,
          tag,
        },
        'docker registry failure: internal error'
      );
    } else if (
      err.code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
      err.code === 'ETIMEDOUT'
    ) {
      logger.debug(
        { registryHost, err },
        'Error connecting to docker registry'
      );
    } else if (registryHost === 'https://quay.io') {
      // istanbul ignore next
      logger.debug(
        'Ignoring quay.io errors until they fully support v2 schema'
      );
    } else {
      logger.info(
        { registryHost, dockerRepository, tag, err },
        'Unknown error getting Docker labels'
      );
    }
    return {};
  }
}

export function isECRMaxResultsError(err: HttpError): boolean {
  return !!(
    err.response?.statusCode === 405 &&
    err.response?.headers?.['docker-distribution-api-version'] &&
    // https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_DescribeRepositories.html#ECR-DescribeRepositories-request-maxResults
    err.response.body?.['errors']?.[0]?.message?.includes(
      'Member must have value less than or equal to 1000'
    )
  );
}

export async function getTagsQuayRegistry(
  registry: string,
  repository: string
): Promise<string[]> {
  let tags: string[] = [];
  const limit = 100;

  const pageUrl = (page: number): string =>
    `${registry}/api/v1/repository/${repository}/tag/?limit=${limit}&page=${page}&onlyActiveTags=true`;

  let page = 1;
  let url = pageUrl(page);
  do {
    const res = await http.getJson<{
      tags: { name: string }[];
      has_additional: boolean;
    }>(url, {});
    const pageTags = res.body.tags.map((tag) => tag.name);
    tags = tags.concat(pageTags);
    page += 1;
    url = res.body.has_additional ? pageUrl(page) : null;
  } while (url && page < 20);
  return tags;
}

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
  let url = `${registryHost}/${dockerRepository}/tags/list?n=${limit}`;
  url = ensurePathPrefix(url, '/v2');
  const headers = await getAuthHeaders(registryHost, dockerRepository);
  if (!headers) {
    logger.debug('Failed to get authHeaders for getTags lookup');
    return null;
  }
  let page = 1;
  let foundMaxResultsError = false;
  do {
    let res: HttpResponse<{ tags: string[] }>;
    try {
      res = await http.getJson<{ tags: string[] }>(url, {
        headers,
        noAuth: true,
      });
    } catch (err) {
      if (
        !foundMaxResultsError &&
        err instanceof HttpError &&
        isECRMaxResultsError(err)
      ) {
        const maxResults = 1000;
        url = `${registryHost}/${dockerRepository}/tags/list?n=${maxResults}`;
        url = ensurePathPrefix(url, '/v2');
        foundMaxResultsError = true;
        continue;
      }
      throw err;
    }
    tags = tags.concat(res.body.tags);
    const linkHeader = parseLinkHeader(res.headers.link);
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

    const isQuay = regEx(/^https:\/\/quay\.io(?::[1-9][0-9]{0,4})?$/i).test(
      registryHost
    );
    let tags: string[] | null;
    if (isQuay) {
      tags = await getTagsQuayRegistry(registryHost, dockerRepository);
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
    if (err.statusCode === 404 && !dockerRepository.includes('/')) {
      logger.debug(
        `Retrying Tags for ${registryHost}/${dockerRepository} using library/ prefix`
      );
      return getTags(registryHost, 'library/' + dockerRepository);
    }
    // prettier-ignore
    if (err.statusCode === 429 && isDockerHost(registryHost)) {
      logger.warn(
        { registryHost, dockerRepository, err },
        'docker registry failure: too many requests'
      );
      throw new ExternalHostError(err);
    }
    // prettier-ignore
    if (err.statusCode === 401 && isDockerHost(registryHost)) {
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
    let manifestResponse = await getManifestResponse(
      registryHost,
      dockerRepository,
      newTag,
      'head'
    );
    if (manifestResponse) {
      if (hasKey('docker-content-digest', manifestResponse.headers)) {
        digest =
          (manifestResponse.headers['docker-content-digest'] as string) || null;
      } else {
        logger.debug(
          { registryHost },
          'Missing docker content digest header, pulling full manifest'
        );
        manifestResponse = await getManifestResponse(
          registryHost,
          dockerRepository,
          newTag
        );
        digest = extractDigestFromResponseBody(manifestResponse);
      }
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
    registryUrl: registryHost,
    releases,
  };

  const latestTag = tags.includes('latest') ? 'latest' : findLatestStable(tags);
  const labels = await getLabels(registryHost, dockerRepository, latestTag);
  if (labels) {
    for (const label of sourceLabels) {
      if (is.nonEmptyString(labels[label])) {
        ret.sourceUrl = labels[label];
        break;
      }
    }
  }
  return ret;
}
