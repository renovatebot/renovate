import { cache } from '../../util/cache/package/decorator';
import { GitlabHttp } from '../../util/http/gitlab';
import * as url from '../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { datasource } from './common';
import type { GitlabPackage } from './types';

// Gitlab Packages API: https://docs.gitlab.com/ee/api/packages.html

export class GitlabPackagesDatasource extends Datasource {
  static readonly id = datasource;

  protected http: GitlabHttp;

  caching = true;

  customRegistrySupport = true;

  defaultVersioning = 'docker';

  constructor() {
    super(datasource);
    this.http = new GitlabHttp();
  }

  static getGitlabPackageApiUrl(
    registryUrl: string,
    lookupName: string
  ): string {
    const parsedRegistryUrl = url.parseUrl(registryUrl);

    const packageName = encodeURIComponent(lookupName);

    const server = parsedRegistryUrl.origin;
    const project = encodeURIComponent(parsedRegistryUrl.pathname.substring(1)); // remove leading /

    return url.resolveBaseUrl(
      server,
      `/api/v4/projects/${project}/packages?package_name=${packageName}&per_page=100`
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
    const apiUrl = GitlabPackagesDatasource.getGitlabPackageApiUrl(
      registryUrl,
      lookupName
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
        .filter((r) => r.name === lookupName)
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
