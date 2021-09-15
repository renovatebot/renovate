import { cache } from '../../util/cache/package/decorator';
import { GitlabHttp } from '../../util/http/gitlab';
import { joinUrlParts } from '../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { datasource } from './common';
import type { GitlabPackage } from './types';

// Gitlab Packages API: https://docs.gitlab.com/ee/api/packages.html

export class GitlabPackagesDatasource extends Datasource {
  static readonly id = datasource;

  protected override http: GitlabHttp;

  override caching = true;

  override customRegistrySupport = true;

  override defaultRegistryUrls = ['https://gitlab.com'];

  constructor() {
    super(datasource);
    this.http = new GitlabHttp();
  }

  static getGitlabPackageApiUrl(
    registryUrl: string,
    projectName: string,
    packageName: string
  ): string {
    const projectNameEncoded = encodeURIComponent(projectName);
    const packageNameEncoded = encodeURIComponent(packageName);

    return joinUrlParts(
      registryUrl,
      `api/v4/projects`,
      projectNameEncoded,
      `packages?package_name=${packageNameEncoded}&per_page=100`
    );
  }

  @cache({
    namespace: `datasource-${datasource}`,
    key: ({ registryUrl, lookupName }: GetReleasesConfig) =>
      `${registryUrl}-${lookupName}`,
  })
  async getReleases({
    registryUrl,
    lookupName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const split = lookupName.split(':', 2);
    const projectName = split[0];
    const packageName = split[1];

    const apiUrl = GitlabPackagesDatasource.getGitlabPackageApiUrl(
      registryUrl,
      projectName,
      packageName
    );

    const result: ReleaseResult = {
      releases: null,
    };

    let response: GitlabPackage[];
    try {
      response = (
        await this.http.getJson<GitlabPackage[]>(apiUrl, { paginate: true })
      ).body;

      result.releases = response
        // Setting the package_name option when calling the GitLab API isn't enough to filter information about other packages
        // because this option is only implemented on GitLab > 12.9 and it only does a fuzzy search.
        .filter((r) => r.name === packageName)
        .map(({ version, created_at }) => ({
          version,
          releaseTimestamp: created_at,
        }));
    } catch (err) {
      this.handleGenericErrors(err);
    }

    return result.releases?.length ? result : null;
  }
}
