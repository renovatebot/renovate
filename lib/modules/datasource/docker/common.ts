import is from '@sindresorhus/is';
import { parse } from 'auth-header';
import {
  HOST_DISABLED,
  PAGE_NOT_FOUND_ERROR,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
import type { HostRule } from '../../../types';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { toSha256 } from '../../../util/hash';
import * as hostRules from '../../../util/host-rules';
import type { Http } from '../../../util/http';
import type {
  HttpOptions,
  HttpResponse,
  OutgoingHttpHeaders,
} from '../../../util/http/types';
import { regEx } from '../../../util/regex';
import { addSecretForSanitizing } from '../../../util/sanitize';
import {
  ensureTrailingSlash,
  parseUrl,
  trimTrailingSlash,
} from '../../../util/url';
import { api as dockerVersioning } from '../../versioning/docker';
import { ecrRegex, getECRAuthToken } from './ecr';
import type { RegistryRepository } from './types';

export const dockerDatasourceId = 'docker' as const;

export const sourceLabels: string[] = [
  'org.opencontainers.image.source',
  'org.label-schema.vcs-url',
];

export const gitRefLabel = 'org.opencontainers.image.revision';

export const DOCKER_HUB = 'https://index.docker.io';

export function isDockerHost(host: string): boolean {
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
      logger.debug(`No registry auth required for ${apiCheckUrl}`);
      return {};
    }
    if (apiCheckResponse.statusCode === 404) {
      logger.debug(`Page Not Found ${apiCheckUrl}`);
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
      hostType: dockerDatasourceId,
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

    const authUrl = new URL(`${authenticateHeader.params.realm}`);

    // repo isn't known to server yet, so causing wrong scope `repository:user/image:pull`
    if (
      is.string(authenticateHeader.params.scope) &&
      !apiCheckUrl.endsWith('/v2/')
    ) {
      authUrl.searchParams.append('scope', authenticateHeader.params.scope);
    } else {
      authUrl.searchParams.append(
        'scope',
        `repository:${dockerRepository}:pull`
      );
    }

    if (is.string(authenticateHeader.params.service)) {
      authUrl.searchParams.append('service', authenticateHeader.params.service);
    }

    logger.trace(
      { registryHost, dockerRepository, authUrl: authUrl.href },
      `Obtaining docker registry token`
    );
    opts.noAuth = true;
    const authResponse = (
      await http.getJson<{ token?: string; access_token?: string }>(
        authUrl.href,
        opts
      )
    ).body;

    const token = authResponse.token ?? authResponse.access_token;
    // istanbul ignore if
    if (!token) {
      logger.warn('Failed to obtain docker registry token');
      return null;
    }
    // sanitize token
    addSecretForSanitizing(token);
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
    hostType: dockerDatasourceId,
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

export function extractDigestFromResponseBody(
  manifestResponse: HttpResponse
): string {
  return 'sha256:' + toSha256(manifestResponse.body);
}

export function findLatestStable(tags: string[]): string | null {
  const versions = tags
    .filter((v) => dockerVersioning.isValid(v) && dockerVersioning.isStable(v))
    .sort((a, b) => dockerVersioning.sortVersions(a, b));

  return versions.pop() ?? tags.slice(-1).pop() ?? null;
}
