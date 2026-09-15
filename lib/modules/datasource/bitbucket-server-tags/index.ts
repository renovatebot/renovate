import { logger } from '../../../logger/index.ts';
import { BitbucketServerHttp } from '../../../util/http/bitbucket-server.ts';
import { regEx } from '../../../util/regex.ts';
import { ensureTrailingSlash } from '../../../util/url.ts';
import { GitHostTagsDigestDatasource } from '../git-host-tags.ts';
import type { DigestConfig, GetReleasesConfig, GitHostTag } from '../types.ts';
import {
  BitbucketServerCommits,
  BitbucketServerTag,
  BitbucketServerTags,
} from './schema.ts';

export class BitbucketServerTagsDatasource extends GitHostTagsDigestDatasource<BitbucketServerHttp> {
  static readonly id = 'bitbucket-server-tags';

  constructor() {
    super(
      BitbucketServerTagsDatasource.id,
      new BitbucketServerHttp(BitbucketServerTagsDatasource.id),
    );
  }

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  static getRegistryURL(registryUrl: string): string {
    return registryUrl?.replace(regEx(/\/rest\/api\/1.0$/), '');
  }

  static getApiUrl(registryUrl: string): string {
    const res = BitbucketServerTagsDatasource.getRegistryURL(registryUrl);
    return `${ensureTrailingSlash(res)}rest/api/1.0/`;
  }

  getRegistryUrl(registryUrl?: string): string {
    return BitbucketServerTagsDatasource.getRegistryURL(registryUrl ?? '');
  }

  getSourceUrl(packageName: string, registryUrl?: string): string {
    const [projectKey, repositorySlug] = packageName.split('/');
    const url = this.getRegistryUrl(registryUrl);
    return `${ensureTrailingSlash(url)}projects/${projectKey}/repos/${repositorySlug}`;
  }

  /** REST API base URL of the repository. */
  private getRepoApiUrl(registryUrl: string, packageName: string): string {
    const [projectKey, repositorySlug] = packageName.split('/');
    return `${BitbucketServerTagsDatasource.getApiUrl(registryUrl)}projects/${projectKey}/repos/${repositorySlug}`;
  }

  // fetchTags fetches list of tags for the repository
  protected async fetchTags(
    config: GetReleasesConfig,
  ): Promise<GitHostTag[] | null> {
    const { registryUrl, packageName } = config;
    if (!registryUrl) {
      logger.debug('Missing registryUrl');
      return null;
    }

    const url = `${this.getRepoApiUrl(registryUrl, packageName)}/tags`;

    const tags = await this.fetchJsonOrNull(url, BitbucketServerTags, {
      paginate: true,
    });
    if (!tags) {
      return null;
    }

    return tags.map(({ displayId, hash }) => ({
      version: displayId,
      newDigest: hash ?? undefined,
    }));
  }

  protected override fetchDigest(
    config: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    if (!config.registryUrl) {
      logger.debug('Missing registryUrl');
      return Promise.resolve(null);
    }

    return super.fetchDigest(config, newValue);
  }

  // fetchTagCommit fetches the commit hash for the specified tag
  protected async fetchTagCommit(
    registryUrl: string | undefined,
    repo: string,
    tag: string,
  ): Promise<string | null> {
    const baseUrl = this.getRepoApiUrl(registryUrl!, repo);
    const bitbucketServerTag = (
      await this.http.getJson(`${baseUrl}/tags/${tag}`, BitbucketServerTag)
    ).body;

    return bitbucketServerTag.hash ?? null;
  }

  // fetchLatestCommit fetches the latest commit for the repository main branch
  protected async fetchLatestCommit(
    registryUrl: string | undefined,
    repo: string,
  ): Promise<string | null> {
    const baseUrl = this.getRepoApiUrl(registryUrl!, repo);

    const url = `${baseUrl}/commits?ignoreMissing=true`;

    const commits = await this.fetchJsonOrNull(url, BitbucketServerCommits, {
      paginate: true,
      limit: 1,
      maxPages: 1,
    });

    return commits?.[0]?.id ?? null;
  }
}
