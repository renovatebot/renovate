import { ZodError } from 'zod/v3';
import { logger } from '../../../logger/index.ts';
import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { BitbucketServerHttp } from '../../../util/http/bitbucket-server.ts';
import { regEx } from '../../../util/regex.ts';
import { Result } from '../../../util/result.ts';
import { ensureTrailingSlash } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import { DigestsConfig, ReleasesConfig } from '../schema.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from '../types.ts';
import {
  BitbucketServerCommits,
  BitbucketServerTag,
  BitbucketServerTags,
} from './schema.ts';

export class BitbucketServerTagsDatasource extends Datasource {
  static readonly id = 'bitbucket-server-tags';

  override http = new BitbucketServerHttp(BitbucketServerTagsDatasource.id);

  static readonly sourceUrlSupport = 'package';
  static readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  static readonly cacheNamespace: PackageCacheNamespace = `datasource-${BitbucketServerTagsDatasource.id}`;

  constructor() {
    super(BitbucketServerTagsDatasource.id);
  }

  static getRegistryURL(registryUrl: string): string {
    return registryUrl?.replace(regEx(/\/rest\/api\/1.0$/), '');
  }

  static getSourceUrl(
    projectKey: string,
    repositorySlug: string,
    registryUrl: string,
  ): string {
    const url = BitbucketServerTagsDatasource.getRegistryURL(registryUrl);
    return `${ensureTrailingSlash(url)}projects/${projectKey}/repos/${repositorySlug}`;
  }

  static getApiUrl(registryUrl: string): string {
    const res = BitbucketServerTagsDatasource.getRegistryURL(registryUrl);
    return `${ensureTrailingSlash(res)}rest/api/1.0/`;
  }

  static getCacheKey(
    registryUrl: string | undefined,
    repo: string,
    type: string,
  ): string {
    return `${BitbucketServerTagsDatasource.getRegistryURL(registryUrl ?? '')}:${repo}:${type}`;
  }

  // getReleases fetches list of tags for the repository
  private async _getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    const { registryUrl, packageName } = config;
    const [projectKey, repositorySlug] = packageName.split('/');
    if (!registryUrl) {
      logger.debug('Missing registryUrl');
      return null;
    }

    const result = Result.parse(config, ReleasesConfig)
      .transform(({ registryUrl }) => {
        const url = `${BitbucketServerTagsDatasource.getApiUrl(registryUrl)}projects/${projectKey}/repos/${repositorySlug}/tags`;

        return this.http.getJsonSafe(
          url,
          { paginate: true },
          BitbucketServerTags,
        );
      })
      .transform((tags) =>
        tags.map(({ displayId, hash }) => ({
          version: displayId,
          gitRef: displayId,
          newDigest: hash ?? undefined,
        })),
      )
      .transform((versions): ReleaseResult => {
        return {
          sourceUrl: BitbucketServerTagsDatasource.getSourceUrl(
            projectKey,
            repositorySlug,
            registryUrl,
          ),
          registryUrl:
            BitbucketServerTagsDatasource.getRegistryURL(registryUrl),
          releases: versions,
        };
      });
    const { val, err } = await result.unwrap();

    if (err instanceof ZodError) {
      logger.debug({ err }, 'bitbucket-server-tags: validation error');
      return null;
    }

    if (err) {
      this.handleGenericErrors(err);
    }

    return val;
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: BitbucketServerTagsDatasource.cacheNamespace,
        key: BitbucketServerTagsDatasource.getCacheKey(
          config.registryUrl,
          config.packageName,
          'tags',
        ),
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }

  // getTagCommit fetches the commit hash for the specified tag
  private async _getTagCommit(
    baseUrl: string,
    tag: string,
  ): Promise<string | null> {
    const bitbucketServerTag = (
      await this.http.getJson(`${baseUrl}/tags/${tag}`, BitbucketServerTag)
    ).body;

    return bitbucketServerTag.hash ?? null;
  }

  getTagCommit(
    baseUrl: string,
    tag: string,
    config: DigestConfig,
  ): Promise<string | null> {
    return withCache(
      {
        namespace: BitbucketServerTagsDatasource.cacheNamespace,
        key: BitbucketServerTagsDatasource.getCacheKey(
          config.registryUrl,
          config.packageName,
          `tag-${tag}`,
        ),
      },
      () => this._getTagCommit(baseUrl, tag),
    );
  }

  // getDigest fetches the latest commit for repository main branch.
  // If newValue is provided, then getTagCommit is called
  private async _getDigest(
    config: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    const { registryUrl, packageName } = config;
    const [projectKey, repositorySlug] = packageName.split('/');
    if (!registryUrl) {
      logger.debug('Missing registryUrl');
      return null;
    }

    const baseUrl = `${BitbucketServerTagsDatasource.getApiUrl(registryUrl)}projects/${projectKey}/repos/${repositorySlug}`;

    if (newValue?.length) {
      return this.getTagCommit(baseUrl, newValue, config);
    }

    const result = Result.parse(config, DigestsConfig)
      .transform(() => {
        const url = `${baseUrl}/commits?ignoreMissing=true`;

        return this.http.getJsonSafe(
          url,
          {
            paginate: true,
            limit: 1,
            maxPages: 1,
          },
          BitbucketServerCommits,
        );
      })
      .transform((commits) => {
        return commits[0]?.id;
      });

    const { val = null, err } = await result.unwrap();

    if (err instanceof ZodError) {
      logger.debug({ err }, 'bitbucket-server-tags: validation error');
      return null;
    }

    if (err) {
      this.handleGenericErrors(err);
    }

    return val;
  }

  override getDigest(
    config: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    return withCache(
      {
        namespace: BitbucketServerTagsDatasource.cacheNamespace,
        key: BitbucketServerTagsDatasource.getCacheKey(
          config.registryUrl,
          config.packageName,
          'digest',
        ),
        fallback: true,
      },
      () => this._getDigest(config, newValue),
    );
  }
}
