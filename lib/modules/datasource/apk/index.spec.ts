import { vi } from 'vitest';
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
      'https://dl-cdn.alpinelinux.org/alpine/latest-stable/main/x86_64',
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
        registryUrl:
          'https://dl-cdn.alpinelinux.org/alpine/latest-stable/main/x86_64',
        releases: [
          {
            version: '1.24.0-r16',
            releaseTimestamp: '2024-04-26T22:27:14.000Z',
          },
        ],
      });
    });

    it('should use custom registry URLs', async () => {
      const config: GetPkgReleasesConfig = {
        datasource: 'apk',
        packageName: 'nginx',
        registryUrls: [
          'https://dl-cdn.alpinelinux.org/alpine/v3.19/main/x86_64',
        ],
      };

      httpMock
        .scope('https://dl-cdn.alpinelinux.org')
        .get('/alpine/v3.19/main/x86_64/APKINDEX.tar.gz')
        .replyWithFile(200, apkIndexArchivePath);

      const res = await getPkgReleases(config);
      expect(res).toEqual({
        homepage: 'https://www.nginx.org/',
        registryUrl: 'https://dl-cdn.alpinelinux.org/alpine/v3.19/main/x86_64',
        releases: [
          {
            version: '1.24.0-r16',
            releaseTimestamp: '2024-04-26T22:27:14.000Z',
          },
        ],
      });
    });
  });

  describe('getReleases with real APK data', () => {
    it('should parse multiple versions of bash package', async () => {
      const indexContent = `C:Q1vtlRfMK8sXD8JDnaOMI5kCrJG9A=
P:bash
V:5.3-r1
A:x86_64
S:756553
I:1585105
T:GNU bourne again shell
L:GPL-3.0-or-later
o:bash
m:wolfi
t:1752770415
c:e71f2e8133acebc89937730af9d9ec874acacc00
D:merged-bin so:ld-linux-x86-64.so.2 so:libc.so.6 so:libtinfo.so.6 wolfi-baselayout
p:cmd:bash=5.3-r1

C:Q1jngl4lAcPFLwCTlbCwNp+10Usd8=
P:bash
V:5.3-r2
A:x86_64
S:756557
I:1585129
T:GNU bourne again shell
L:GPL-3.0-or-later
o:bash
m:wolfi
t:1752888034
c:b96768fe1c8d6dbd5bcf00b324fa94288a2b8eff
D:merged-bin so:ld-linux-x86-64.so.2 so:libc.so.6 so:libtinfo.so.6 wolfi-baselayout
p:cmd:bash=5.3-r2

C:Q1iOqqGFee8KnAMAiigIso6EN+u7o=
P:bash
V:5.3-r3
A:x86_64
S:757735
I:1585231
T:GNU bourne again shell
L:GPL-3.0-or-later
o:bash
m:wolfi
t:1754953964
c:57df7e0f0fda63de7a35cf4da489dd46a2d4bcb3
D:merged-bin so:ld-linux-x86-64.so.2 so:libc.so.6 so:libtinfo.so.6 wolfi-baselayout
p:cmd:bash=5.3-r3`;

      // Mock HTTP request
      httpMock
        .scope('https://packages.wolfi.dev')
        .get('/os/x86_64/APKINDEX.tar.gz')
        .reply(200, Buffer.from('mock-tar-gz-data'));

      // Mock the tar.gz extraction to return our test data
      const apkDatasource = new ApkDatasource();
      const extractSpy = vi.spyOn(
        apkDatasource as any,
        'extractApkIndexFromTarGz',
      );
      extractSpy.mockResolvedValue(indexContent);

      const result = await apkDatasource.getReleases({
        packageName: 'bash',
        registryUrl: 'https://packages.wolfi.dev/os/x86_64',
      });

      expect(result).toEqual({
        homepage: undefined, // No URL field in the test data
        registryUrl: 'https://packages.wolfi.dev/os/x86_64',
        releases: [
          {
            version: '5.3-r1',
            releaseTimestamp: '2025-07-17T16:40:15.000Z',
          },
          {
            version: '5.3-r2',
            releaseTimestamp: '2025-07-19T01:20:34.000Z',
          },
          {
            version: '5.3-r3',
            releaseTimestamp: '2025-08-11T23:12:44.000Z',
          },
        ],
      });

      extractSpy.mockRestore();
    });

    it('should handle packages with URL field', async () => {
      const indexContent = `C:Q1sUvhopwmAmHD4IGg4MsoPPo2veQ=
P:nginx
V:1.28.0-r3
A:x86_64
S:520401
I:1183347
T:HTTP and reverse proxy server (stable version)
U:https://www.nginx.org/
L:BSD-2-Clause
o:nginx
m:Jakub Jirutka <jakub@jirutka.cz>
t:1747894670
c:7094d681a90006e7599ce94b8b2aed5c27b53c1d
D:/bin/sh so:libc.musl-x86_64.so.1 so:libcrypto.so.3 so:libpcre2-8.so.0 so:libssl.so.3 so:libz.so.1
p:cmd:nginx=1.28.0-r3`;

      // Mock HTTP request
      httpMock
        .scope('https://dl-cdn.alpinelinux.org')
        .get('/alpine/latest-stable/main/x86_64/APKINDEX.tar.gz')
        .reply(200, Buffer.from('mock-tar-gz-data'));

      const apkDatasource = new ApkDatasource();
      const extractSpy = vi.spyOn(
        apkDatasource as any,
        'extractApkIndexFromTarGz',
      );
      extractSpy.mockResolvedValue(indexContent);

      const result = await apkDatasource.getReleases({
        packageName: 'nginx',
        registryUrl:
          'https://dl-cdn.alpinelinux.org/alpine/latest-stable/main/x86_64',
      });

      expect(result).toEqual({
        homepage: 'https://www.nginx.org/',
        registryUrl:
          'https://dl-cdn.alpinelinux.org/alpine/latest-stable/main/x86_64',
        releases: [
          {
            version: '1.28.0-r3',
            releaseTimestamp: '2025-05-22T06:17:50.000Z',
          },
        ],
      });

      extractSpy.mockRestore();
    });

    it('should return null for unknown package', async () => {
      const indexContent = `C:Q1vtlRfMK8sXD8JDnaOMI5kCrJG9A=
P:bash
V:5.3-r1
A:x86_64
S:756553
I:1585105
T:GNU bourne again shell
L:GPL-3.0-or-later
o:bash
m:wolfi
t:1752770415
c:e71f2e8133acebc89937730af9d9ec874acacc00
D:merged-bin so:ld-linux-x86-64.so.2 so:libc.so.6 so:libtinfo.so.6 wolfi-baselayout
p:cmd:bash=5.3-r1`;

      // Mock HTTP request
      httpMock
        .scope('https://packages.wolfi.dev')
        .get('/os/x86_64/APKINDEX.tar.gz')
        .reply(200, Buffer.from('mock-tar-gz-data'));

      const apkDatasource = new ApkDatasource();
      const extractSpy = vi.spyOn(
        apkDatasource as any,
        'extractApkIndexFromTarGz',
      );
      extractSpy.mockResolvedValue(indexContent);

      const result = await apkDatasource.getReleases({
        packageName: 'unknown-package',
        registryUrl: 'https://packages.wolfi.dev/os/x86_64',
      });

      expect(result).toBeNull();

      extractSpy.mockRestore();
    });

    it('should handle packages without buildDate', async () => {
      const indexContent = `C:Q1vtlRfMK8sXD8JDnaOMI5kCrJG9A=
P:minimal-package
V:1.0.0
A:x86_64
S:1000
I:2000
T:Minimal package without build date
L:MIT
o:minimal-package
m:test@example.com
c:abc123def456`;

      // Mock HTTP request
      httpMock
        .scope('https://packages.wolfi.dev')
        .get('/os/x86_64/APKINDEX.tar.gz')
        .reply(200, Buffer.from('mock-tar-gz-data'));

      const apkDatasource = new ApkDatasource();
      const extractSpy = vi.spyOn(
        apkDatasource as any,
        'extractApkIndexFromTarGz',
      );
      extractSpy.mockResolvedValue(indexContent);

      const result = await apkDatasource.getReleases({
        packageName: 'minimal-package',
        registryUrl: 'https://packages.wolfi.dev/os/x86_64',
      });

      expect(result).toEqual({
        homepage: undefined,
        registryUrl: 'https://packages.wolfi.dev/os/x86_64',
        releases: [
          {
            version: '1.0.0',
            releaseTimestamp: undefined,
          },
        ],
      });

      extractSpy.mockRestore();
    });
  });
});
