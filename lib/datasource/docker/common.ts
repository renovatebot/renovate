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
import type { OutgoingHttpHeaders } from '../../util/http/types';
import { regEx } from '../../util/regex';
import {
  ensureTrailingSlash,
  parseUrl,
  trimTrailingSlash,
} from '../../util/url';
import { MediaType, RegistryRepository } from './types';

export const id = 'docker';
export const http = new Http(id);

export const ecrRegex = regEx(/\d+\.dkr\.ecr\.([-a-z0-9]+)\.amazonaws\.com/);
const DOCKER_HUB = 'https://index.docker.io';
export const defaultRegistryUrls = [DOCKER_HUB];

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
    // prettier-ignore
    if (err.name === 'RequestError' && registryHost.endsWith('docker.io')) { // lgtm [js/incomplete-url-substring-sanitization]
        throw new ExternalHostError(err);
      }
    // prettier-ignore
    if (err.statusCode === 429 && registryHost.endsWith('docker.io')) { // lgtm [js/incomplete-url-substring-sanitization]
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
    // prettier-ignore
    if (err.statusCode === 429 && registryHost.endsWith('docker.io')) { // lgtm [js/incomplete-url-substring-sanitization]
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
  const manifest = JSON.parse(manifestResponse.body);
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
    } else if (
      err.statusCode === 429 &&
      registryHost.endsWith('docker.io') // lgtm [js/incomplete-url-substring-sanitization]
    ) {
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
