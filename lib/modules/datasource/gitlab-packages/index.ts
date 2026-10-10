import { defaultRegistryUrl, getApiBaseUrl } from '../../../util/gitlab/url.ts';
import { GitlabHttp } from '../../../util/http/gitlab.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { datasource } from './common.ts';
import { GitlabPackages } from './schema.ts';

// Gitlab Packages API: https://docs.gitlab.com/ee/api/packages.html

export class GitlabPackagesDatasource extends Datasource<GitlabHttp> {
  static readonly id = datasource;

  override supportsCustomRegistry(_packageName: string): boolean {
    return true;
  }

  override getDefaultRegistryUrls(_packageName: string): string[] {
    return [defaultRegistryUrl];
  }

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `created_at` field in the results.';

  constructor() {
    super(datasource, new GitlabHttp(datasource));
  }

  static getGitlabPackageApiUrl(
    registryUrl: string,
    projectName: string,
    packageName: string,
  ): string {
    const projectNameEncoded = encodeURIComponent(projectName);
    const packageNameEncoded = encodeURIComponent(packageName);

    return joinUrlParts(
      getApiBaseUrl(registryUrl),
      'projects',
      projectNameEncoded,
      `packages?package_name=${packageNameEncoded}&per_page=100`,
    );
  }

  private async fetchReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next -- should never happen */
    if (!registryUrl) {
      return null;
    }

    const [projectPart, packagePart] = packageName.split(':', 2);

    const apiUrl = GitlabPackagesDatasource.getGitlabPackageApiUrl(
      registryUrl,
      projectPart,
      packagePart,
    );

    const response = await this.fetchJson(apiUrl, GitlabPackages, {
      paginate: true,
    });

    const releases = response
      // Setting the package_name option when calling the GitLab API isn't enough to filter information about other packages
      // because this option is only implemented on GitLab > 12.9 and it only does a fuzzy search.
      .filter((pkg) => pkg.packageName === packagePart)
      .map((pkg) => pkg.release);

    return releases.length ? { releases } : null;
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return this.cached(
      {
        // TODO: types (#22198)
        key: `${config.registryUrl}-${config.packageName}`,
        fallback: true,
      },
      () => this.fetchReleases(config),
    );
  }
}
