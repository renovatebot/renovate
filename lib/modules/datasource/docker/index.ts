import is from '@sindresorhus/is';
import { PAGE_NOT_FOUND_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import { HttpError } from '../../../util/http';
import type { HttpResponse } from '../../../util/http/types';
import { hasKey } from '../../../util/object';
import { regEx } from '../../../util/regex';
import { isDockerDigest } from '../../../util/string';
import {
  ensurePathPrefix,
  joinUrlParts,
  parseLinkHeader,
} from '../../../util/url';
import { id as dockerVersioningId } from '../../versioning/docker';
import { Datasource } from '../datasource';
import type { DigestConfig, GetReleasesConfig, ReleaseResult } from '../types';
import { isArtifactoryServer } from '../util';
import {
  DOCKER_HUB,
  dockerDatasourceId,
  extractDigestFromResponseBody,
  findLatestStable,
  getAuthHeaders,
  getRegistryRepository,
  gitRefLabel,
  isDockerHost,
  sourceLabels,
} from './common';
import { ecrPublicRegex, ecrRegex, isECRMaxResultsError } from './ecr';
import type { Manifest, OciImageConfig } from './schema';

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

export class DockerDatasource extends Datasource {
  static readonly id = dockerDatasourceId;

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
      `getManifestResponse(${registryHost}, ${dockerRepository}, ${tag}, ${mode})`
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
        'application/vnd.docker.distribution.manifest.list.v2+json',
        'application/vnd.docker.distribution.manifest.v2+json',
        'application/vnd.oci.image.manifest.v1+json',
        'application/vnd.oci.image.index.v1+json',
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
  ): Promise<HttpResponse<OciImageConfig> | undefined> {
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
    return await this.http.getJson<OciImageConfig>(url, {
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
    // TODO: validate schema
    const manifest = JSON.parse(manifestResponse.body) as Manifest;
    if (manifest.schemaVersion !== 2) {
      logger.debug(
        { registry, dockerRepository, tag },
        'Manifest schema version is not 2'
      );
      return null;
    }

    if (
      manifest.mediaType ===
      'application/vnd.docker.distribution.manifest.list.v2+json'
    ) {
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
      manifest.mediaType ===
        'application/vnd.docker.distribution.manifest.v2+json' &&
      is.string(manifest.config?.digest)
    ) {
      return manifest.config?.digest;
    }

    // OCI image lists are not required to specify a mediaType
    if (
      manifest.mediaType === 'application/vnd.oci.image.index.v1+json' ||
      (!manifest.mediaType && 'manifests' in manifest)
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
      (manifest.mediaType === 'application/vnd.oci.image.manifest.v1+json' ||
        (!manifest.mediaType && 'config' in manifest)) &&
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
      let manifestResponse: HttpResponse<string> | null;

      try {
        manifestResponse = await this.getManifestResponse(
          registryHost,
          dockerRepository,
          currentDigest,
          'head'
        );
      } catch (_err) {
        const err = _err instanceof ExternalHostError ? _err.err : _err;

        if (
          typeof err.statusCode === 'number' &&
          err.statusCode >= 500 &&
          err.statusCode < 600
        ) {
          // querying the digest manifest for a non existent image leads to a 500 statusCode
          return null;
        }

        /* istanbul ignore next */
        throw _err;
      }

      if (
        manifestResponse?.headers['content-type'] !==
          'application/vnd.docker.distribution.manifest.v2+json' &&
        manifestResponse?.headers['content-type'] !==
          'application/vnd.oci.image.manifest.v1+json'
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
  ): Promise<Record<string, string> | undefined> {
    logger.debug(`getLabels(${registryHost}, ${dockerRepository}, ${tag})`);
    try {
      let labels: Record<string, string> | undefined = {};
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

      // TODO: validate schema
      const body = JSON.parse(configResponse.body) as OciImageConfig;
      if (body.config) {
        labels = body.config.Labels;
      } else {
        logger.debug(
          { headers: configResponse.headers, body },
          `manifest blob response body missing the "config" property`
        );
      }

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
    // See https://docs.aws.amazon.com/AmazonECRPublic/latest/APIReference/API_DescribeRepositories.html#ecrpublic-DescribeRepositories-request-maxResults
    const limit =
      ecrRegex.test(registryHost) || ecrPublicRegex.test(registryHost)
        ? 1000
        : 10000;
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
    let page = 0;
    const pages = process.env.RENOVATE_X_DOCKER_MAX_PAGES
      ? parseInt(process.env.RENOVATE_X_DOCKER_MAX_PAGES, 10)
      : 20;
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
      if (isArtifactoryServer(res)) {
        // Artifactory incorrectly returns a next link without the virtual repository name
        // this is due to a bug in Artifactory https://jfrog.atlassian.net/browse/RTFACT-18971
        url = linkHeader?.next?.last
          ? `${url}&last=${linkHeader.next.last}`
          : null;
      } else {
        url = linkHeader?.next ? new URL(linkHeader.next.url, url).href : null;
      }
      page += 1;
    } while (url && page < pages);
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
    } catch (_err) /* istanbul ignore next */ {
      const err = _err instanceof ExternalHostError ? _err.err : _err;

      if (
        (err.statusCode === 404 || err.message === PAGE_NOT_FOUND_ERROR) &&
        !dockerRepository.includes('/')
      ) {
        logger.debug(
          `Retrying Tags for ${registryHost}/${dockerRepository} using library/ prefix`
        );
        return this.getTags(registryHost, 'library/' + dockerRepository);
      }
      // JFrog Artifactory - Retry handling when resolving Docker Official Images
      // These follow the format of {{registryHost}}{{jFrogRepository}}/library/{{dockerRepository}}
      if (
        (err.statusCode === 404 || err.message === PAGE_NOT_FOUND_ERROR) &&
        isArtifactoryServer(err.response) &&
        dockerRepository.split('/').length === 2
      ) {
        logger.debug(
          `JFrog Artifactory: Retrying Tags for ${registryHost}/${dockerRepository} using library/ path between JFrog virtual repository and image`
        );

        const dockerRepositoryParts = dockerRepository.split('/');
        const jfrogRepository = dockerRepositoryParts[0];
        const dockerImage = dockerRepositoryParts[1];

        return this.getTags(
          registryHost,
          jfrogRepository + '/library/' + dockerImage
        );
      }
      if (err.statusCode === 429 && isDockerHost(registryHost)) {
        logger.warn(
          { registryHost, dockerRepository, err },
          'docker registry failure: too many requests'
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
      const errorCodes = ['ECONNRESET', 'ETIMEDOUT'];
      if (errorCodes.includes(err.code)) {
        logger.warn(
          { registryHost, dockerRepository, err },
          'docker registry connection failure'
        );
        throw new ExternalHostError(err);
      }
      if (isDockerHost(registryHost)) {
        logger.info({ err }, 'Docker Hub lookup failure');
      }
      throw _err;
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
      `getDigest(${registryHost}, ${dockerRepository}, ${newValue})`
    );
    const newTag = newValue ?? 'latest';
    let digest: string | null = null;
    try {
      let architecture: string | null | undefined = null;
      if (currentDigest && isDockerDigest(currentDigest)) {
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
        is.string(architecture) ||
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
          // TODO: validate Schema
          const manifestList = JSON.parse(manifestResponse.body) as Manifest;
          if (
            manifestList.schemaVersion === 2 &&
            (manifestList.mediaType ===
              'application/vnd.docker.distribution.manifest.list.v2+json' ||
              manifestList.mediaType ===
                'application/vnd.oci.image.index.v1+json' ||
              (!manifestList.mediaType && 'manifests' in manifestList))
          ) {
            for (const manifest of manifestList.manifests) {
              if (manifest.platform?.architecture === architecture) {
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

      if (
        !manifestResponse &&
        !dockerRepository.includes('/') &&
        !packageName.includes('/')
      ) {
        logger.debug(
          `Retrying Digest for ${registryHost}/${dockerRepository} using library/ prefix`
        );
        return this.getDigest(
          {
            registryUrl,
            packageName: 'library/' + packageName,
            currentDigest,
          },
          newValue
        );
      }

      if (manifestResponse) {
        // TODO: fix types (#7154)
        logger.debug(`Got docker digest ${digest!}`);
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
