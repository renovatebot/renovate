import { GitlabHttp } from '../../util/http/gitlab';
import * as url from '../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult, Release } from '../types';
import type { GitlabPackage } from './types';
import { datasource } from './common';

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

  getGitlabPackageApiUrl(parsedRegistryUrl, lookupName): string {
    const packageName = encodeURIComponent(lookupName);

    const server = parsedRegistryUrl.origin;
    const project = encodeURIComponent(parsedRegistryUrl.pathname.substring(1)); // remove leading /

    return url.resolveBaseUrl(
      server,
      `/api/v4/projects/${project}/packages?package_name=${packageName}&per_page=100`
    );
  }

  async getReleases({
    registryUrl,
    lookupName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const parsedRegistryUrl = url.parseUrl(registryUrl);
    const server = parsedRegistryUrl.origin;
    const api_url = this.getGitlabPackageApiUrl(parsedRegistryUrl, lookupName);
    const result: ReleaseResult = {
      releases: null,
    };

    let response: GitlabPackage[];
    try {
      response = (
        await this.http.getJson<GitlabPackage[]>(api_url, { paginate: true })
      ).body;

      result.releases = response
        // Settings the package_name option when calling the Gitlab API isn't enought to filter information about other package
        // because this option is only implemented on Gitlab > 12.9 and it only do a fuzzy search.
        .filter((r) => r.name === lookupName)
        .map(({ version, created_at, _links }) => ({
          version,
          releaseTimestamp: created_at,
          registryUrl: _links
            ? url.resolveBaseUrl(server, _links?.web_path)
            : null,
        }));
    } catch (err) {
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }
}
