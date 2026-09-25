import type { NonEmptyArray } from '../../../types/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import {
  defaultRegistryUrl,
  getApiBaseUrl,
  getSourceUrl,
} from '../../../util/gitlab/url.ts';
import { GitlabHttp } from '../../../util/http/gitlab.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { RegistryDatasource } from '../datasource.ts';
import type {
  RegistryGetReleasesConfig,
  Release,
  ReleaseResult,
} from '../types.ts';
import { GitlabReleases } from './schema.ts';

export class GitlabReleasesDatasource extends RegistryDatasource<GitlabHttp> {
  static readonly id = 'gitlab-releases';

  override getDefaultRegistryUrls(_packageName: string): NonEmptyArray<string> {
    return [defaultRegistryUrl];
  }

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `released_at` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined by using the `packageName` and `registryUrl`.';

  constructor() {
    super(
      GitlabReleasesDatasource.id,
      new GitlabHttp(GitlabReleasesDatasource.id),
    );
  }

  private async _getReleases({
    registryUrl,
    packageName,
  }: RegistryGetReleasesConfig): Promise<ReleaseResult | null> {
    const urlEncodedRepo = encodeURIComponent(packageName);
    const apiUrl = joinUrlParts(
      getApiBaseUrl(registryUrl),
      'projects',
      urlEncodedRepo,
      'releases',
    );

    const gitlabReleasesResponse = await this.fetchJson(apiUrl, GitlabReleases);

    return {
      sourceUrl: getSourceUrl(packageName, registryUrl),
      releases: gitlabReleasesResponse.map(({ tag_name, released_at }) => {
        const release: Release = {
          registryUrl,
          gitRef: tag_name,
          version: tag_name,
          releaseTimestamp: asTimestamp(released_at),
        };
        return release;
      }),
    };
  }

  getReleases(
    config: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${GitlabReleasesDatasource.id}`,
        key: `${config.registryUrl}/${config.packageName}`,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }
}
