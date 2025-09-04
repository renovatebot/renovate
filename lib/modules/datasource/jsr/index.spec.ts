import * as httpMock from '../../../../test/http-mock';
import { GlobalConfig } from '../../../config/global';
import * as hostRules from '../../../util/host-rules';
import { JsrDatasource } from '.';

let jsrPackageMetadataResponse: any;

describe('modules/datasource/jsr/index', () => {
  const jsr = new JsrDatasource();

  beforeEach(() => {
    GlobalConfig.reset();
    hostRules.clear();
    jsrPackageMetadataResponse = {
      scope: 'scope',
      name: 'package-name',
      latest: '0.0.2',
      versions: {
        '0.0.1': {},
        '0.0.2': {},
      },
    };
  });

  it('should return null for invalid package name', async () => {
    const res = await jsr.getReleases({
      packageName: 'invalid',
      registryUrl: jsr.defaultRegistryUrls[0],
    });
    expect(res).toBeNull();
  });

  it('should return null for no versions', async () => {
    const missingVersions = { ...jsrPackageMetadataResponse };
    missingVersions.versions = {};
    httpMock
      .scope(jsr.defaultRegistryUrls[0])
      .get('/@scope/package-name/meta.json')
      .reply(200, missingVersions);
    const res = await jsr.getReleases({
      packageName: '@scope/package-name',
      registryUrl: jsr.defaultRegistryUrls[0],
    });
    expect(res).toBeNull();
  });

  it('should fetch package info from jsr', async () => {
    httpMock
      .scope(jsr.defaultRegistryUrls[0])
      .get('/@scope/package-name/meta.json')
      .reply(200, jsrPackageMetadataResponse, {
        'Cache-control': 'public, expires=300',
      });
    const res = await jsr.getReleases({
      packageName: '@scope/package-name',
      registryUrl: jsr.defaultRegistryUrls[0],
    });
    expect(res).toMatchSnapshot();
  });

  it('contains yanked versions', async () => {
    jsrPackageMetadataResponse.versions['0.0.1'].yanked = true;
    httpMock
      .scope(jsr.defaultRegistryUrls[0])
      .get('/@scope/package-name/meta.json')
      .reply(200, jsrPackageMetadataResponse);
    const res = await jsr.getReleases({
      packageName: '@scope/package-name',
      registryUrl: jsr.defaultRegistryUrls[0],
    });
    expect(res).toMatchSnapshot();
  });

  it('should return null if lookup fails', async () => {
    httpMock
      .scope(jsr.defaultRegistryUrls[0])
      .get('/@scope/package-name/meta.json')
      .reply(404);
    await expect(
      jsr.getReleases({
        packageName: '@scope/package-name',
        registryUrl: jsr.defaultRegistryUrls[0],
      }),
    ).rejects.toThrow();
  });

  it('should throw error for unparseable', async () => {
    httpMock
      .scope(jsr.defaultRegistryUrls[0])
      .get('/@scope/package-name/meta.json')
      .reply(200, 'oops');
    await expect(
      jsr.getReleases({
        packageName: '@scope/package-name',
        registryUrl: jsr.defaultRegistryUrls[0],
      }),
    ).rejects.toThrow();
  });
});
