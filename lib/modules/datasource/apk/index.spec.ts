import { getPkgReleases } from '..';
import type { GetPkgReleasesConfig } from '../types';
import { ApkDatasource } from '.';
import { Fixtures } from '~test/fixtures';
import * as httpMock from '~test/http-mock';

describe('modules/datasource/apk/index', () => {
  const apkIndexArchivePath = Fixtures.getPath('APKINDEX.tar.gz');
  const apkDatasource = new ApkDatasource();

  it('should export ApkDatasource', () => {
    expect(ApkDatasource).toBeDefined();
  });

  it('should have correct id', () => {
    expect(ApkDatasource.id).toBe('apk');
  });

  it('should have default registry URLs', () => {
    expect(apkDatasource.defaultRegistryUrls).toEqual([
      'https://dl-cdn.alpinelinux.org/alpine/latest-stable/main',
    ]);
  });

  it('should support custom registries', () => {
    expect(apkDatasource.customRegistrySupport).toBe(true);
  });

  describe('getReleases', () => {
    it('should return null for unknown package', async () => {
      const config: GetPkgReleasesConfig = {
        datasource: 'apk',
        packageName: 'unknown-package',
      };
      httpMock
        .scope('https://dl-cdn.alpinelinux.org')
        .get('/alpine/latest-stable/main/x86_64/APKINDEX.tar.gz')
        .replyWithFile(200, apkIndexArchivePath);

      const res = await getPkgReleases(config);
      expect(res).toBeNull();
    });

    it('should use default registry URLs', async () => {
      const config: GetPkgReleasesConfig = {
        datasource: 'apk',
        packageName: 'nginx',
      };

      httpMock
        .scope('https://dl-cdn.alpinelinux.org')
        .get('/alpine/latest-stable/main/x86_64/APKINDEX.tar.gz')
        .replyWithFile(200, apkIndexArchivePath);

      const res = await getPkgReleases(config);
      expect(res).toEqual({
        homepage: 'https://www.nginx.org/',
        registryUrl: 'https://dl-cdn.alpinelinux.org/alpine/latest-stable/main',
        releases: [{ version: '1.24.0-r16' }],
      });
    });

    it('should use custom registry URLs', async () => {
      const config: GetPkgReleasesConfig = {
        datasource: 'apk',
        packageName: 'nginx',
        registryUrls: ['https://dl-cdn.alpinelinux.org/alpine/v3.19/main'],
      };

      httpMock
        .scope('https://dl-cdn.alpinelinux.org')
        .get('/alpine/v3.19/main/x86_64/APKINDEX.tar.gz')
        .replyWithFile(200, apkIndexArchivePath);

      const res = await getPkgReleases(config);
      expect(res).toEqual({
        homepage: 'https://www.nginx.org/',
        registryUrl: 'https://dl-cdn.alpinelinux.org/alpine/v3.19/main',
        releases: [{ version: '1.24.0-r16' }],
      });
    });
  });
});
