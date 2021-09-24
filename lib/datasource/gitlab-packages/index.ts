import { cache } from '../../util/cache/package/decorator';
import { GitlabHttp } from '../../util/http/gitlab';
import { joinUrlParts } from '../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { datasource } from './common';
import type { GitlabPackage } from './types';

// Gitlab Packages API: https://docs.gitlab.com/ee/api/packages.html

export enum GitlabPackagesType {
  None = '',
  Generic = 'generic',
  Conan = 'conan',
  Maven = 'maven',
  Npm = 'npm',
  Pypi = 'pypi',
  Composer = 'composer',
  Nuget = 'nuget',
  Helm = 'helm',
  Golang = 'golang',
}

export class GitlabPackagesDatasource extends Datasource {
  static readonly id = datasource;

  protected override http: GitlabHttp;

  override caching = true;

  override customRegistrySupport = true;

  override defaultRegistryUrls = ['https://gitlab.com'];

  packageType: GitlabPackagesType;

  constructor(packageType: GitlabPackagesType) {
    super(datasource);
    this.http = new GitlabHttp();
    this.packageType = packageType;
  }

  getGitlabPackageApiUrl(
    registryUrl: string,
    projectName: string,
    packageName: string
  ): string {
    const projectNameEncoded = encodeURIComponent(projectName);
    const packageNameEncoded = encodeURIComponent(packageName);

    let extraArgs = '';

    if (this.packageType !== GitlabPackagesType.None) {
      extraArgs += '&package_type=' + this.packageType;
    }

    return joinUrlParts(
      registryUrl,
      `api/v4/projects`,
      projectNameEncoded,
      `packages?package_name=${packageNameEncoded}${extraArgs}&per_page=100`
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
    const [projectName, packageName] = lookupName.split(':', 2);

    const apiUrl = this.getGitlabPackageApiUrl(
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
