import type { PackageCacheNamespace } from '../../../util/cache/package/types.ts';
import { GiteaHttp } from '../../../util/http/gitea.ts';
import { parseUrl } from '../../../util/url.ts';
import { GitHostTagsDigestDatasource } from '../git-host-tags.ts';
import { Commits, Tag } from './schema.ts';
import { getApiUrl, getSourceUrl } from './util.ts';

/**
 * Shared implementation of the datasources which speak the Gitea API.
 *
 * Forgejo is a fork of Gitea and serves the same API, so the Forgejo
 * datasources extend the Gitea ones and only differ in their id, their default
 * registry URL and their cache namespace. The digest lookup is the same for
 * tags and releases, so it lives here and a subclass only fetches and maps the
 * releases of its own endpoint.
 */
export abstract class GiteaDatasource extends GitHostTagsDigestDatasource<GiteaHttp> {
  static readonly defaultRegistryUrls = ['https://gitea.com'];

  override getDefaultRegistryUrls(_packageName: string): string[] {
    return GiteaDatasource.defaultRegistryUrls;
  }

  protected abstract override readonly cacheNamespace: PackageCacheNamespace;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote: string;
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  /**
   * @param releaseTimestampField the field of the endpoint `getReleases()` reads
   * which the release timestamp comes from, rendered into the generated
   * documentation.
   * @param http lets a subclass for another Gitea-compatible host supply a
   * client scoped to its own host type.
   */
  protected constructor(
    id: string,
    releaseTimestampField: string,
    http: GiteaHttp = new GiteaHttp(id),
  ) {
    super(id, http);
    this.releaseTimestampNote = `The release timestamp is determined from the \`${releaseTimestampField}\` field in the results.`;
  }

  static getSourceUrl(packageName: string, registryUrl?: string): string {
    return getSourceUrl(
      packageName,
      registryUrl ?? this.defaultRegistryUrls[0],
    );
  }

  /**
   * Browser URL of the repository `packageName` on `registryUrl`, or on the
   * default registry.
   */
  protected getSourceUrl(packageName: string, registryUrl?: string): string {
    return getSourceUrl(packageName, this.getRegistryUrl(registryUrl));
  }

  /** Falls back to the default registry URL when none is configured. */
  protected getRegistryUrl(registryUrl?: string): string {
    return registryUrl ?? this.getDefaultRegistryUrls('')[0];
  }

  /**
   * Only results from the public default instance may be written to the
   * shared package cache; a self-hosted instance may serve private
   * repositories.
   */
  protected override isCacheable(registryUrl: string): boolean {
    return (
      parseUrl(registryUrl)?.hostname ===
      parseUrl(this.getDefaultRegistryUrls('')[0])?.hostname
    );
  }

  // fetchTagCommit fetches the commit hash for the specified tag
  protected async fetchTagCommit(
    registryUrl: string | undefined,
    repo: string,
    tag: string,
  ): Promise<string | null> {
    const url = `${getApiUrl(this.getRegistryUrl(registryUrl))}repos/${repo}/tags/${tag}`;

    const { body } = await this.http.getJson(url, Tag);

    return body.commit.sha;
  }

  // fetchLatestCommit fetches the latest commit of the main branch
  protected async fetchLatestCommit(
    registryUrl: string | undefined,
    repo: string,
  ): Promise<string | null> {
    const url = `${getApiUrl(
      this.getRegistryUrl(registryUrl),
    )}repos/${repo}/commits?stat=false&verification=false&files=false&page=1&limit=1`;
    const { body } = await this.http.getJson(url, Commits);

    if (body.length === 0) {
      return null;
    }

    return body[0].sha;
  }
}
