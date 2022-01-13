import { mkdirSync, rmdirSync } from 'fs';
import { copyFile, stat } from 'fs/promises';
import { GetPkgReleasesConfig, getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { GlobalConfig } from '../../config/global';
import { DebLanguageConfig } from './types';

describe('datasource/deb/index', () => {
  describe('getReleases', () => {
    const testPackagesFile = __dirname + '/test-data/Packages.gz';
    const downloadFolder = '/tmp/renovate-cache/others/deb/download/';
    const compressedPackageFile =
      downloadFolder +
      '0b01d9df270158d22c09c85f21b0f403d31b0da3cae4930fdb305df8f7749c27.gz';
    const extractedPackageFile =
      '/tmp/renovate-cache/others/deb/extract/0b01d9df270158d22c09c85f21b0f403d31b0da3cae4930fdb305df8f7749c27.txt';
    const cacheDir = '/tmp/renovate-cache/';

    rmdirSync(cacheDir, { force: true, recursive: true });

    GlobalConfig.set({ cacheDir: cacheDir });

    const cfg: GetPkgReleasesConfig & DebLanguageConfig = {
      datasource: 'deb',
      depName: 'steam-devices',
      deb: {
        binaryArch: 'amd64',
        downloadDirectory: './deb/download',
        extractionDirectory: './deb/extract',
      },
      registryUrls: [
        'http://ftp.debian.org/debian?suite=stable&components=non-free',
      ],
    };

    // it('returns a valid version for the package `steam-devices`', async () => {
    //   httpMock
    //     .scope('http://ftp.debian.org')
    //     .get('/debian/dists/stable/non-free/binary-amd64/Packages.gz')
    //     .replyWithFile(200, testPackagesFile);

    //   const res = await getPkgReleases(cfg);
    //   expect(res).toBeObject();
    //   // expect(res.releases).toHaveLength(1); // TODO: somehow this does not longer work
    // });

    it('returns a valid version for the package `steam-devices` and does not require redownload', async () => {
      // copy the Packages.gz file to the appropriate location
      mkdirSync(downloadFolder, { recursive: true });
      await copyFile(testPackagesFile, compressedPackageFile);
      const stats = await stat(compressedPackageFile);
      const ts = stats.mtime;

      httpMock
        .scope('http://ftp.debian.org')
        .head('/debian/dists/stable/non-free/binary-amd64/Packages.gz')
        .reply(304);

      const res = await getPkgReleases(cfg);
      expect(res).toBeObject();
      // expect(res.releases).toHaveLength(1); // TODO: somehow this does not longer work

      // validate that the server was called correctly
      expect(httpMock.getTrace()).toHaveLength(1);
      const modifiedTs = httpMock.getTrace()[0].headers['if-modified-since'];
      expect(modifiedTs).toBeDefined();
      expect(modifiedTs).toEqual(ts.toUTCString());
    });

    // it('returns null for a package not found in the standard Debian package repo', async () => {
    //   const cfg: GetPkgReleasesConfig & DebLanguageConfig = {
    //     datasource: 'deb',
    //     depName: 'you-will-never-find-me',
    //     deb: {
    //       binaryArch: 'amd64',
    //       downloadDirectory: '/tmp/deb/download',
    //       extractionDirectory: '/tmp/deb/extract',
    //     },
    //   };
    //   const res = await getPkgReleases(cfg);
    //   expect(res).toBeNull();
    // });

    // it('returns null when repo contains missing component', async () => {
    //   const cfg: GetPkgReleasesConfig & DebLanguageConfig = {
    //     datasource: 'deb',
    //     depName: 'curl',
    //     deb: {
    //       binaryArch: 'amd64',
    //       downloadDirectory: '/tmp/deb/download',
    //       extractionDirectory: '/tmp/deb/extract',
    //     },
    //     registryUrls: ['deb https://ftp.debian.org/debian stable'],
    //   };
    //   const res = await getPkgReleases(cfg);
    //   expect(res).toBeNull();
    // });
  });
});
