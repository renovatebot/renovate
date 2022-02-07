import URL from 'url';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { cache } from '../../util/cache/package/decorator';
import { HttpError } from '../../util/http/types';
import { hasKey } from '../../util/object';
import { regEx } from '../../util/regex';
import { ensurePathPrefix, parseLinkHeader } from '../../util/url';
import {
  api as dockerVersioning,
  id as dockerVersioningId,
} from '../../versioning/docker';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import {
  ecrRegex,
  extractDigestFromResponseBody,
  getAuthHeaders,
  getLabels,
  getManifestResponse,
  getRegistryRepository,
  http,
  isECRMaxResultsError,
} from './common';
import { getTagsQuayRegistry } from './quay';

// TODO: add got typings when available (#9646)

export class DockerDatasource extends Datasource {
  static readonly id = 'docker';

  constructor() {
    super(DockerDatasource.id);
  }

  private static readonly DOCKER_HUB = 'https://index.docker.io';

  override readonly defaultRegistryUrls = [DockerDatasource.DOCKER_HUB];

  override readonly defaultVersioning = dockerVersioningId;

  override readonly defaultConfig = {
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
    lookupName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const { registryHost, dockerRepository } = getRegistryRepository(
      lookupName,
      registryUrl
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
      : this.findLatestStable(tags);
    const labels = await getLabels(registryHost, dockerRepository, latestTag);
    if (labels && 'org.opencontainers.image.source' in labels) {
      ret.sourceUrl = labels['org.opencontainers.image.source'];
    }
    return ret;
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
    namespace: `datasource-${DockerDatasource.id}-digest`,
    key: ({ registryUrl, lookupName }: GetReleasesConfig, newValue?: string) =>
      DockerDatasource.getDigestCacheKey({ registryUrl, lookupName }, newValue),
  })
  override async getDigest(
    { registryUrl, lookupName }: GetReleasesConfig,
    newValue?: string
  ): Promise<string | null> {
    const { registryHost, dockerRepository } = getRegistryRepository(
      lookupName,
      registryUrl
    );
    logger.debug(
      `getDigest(${registryHost}, ${dockerRepository}, ${newValue})`
    );
    const newTag = newValue || 'latest';

    let digest: string = null;
    try {
      let manifestResponse = await getManifestResponse(
        registryHost,
        dockerRepository,
        newTag,
        'head'
      );
      if (manifestResponse) {
        if (hasKey('docker-content-digest', manifestResponse.headers)) {
          digest =
            (manifestResponse.headers['docker-content-digest'] as string) ||
            null;
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

    return digest;
  }

  async getDockerApiTags(
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
      let res;
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

  @cache({
    namespace: `datasource-${DockerDatasource.id}-tags`,
    key: (registryHost: string, dockerRepository: string) =>
      `${registryHost}:${dockerRepository}`,
  })
  async getTags(
    registryHost: string,
    dockerRepository: string
  ): Promise<string[] | null> {
    try {
      const isQuay = regEx(/^https:\/\/quay\.io(?::[1-9][0-9]{0,4})?$/i).test(
        registryHost
      );
      let tags: string[] | null;
      if (isQuay) {
        tags = await getTagsQuayRegistry(registryHost, dockerRepository);
      } else {
        tags = await this.getDockerApiTags(registryHost, dockerRepository);
      }
      return tags;
    } catch (err) /* istanbul ignore next */ {
      if (err instanceof ExternalHostError) {
        throw err;
      }
      if (err.statusCode === 404 && !dockerRepository.includes('/')) {
        logger.debug(
          `Retrying Tags for ${registryHost}/${dockerRepository} using library/ prefix`
        );
        return this.getTags(registryHost, 'library/' + dockerRepository);
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

  private findLatestStable(tags: string[]): string {
    const versions = tags
      .filter(
        (v) => dockerVersioning.isValid(v) && dockerVersioning.isStable(v)
      )
      .sort((a, b) => dockerVersioning.sortVersions(a, b));

    return versions.pop() ?? tags.slice(-1).pop();
  }

  private static getDigestCacheKey(
    { registryUrl, lookupName }: GetReleasesConfig,
    newValue?: string
  ): string {
    const { registryHost, dockerRepository } = getRegistryRepository(
      lookupName,
      registryUrl
    );
    const newTag = newValue || 'latest';
    return `${registryHost}:${dockerRepository}:${newTag}`;
  }
}
