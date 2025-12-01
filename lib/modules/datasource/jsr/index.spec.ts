import * as httpMock from '../../../../test/http-mock';
import type { Timestamp } from '../../../util/timestamp';
import { MINIMUM_RELEASE_TIMESTAMP } from './schema';
import { JsrDatasource } from '.';

const jsrPackageMetadataResponse = {
  latest: '0.0.2',
  versions: {
    // Mixed createdAt fields for testing:
    // Actually, it's either all there or none.
    // has no createdAt (should use fallback MINIMUM_RELEASE_TIMESTAMP)
    '0.0.1': {},
    // has explicit createdAt (should use actual timestamp)
    '0.0.2': { createdAt: '2025-11-15T00:00:00.000Z' },
  },
} as {
  latest: string;
  versions: Record<string, { createdAt?: string; yanked?: boolean }>;
};

describe('modules/datasource/jsr/index', () => {
  const jsr = new JsrDatasource();

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
    expect(res).toMatchObject({
      homepage: 'https://jsr.io/@scope/package-name',
      registryUrl: 'https://jsr.io/',
      releases: [
        {
          version: '0.0.1',
          releaseTimestamp: MINIMUM_RELEASE_TIMESTAMP,
        },
        {
          isLatest: true,
          version: '0.0.2',
          releaseTimestamp: '2025-11-15T00:00:00.000Z' as Timestamp,
        },
      ],
    });
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
    expect(res).toMatchObject({
      homepage: 'https://jsr.io/@scope/package-name',
      registryUrl: 'https://jsr.io/',
      releases: [
        {
          isDeprecated: true,
          version: '0.0.1',
          releaseTimestamp: MINIMUM_RELEASE_TIMESTAMP,
        },
        {
          isLatest: true,
          version: '0.0.2',
          releaseTimestamp: '2025-11-15T00:00:00.000Z' as Timestamp,
        },
      ],
    });
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
