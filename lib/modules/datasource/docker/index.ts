import URL from 'url';
import { ECR } from '@aws-sdk/client-ecr';
import type { ECRClientConfig } from '@aws-sdk/client-ecr';
import is from '@sindresorhus/is';
import { parse } from 'auth-header';
import hasha from 'hasha';
import {
  HOST_DISABLED,
  PAGE_NOT_FOUND_ERROR,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
import type { HostRule } from '../../../types';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import * as hostRules from '../../../util/host-rules';
import { Http, HttpError } from '../../../util/http';
import type {
  HttpOptions,
  HttpResponse,
  OutgoingHttpHeaders,
} from '../../../util/http/types';
import { hasKey } from '../../../util/object';
import { regEx } from '../../../util/regex';
import {
  ensurePathPrefix,
  ensureTrailingSlash,
  joinUrlParts,
  parseLinkHeader,
  parseUrl,
  trimTrailingSlash,
} from '../../../util/url';
import {
  api as dockerVersioning,
  id as dockerVersioningId,
} from '../../versioning/docker';
import { Datasource } from '../datasource';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import { gitRefLabel, sourceLabels } from './common';
import {
  Image,
  ImageConfig,
  ImageList,
  MediaType,
  OciImage,
  OciImageList,
  RegistryRepository,
} from './types';

export const DOCKER_HUB = 'https://index.docker.io';

export const ecrRegex = regEx(/\d+\.dkr\.ecr\.([-a-z0-9]+)\.amazonaws\.com/);

function isDockerHost(host: string): boolean {
  const regex = regEx(/(?:^|\.)docker\.io$/);
  return regex.test(host);
}

export async function getAuthHeaders(
  http: Http,
  registryHost: string,
  dockerRepository: string,
  apiCheckUrl = `${registryHost}/v2/`
): Promise<OutgoingHttpHeaders | null> {
  try {
    const options = {
      throwHttpErrors: false,
      noAuth: true,
    };
    const apiCheckResponse = apiCheckUrl.endsWith('/v2/')
      ? await http.get(apiCheckUrl, options)
      : // use json request, as this will be cached for tags, so it returns json
        // TODO: add cache test
        await http.getJson(apiCheckUrl, options);

    if (apiCheckResponse.statusCode === 200) {
      logger.debug({ apiCheckUrl }, 'No registry auth required');
      return {};
    }
    if (apiCheckResponse.statusCode === 404) {
      logger.debug({ apiCheckUrl }, 'Page Not Found');
      // throw error up to be caught and potentially retried with library/ prefix
      throw new Error(PAGE_NOT_FOUND_ERROR);
    }
    if (
      apiCheckResponse.statusCode !== 401 ||
      !is.nonEmptyString(apiCheckResponse.headers['www-authenticate'])
    ) {
      logger.warn(
        { apiCheckUrl, res: apiCheckResponse },
        'Invalid registry response'
      );
      return null;
    }

    const authenticateHeader = parse(
      apiCheckResponse.headers['www-authenticate']
    );

    const opts: HostRule & HttpOptions = hostRules.find({
      hostType: DockerDatasource.id,
      url: apiCheckUrl,
    });
    if (ecrRegex.test(registryHost)) {
      logger.trace(
        { registryHost, dockerRepository },
        `Using ecr auth for Docker registry`
      );
      const [, region] = ecrRegex.exec(registryHost) ?? [];
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
      parseUrl(authenticateHeader.params.realm) === null
    ) {
      logger.trace(
        { registryHost, dockerRepository, authenticateHeader },
        `Invalid realm, testing direct auth`
      );
      return opts.headers ?? null;
    }

    let scope = `repository:${dockerRepository}:pull`;
    // repo isn't known to server yet, so causing wrong scope `repository:user/image:pull`
    if (
      is.string(authenticateHeader.params.scope) &&
      !apiCheckUrl.endsWith('/v2/')
    ) {
      scope = authenticateHeader.params.scope;
    }

    let service = authenticateHeader.params.service;
    if (!is.string(service)) {
      service = '';
    }
    const authUrl = `${authenticateHeader.params.realm}?service=${service}&scope=${scope}`;
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

    const token = authResponse.token ?? authResponse.access_token;
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
    if (err.message === PAGE_NOT_FOUND_ERROR) {
      throw err;
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

async function getECRAuthToken(
  region: string | undefined,
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

export function getRegistryRepository(
  packageName: string,
  registryUrl: string
): RegistryRepository {
  if (registryUrl !== DOCKER_HUB) {
    const registryEndingWithSlash = ensureTrailingSlash(
      registryUrl.replace(regEx(/^https?:\/\//), '')
    );
    if (packageName.startsWith(registryEndingWithSlash)) {
      let registryHost = trimTrailingSlash(registryUrl);
      if (!regEx(/^https?:\/\//).test(registryHost)) {
        registryHost = `https://${registryHost}`;
      }
      let dockerRepository = packageName.replace(registryEndingWithSlash, '');
      const fullUrl = `${registryHost}/${dockerRepository}`;
      const { origin, pathname } = parseUrl(fullUrl)!;
      registryHost = origin;
      dockerRepository = pathname.substring(1);
      return {
        registryHost,
        dockerRepository,
      };
    }
  }
  let registryHost: string | undefined;
  const split = packageName.split('/');
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
  const opts = hostRules.find({
    hostType: DockerDatasource.id,
    url: registryHost,
  });
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

export function isECRMaxResultsError(err: HttpError): boolean {
  const resp = err.response as HttpResponse<any> | undefined;
  return !!(
    resp?.statusCode === 405 &&
    resp.headers?.['docker-distribution-api-version'] &&
    // https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_DescribeRepositories.html#ECR-DescribeRepositories-request-maxResults
    resp.body?.['errors']?.[0]?.message?.includes(
      'Member must have value less than or equal to 1000'
    )
  );
}

const defaultConfig = {
  commitMessageTopic: '{{{depName}}} Docker tag',
  commitMessageExtra:
    'to {{#if isPinDigest}}{{{newDigestShort}}}{{else}}{{#if isMajor}}{{{prettyNewMajor}}}{{else}}{{{prettyNewVersion}}}{{/if}}{{/if}}',
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
};

function findLatestStable(tags: string[]): string | null {
  const versions = tags
    .filter((v) => dockerVersioning.isValid(v) && dockerVersioning.isStable(v))
    .sort((a, b) => dockerVersioning.sortVersions(a, b));

  return versions.pop() ?? tags.slice(-1).pop() ?? null;
}

export class DockerDatasource extends Datasource {
  static readonly id = 'docker';

  override readonly defaultVersioning = dockerVersioningId;

  override readonly defaultRegistryUrls = [DOCKER_HUB];

  override readonly defaultConfig = defaultConfig;

  constructor() {
    super(DockerDatasource.id);
  }

  // TODO: debug why quay throws errors (#9612)
  private async getManifestResponse(
    registryHost: string,
    dockerRepository: string,
    tag: string,
    mode: 'head' | 'get' = 'get'
  ): Promise<HttpResponse | null> {
    logger.debug(
      `getManifestResponse(${registryHost}, ${dockerRepository}, ${tag})`
    );
    try {
      const headers = await getAuthHeaders(
        this.http,
        registryHost,
        dockerRepository
      );
      if (!headers) {
        logger.warn('No docker auth found - returning');
        return null;
      }
      headers.accept = [
        MediaType.manifestListV2,
        MediaType.manifestV2,
        MediaType.ociManifestV1,
        MediaType.ociManifestIndexV1,
      ].join(', ');
      const url = `${registryHost}/v2/${dockerRepository}/manifests/${tag}`;
      const manifestResponse = await this.http[mode](url, {
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

  @cache({
    namespace: 'datasource-docker-imageconfig',
    key: (
      registryHost: string,
      dockerRepository: string,
      configDigest: string
    ) => `${registryHost}:${dockerRepository}@${configDigest}`,
    ttlMinutes: 1440 * 28,
  })
  public async getImageConfig(
    registryHost: string,
    dockerRepository: string,
    configDigest: string
  ): Promise<HttpResponse<ImageConfig> | undefined> {
    logger.trace(
      `getImageConfig(${registryHost}, ${dockerRepository}, ${configDigest})`
    );

    const headers = await getAuthHeaders(
      this.http,
      registryHost,
      dockerRepository
    );
    // istanbul ignore if: Should never happen
    if (!headers) {
      logger.warn('No docker auth found - returning');
      return undefined;
    }
    const url = joinUrlParts(
      registryHost,
      'v2',
      dockerRepository,
      'blobs',
      configDigest
    );
    return await this.http.getJson<ImageConfig>(url, {
      headers,
      noAuth: true,
    });
  }

  private async getConfigDigest(
    registry: string,
    dockerRepository: string,
    tag: string
  ): Promise<string | null> {
    const manifestResponse = await this.getManifestResponse(
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
    const manifest = JSON.parse(manifestResponse.body) as
      | ImageList
      | Image
      | OciImageList
      | OciImage;
    if (manifest.schemaVersion !== 2) {
      logger.debug(
        { registry, dockerRepository, tag },
        'Manifest schema version is not 2'
      );
      return null;
    }

    if (manifest.mediaType === MediaType.manifestListV2) {
      if (manifest.manifests.length) {
        logger.trace(
          { registry, dockerRepository, tag },
          'Found manifest list, using first image'
        );
        return this.getConfigDigest(
          registry,
          dockerRepository,
          manifest.manifests[0].digest
        );
      } else {
        logger.debug(
          { manifest },
          'Invalid manifest list with no manifests - returning'
        );
        return null;
      }
    }

    if (
      manifest.mediaType === MediaType.manifestV2 &&
      is.string(manifest.config?.digest)
    ) {
      return manifest.config?.digest;
    }

    // OCI image lists are not required to specify a mediaType
    if (
      manifest.mediaType === MediaType.ociManifestIndexV1 ||
      (!manifest.mediaType && hasKey('manifests', manifest))
    ) {
      if (manifest.manifests.length) {
        logger.trace(
          { registry, dockerRepository, tag },
          'Found manifest index, using first image'
        );
        return this.getConfigDigest(
          registry,
          dockerRepository,
          manifest.manifests[0].digest
        );
      } else {
        logger.debug(
          { manifest },
          'Invalid manifest index with no manifests - returning'
        );
        return null;
      }
    }

    // OCI manifests are not required to specify a mediaType
    if (
      (manifest.mediaType === MediaType.ociManifestV1 ||
        (!manifest.mediaType && hasKey('config', manifest))) &&
      is.string(manifest.config?.digest)
    ) {
      return manifest.config?.digest;
    }

    logger.debug({ manifest }, 'Invalid manifest - returning');
    return null;
  }

  @cache({
    namespace: 'datasource-docker-architecture',
    key: (
      registryHost: string,
      dockerRepository: string,
      currentDigest: string
    ) => `${registryHost}:${dockerRepository}@${currentDigest}`,
    ttlMinutes: 1440 * 28,
  })
  public async getImageArchitecture(
    registryHost: string,
    dockerRepository: string,
    currentDigest: string
  ): Promise<string | null | undefined> {
    try {
      const manifestResponse = await this.getManifestResponse(
        registryHost,
        dockerRepository,
        currentDigest,
        'head'
      );

      if (
        manifestResponse?.headers['content-type'] !== MediaType.manifestV2 &&
        manifestResponse?.headers['content-type'] !== MediaType.ociManifestV1
      ) {
        return null;
      }

      const configDigest = await this.getConfigDigest(
        registryHost,
        dockerRepository,
        currentDigest
      );
      if (!configDigest) {
        return null;
      }

      const configResponse = await this.getImageConfig(
        registryHost,
        dockerRepository,
        configDigest
      );
      if (configResponse) {
        const architecture = configResponse.body.architecture ?? null;
        logger.debug(
          `Current digest ${currentDigest} relates to architecture ${
            architecture ?? 'null'
          }`
        );

        return architecture;
      }
    } catch (err) /* istanbul ignore next */ {
      if (err.statusCode !== 404 || err.message === PAGE_NOT_FOUND_ERROR) {
        throw err;
      }
      logger.debug(
        { registryHost, dockerRepository, currentDigest, err },
        'Unknown error getting image architecture'
      );
    }

    return undefined;
  }

  /*
   * docker.getLabels
   *
   * This function will:
   *  - Return the labels for the requested image
   */
  @cache({
    namespace: 'datasource-docker-labels',
    key: (registryHost: string, dockerRepository: string, tag: string) =>
      `${registryHost}:${dockerRepository}:${tag}`,
    ttlMinutes: 60,
  })
  public async getLabels(
    registryHost: string,
    dockerRepository: string,
    tag: string
  ): Promise<Record<string, string>> {
    logger.debug(`getLabels(${registryHost}, ${dockerRepository}, ${tag})`);
    try {
      let labels: Record<string, string> = {};
      const configDigest = await this.getConfigDigest(
        registryHost,
        dockerRepository,
        tag
      );
      if (!configDigest) {
        return {};
      }

      const headers = await getAuthHeaders(
        this.http,
        registryHost,
        dockerRepository
      );
      // istanbul ignore if: Should never happen
      if (!headers) {
        logger.warn('No docker auth found - returning');
        return {};
      }
      const url = `${registryHost}/v2/${dockerRepository}/blobs/${configDigest}`;
      const configResponse = await this.http.get(url, {
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

  private async getTagsQuayRegistry(
    registry: string,
    repository: string
  ): Promise<string[]> {
    let tags: string[] = [];
    const limit = 100;

    const pageUrl = (page: number): string =>
      `${registry}/api/v1/repository/${repository}/tag/?limit=${limit}&page=${page}&onlyActiveTags=true`;

    let page = 1;
    let url: string | null = pageUrl(page);
    while (url && page <= 20) {
      interface QuayRestDockerTags {
        tags: {
          name: string;
        }[];
        has_additional: boolean;
      }

      // typescript issue :-/
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const res = (await this.http.getJson<QuayRestDockerTags>(
        url
      )) as HttpResponse<QuayRestDockerTags>;
      const pageTags = res.body.tags.map((tag) => tag.name);
      tags = tags.concat(pageTags);
      page += 1;
      url = res.body.has_additional ? pageUrl(page) : null;
    }
    return tags;
  }

  private async getDockerApiTags(
    registryHost: string,
    dockerRepository: string
  ): Promise<string[] | null> {
    let tags: string[] = [];
    // AWS ECR limits the maximum number of results to 1000
    // See https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_DescribeRepositories.html#ECR-DescribeRepositories-request-maxResults
    const limit = ecrRegex.test(registryHost) ? 1000 : 10000;
    let url:
      | string
      | null = `${registryHost}/${dockerRepository}/tags/list?n=${limit}`;
    url = ensurePathPrefix(url, '/v2');
    const headers = await getAuthHeaders(
      this.http,
      registryHost,
      dockerRepository,
      url
    );
    if (!headers) {
      logger.debug('Failed to get authHeaders for getTags lookup');
      return null;
    }
    let page = 1;
    let foundMaxResultsError = false;
    do {
      let res: HttpResponse<{ tags: string[] }>;
      try {
        res = await this.http.getJson<{ tags: string[] }>(url, {
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

  @cache({
    namespace: 'datasource-docker-tags',
    key: (registryHost: string, dockerRepository: string) =>
      `${registryHost}:${dockerRepository}`,
  })
  public async getTags(
    registryHost: string,
    dockerRepository: string
  ): Promise<string[] | null> {
    try {
      const isQuay = regEx(/^https:\/\/quay\.io(?::[1-9][0-9]{0,4})?$/i).test(
        registryHost
      );
      let tags: string[] | null;
      if (isQuay) {
        tags = await this.getTagsQuayRegistry(registryHost, dockerRepository);
      } else {
        tags = await this.getDockerApiTags(registryHost, dockerRepository);
      }
      return tags;
    } catch (err) /* istanbul ignore next */ {
      if (err instanceof ExternalHostError) {
        throw err;
      }
      if (
        (err.statusCode === 404 || err.message === PAGE_NOT_FOUND_ERROR) &&
        !dockerRepository.includes('/')
      ) {
        logger.debug(
          `Retrying Tags for ${registryHost}/${dockerRepository} using library/ prefix`
        );
        return this.getTags(registryHost, 'library/' + dockerRepository);
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

  /**
   * docker.getDigest
   *
   * The `newValue` supplied here should be a valid tag for the docker image.
   *
   * This function will:
   *  - Look up a sha256 digest for a tag on its registry
   *  - Return the digest as a string
   */
  @cache({
    namespace: 'datasource-docker-digest',
    key: (
      { registryUrl, packageName, currentDigest }: DigestConfig,
      newValue?: string
    ) => {
      const newTag = newValue ?? 'latest';
      const { registryHost, dockerRepository } = getRegistryRepository(
        packageName,
        registryUrl!
      );
      const digest = currentDigest ? `@${currentDigest}` : '';
      return `${registryHost}:${dockerRepository}:${newTag}${digest}`;
    },
  })
  override async getDigest(
    { registryUrl, packageName, currentDigest }: DigestConfig,
    newValue?: string
  ): Promise<string | null> {
    const { registryHost, dockerRepository } = getRegistryRepository(
      packageName,
      registryUrl!
    );
    logger.debug(
      // TODO: types (#7154)
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `getDigest(${registryHost}, ${dockerRepository}, ${newValue})`
    );
    const newTag = newValue ?? 'latest';
    let digest: string | null = null;
    try {
      let architecture: string | null | undefined = null;
      if (currentDigest) {
        architecture = await this.getImageArchitecture(
          registryHost,
          dockerRepository,
          currentDigest
        );
      }

      let manifestResponse: HttpResponse | null = null;
      if (!architecture) {
        manifestResponse = await this.getManifestResponse(
          registryHost,
          dockerRepository,
          newTag,
          'head'
        );

        if (
          manifestResponse &&
          hasKey('docker-content-digest', manifestResponse.headers)
        ) {
          digest =
            (manifestResponse.headers['docker-content-digest'] as string) ||
            null;
        }
      }

      if (
        architecture ||
        (manifestResponse &&
          !hasKey('docker-content-digest', manifestResponse.headers))
      ) {
        logger.debug(
          { registryHost, dockerRepository },
          'Architecture-specific digest or missing docker-content-digest header - pulling full manifest'
        );
        manifestResponse = await this.getManifestResponse(
          registryHost,
          dockerRepository,
          newTag
        );

        if (architecture && manifestResponse) {
          const manifestList = JSON.parse(manifestResponse.body) as
            | ImageList
            | Image
            | OciImageList
            | OciImage;
          if (
            manifestList.schemaVersion === 2 &&
            (manifestList.mediaType === MediaType.manifestListV2 ||
              manifestList.mediaType === MediaType.ociManifestIndexV1 ||
              (!manifestList.mediaType && hasKey('manifests', manifestList)))
          ) {
            for (const manifest of manifestList.manifests) {
              if (manifest.platform['architecture'] === architecture) {
                digest = manifest.digest;
                break;
              }
            }
          }
        }

        if (!digest) {
          digest = extractDigestFromResponseBody(manifestResponse!);
        }
      }

      if (manifestResponse) {
        logger.debug({ digest }, 'Got docker digest');
      }
    } catch (err) /* istanbul ignore next */ {
      if (err instanceof ExternalHostError) {
        throw err;
      }
      logger.debug(
        {
          err,
          packageName,
          newTag,
        },
        'Unknown Error looking up docker image digest'
      );
    }
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
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const { registryHost, dockerRepository } = getRegistryRepository(
      packageName,
      registryUrl!
    );
    const tags = await this.getTags(registryHost, dockerRepository);
    if (!tags) {
      return null;
    }
    const releases = tags.map((version) => ({ version }));
    const ret: ReleaseResult = {
      registryUrl: registryHost,
      releases,
    };

    const latestTag = tags.includes('latest')
      ? 'latest'
      : findLatestStable(tags);

    // istanbul ignore if: needs test
    if (!latestTag) {
      return ret;
    }
    const labels = await this.getLabels(
      registryHost,
      dockerRepository,
      latestTag
    );
    if (labels) {
      if (is.nonEmptyString(labels[gitRefLabel])) {
        ret.gitRef = labels[gitRefLabel];
      }
      for (const label of sourceLabels) {
        if (is.nonEmptyString(labels[label])) {
          ret.sourceUrl = labels[label];
          break;
        }
      }
    }
    return ret;
  }
}
