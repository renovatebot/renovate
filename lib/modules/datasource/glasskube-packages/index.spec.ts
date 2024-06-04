import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { GlasskubePackagesDatasource } from '.';

describe('modules/datasource/glasskube-packages/index', () => {
  const versionsUrl = new URL(
    `${GlasskubePackagesDatasource.defaultRegistryUrl}/cloudnative-pg/versions.yaml`,
  );
  const versionsYaml = Fixtures.get('versions.yaml');
  const packageManifestUrl = new URL(
    `${GlasskubePackagesDatasource.defaultRegistryUrl}/cloudnative-pg/v1.23.1+1/package.yaml`,
  );
  const packageManifestYaml = Fixtures.get('package.yaml');
  const packageManifestNoReferencesYaml = Fixtures.get(
    'package_no_references.yaml',
  );

  it('should handle error response on versions request', async () => {
    httpMock
      .scope(versionsUrl.origin)
      .get(versionsUrl.pathname)
      .reply(500, 'internal server error');
    const response = await getPkgReleases({
      datasource: GlasskubePackagesDatasource.id,
      packageName: 'cloudnative-pg',
      registryUrls: [GlasskubePackagesDatasource.defaultRegistryUrl],
    });
    expect(response).toBeNull();
  });

  it('should handle empty response on versions request', async () => {
    httpMock.scope(versionsUrl.origin).get(versionsUrl.pathname).reply(200);
    const response = await getPkgReleases({
      datasource: GlasskubePackagesDatasource.id,
      packageName: 'cloudnative-pg',
      registryUrls: [GlasskubePackagesDatasource.defaultRegistryUrl],
    });
    expect(response).toBeNull();
  });

  it('should handle error response on manifest request', async () => {
    httpMock
      .scope(versionsUrl.origin)
      .get(versionsUrl.pathname)
      .reply(200, versionsYaml);
    httpMock
      .scope(packageManifestUrl.origin)
      .get(packageManifestUrl.pathname)
      .reply(500, 'internal server error');
    const response = await getPkgReleases({
      datasource: GlasskubePackagesDatasource.id,
      packageName: 'cloudnative-pg',
      registryUrls: [GlasskubePackagesDatasource.defaultRegistryUrl],
    });
    expect(response).toEqual({
      registryUrl: GlasskubePackagesDatasource.defaultRegistryUrl,
      releases: [
        {
          version: 'v1.22.0+1',
          isStable: false,
          registryUrl: GlasskubePackagesDatasource.defaultRegistryUrl,
        },
        {
          version: 'v1.23.1+1',
          isStable: true,
          registryUrl: GlasskubePackagesDatasource.defaultRegistryUrl,
        },
      ],
    });
  });

  it('should handle empty response on manifest request', async () => {
    httpMock
      .scope(versionsUrl.origin)
      .get(versionsUrl.pathname)
      .reply(200, versionsYaml);
    httpMock
      .scope(packageManifestUrl.origin)
      .get(packageManifestUrl.pathname)
      .reply(200);
    const response = await getPkgReleases({
      datasource: GlasskubePackagesDatasource.id,
      packageName: 'cloudnative-pg',
      registryUrls: [GlasskubePackagesDatasource.defaultRegistryUrl],
    });
    expect(response).toEqual({
      registryUrl: GlasskubePackagesDatasource.defaultRegistryUrl,
      releases: [
        {
          version: 'v1.22.0+1',
          isStable: false,
          registryUrl: GlasskubePackagesDatasource.defaultRegistryUrl,
        },
        {
          version: 'v1.23.1+1',
          isStable: true,
          registryUrl: GlasskubePackagesDatasource.defaultRegistryUrl,
        },
      ],
    });
  });

  it('should handle package manifest without references', async () => {
    httpMock
      .scope(versionsUrl.origin)
      .get(versionsUrl.pathname)
      .reply(200, versionsYaml);
    httpMock
      .scope(packageManifestUrl.origin)
      .get(packageManifestUrl.pathname)
      .reply(200, packageManifestNoReferencesYaml);
    const response = await getPkgReleases({
      datasource: GlasskubePackagesDatasource.id,
      packageName: 'cloudnative-pg',
      registryUrls: [GlasskubePackagesDatasource.defaultRegistryUrl],
    });
    expect(response).toEqual({
      registryUrl: GlasskubePackagesDatasource.defaultRegistryUrl,
      releases: [
        {
          version: 'v1.22.0+1',
          isStable: false,
          registryUrl: GlasskubePackagesDatasource.defaultRegistryUrl,
        },
        {
          version: 'v1.23.1+1',
          isStable: true,
          registryUrl: GlasskubePackagesDatasource.defaultRegistryUrl,
        },
      ],
    });
  });

  it('should handle package manifest with references', async () => {
    httpMock
      .scope(versionsUrl.origin)
      .get(versionsUrl.pathname)
      .reply(200, versionsYaml);
    httpMock
      .scope(packageManifestUrl.origin)
      .get(packageManifestUrl.pathname)
      .reply(200, packageManifestYaml);
    const response = await getPkgReleases({
      datasource: GlasskubePackagesDatasource.id,
      packageName: 'cloudnative-pg',
      registryUrls: [GlasskubePackagesDatasource.defaultRegistryUrl],
    });
    expect(response).toEqual({
      sourceUrl: 'https://github.com/cloudnative-pg/cloudnative-pg',
      homepage: 'https://cloudnative-pg.io/',
      registryUrl: GlasskubePackagesDatasource.defaultRegistryUrl,
      releases: [
        {
          version: 'v1.22.0+1',
          isStable: false,
          registryUrl: GlasskubePackagesDatasource.defaultRegistryUrl,
        },
        {
          version: 'v1.23.1+1',
          isStable: true,
          registryUrl: GlasskubePackagesDatasource.defaultRegistryUrl,
        },
      ],
    });
  });
});
