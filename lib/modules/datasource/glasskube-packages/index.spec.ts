import { getPkgReleases } from '..';
import { GlasskubePackagesDatasource } from '.';
import { Fixtures } from '~test/fixtures';
import * as httpMock from '~test/http-mock';

describe('modules/datasource/glasskube-packages/index', () => {
  const customRegistryUrl = 'https://packages.test.example/packages';
  const customVersionsUrl = new URL(
    `${customRegistryUrl}/cloudnative-pg/versions.yaml`,
  );
  const defaultVersionUrl = new URL(
    `${GlasskubePackagesDatasource.defaultRegistryUrl}/cloudnative-pg/versions.yaml`,
  );
  const versionsYaml = Fixtures.get('versions.yaml');
  const customPackageManifestUrl = new URL(
    `${customRegistryUrl}/cloudnative-pg/v1.23.1+1/package.yaml`,
  );
  const defaultPackageManifestUrl = new URL(
    `${GlasskubePackagesDatasource.defaultRegistryUrl}/cloudnative-pg/v1.23.1+1/package.yaml`,
  );
  const packageManifestYaml = Fixtures.get('package.yaml');
  const packageManifestNoReferencesYaml = Fixtures.get(
    'package_no_references.yaml',
  );

  it('should handle error response on versions request', async () => {
    httpMock
      .scope(customVersionsUrl.origin)
      .get(customVersionsUrl.pathname)
      .reply(500, 'internal server error');
    await expect(
      getPkgReleases({
        datasource: GlasskubePackagesDatasource.id,
        packageName: 'cloudnative-pg',
        registryUrls: [customRegistryUrl],
      }),
    ).rejects.toThrow();
  });

  it('should handle empty response on versions request', async () => {
    httpMock
      .scope(customVersionsUrl.origin)
      .get(customVersionsUrl.pathname)
      .reply(200);
    const response = await getPkgReleases({
      datasource: GlasskubePackagesDatasource.id,
      packageName: 'cloudnative-pg',
      registryUrls: [customRegistryUrl],
    });
    expect(response).toBeNull();
  });

  it('should handle error response on manifest request', async () => {
    httpMock
      .scope(customVersionsUrl.origin)
      .get(customVersionsUrl.pathname)
      .reply(200, versionsYaml);
    httpMock
      .scope(customPackageManifestUrl.origin)
      .get(customPackageManifestUrl.pathname)
      .reply(500, 'internal server error');
    await expect(
      getPkgReleases({
        datasource: GlasskubePackagesDatasource.id,
        packageName: 'cloudnative-pg',
        registryUrls: [customRegistryUrl],
      }),
    ).rejects.toThrow();
  });

  it('should handle empty response on manifest request', async () => {
    httpMock
      .scope(customVersionsUrl.origin)
      .get(customVersionsUrl.pathname)
      .reply(200, versionsYaml);
    httpMock
      .scope(customPackageManifestUrl.origin)
      .get(customPackageManifestUrl.pathname)
      .reply(200);
    const response = await getPkgReleases({
      datasource: GlasskubePackagesDatasource.id,
      packageName: 'cloudnative-pg',
      registryUrls: [customRegistryUrl],
    });
    expect(response).toBeNull();
  });

  it('should handle package manifest without references', async () => {
    httpMock
      .scope(customVersionsUrl.origin)
      .get(customVersionsUrl.pathname)
      .reply(200, versionsYaml);
    httpMock
      .scope(customPackageManifestUrl.origin)
      .get(customPackageManifestUrl.pathname)
      .reply(200, packageManifestNoReferencesYaml);
    const response = await getPkgReleases({
      datasource: GlasskubePackagesDatasource.id,
      packageName: 'cloudnative-pg',
      registryUrls: [customRegistryUrl],
    });
    expect(response).toEqual({
      registryUrl: customRegistryUrl,
      tags: { latest: 'v1.23.1+1' },
      releases: [{ version: 'v1.22.0+1' }, { version: 'v1.23.1+1' }],
    });
  });

  it('should handle package manifest with references and default url', async () => {
    httpMock
      .scope(defaultVersionUrl.origin)
      .get(defaultVersionUrl.pathname)
      .reply(200, versionsYaml);
    httpMock
      .scope(defaultPackageManifestUrl.origin)
      .get(defaultPackageManifestUrl.pathname)
      .reply(200, packageManifestYaml);
    const response = await getPkgReleases({
      datasource: GlasskubePackagesDatasource.id,
      packageName: 'cloudnative-pg',
    });
    expect(response).toEqual({
      sourceUrl: 'https://github.com/cloudnative-pg/cloudnative-pg',
      homepage: 'https://cloudnative-pg.io/',
      registryUrl: GlasskubePackagesDatasource.defaultRegistryUrl,
      tags: { latest: 'v1.23.1+1' },
      releases: [{ version: 'v1.22.0+1' }, { version: 'v1.23.1+1' }],
    });
  });

  it('should handle package manifest with references and custom url', async () => {
    httpMock
      .scope(customVersionsUrl.origin)
      .get(customVersionsUrl.pathname)
      .reply(200, versionsYaml);
    httpMock
      .scope(customPackageManifestUrl.origin)
      .get(customPackageManifestUrl.pathname)
      .reply(200, packageManifestYaml);
    const response = await getPkgReleases({
      datasource: GlasskubePackagesDatasource.id,
      packageName: 'cloudnative-pg',
      registryUrls: [customRegistryUrl],
    });
    expect(response).toEqual({
      sourceUrl: 'https://github.com/cloudnative-pg/cloudnative-pg',
      homepage: 'https://cloudnative-pg.io/',
      registryUrl: customRegistryUrl,
      tags: { latest: 'v1.23.1+1' },
      releases: [{ version: 'v1.22.0+1' }, { version: 'v1.23.1+1' }],
    });
  });
});
