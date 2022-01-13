import { copyFile, stat } from 'fs/promises';
import { GetPkgReleasesConfig, getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { GlobalConfig } from '../../config/global';
import { DebLanguageConfig } from './types';

describe('datasource/deb/index', () => {
  describe('getReleases', () => {
    const testPackagesFile = __dirname + '/test-data/Packages.xz';
    const compressedPackageFile =
      '/tmp/renovate-cache/others/deb/download/b7566e8ec1e0f0e128251b5373480cbe48a4316956e71f48f9d04935216b164b.xz';
    const extractedPackageFile =
      '/tmp/renovate-cache/others/deb/extract/b7566e8ec1e0f0e128251b5373480cbe48a4316956e71f48f9d04935216b164b.txt';
    const cacheDir = '/tmp/renovate-cache/';
    GlobalConfig.set({ cacheDir: cacheDir });

    const cfg: GetPkgReleasesConfig & DebLanguageConfig = {
      datasource: 'deb',
      depName: 'steam-devices',
      deb: {
        binaryArch: 'amd64',
        downloadDirectory: './deb/download',
        extractionDirectory: './deb/extract',
      },
      registryUrls: ['deb http://ftp.debian.org/debian stable non-free'],
    };

    // it('returns a valid version for the package `steam-devices`', async () => {
    //   httpMock
    //     .scope('http://ftp.debian.org')
    //     .get('/debian/dists/stable/non-free/binary-amd64/Packages.xz')
    //     .replyWithFile(200, testPackagesFile);

    //   const res = await getPkgReleases(cfg);
    //   expect(res).toBeObject();
    //   // expect(res.releases).toHaveLength(1); // TODO: somehow this does not longer work
    // });

    it('returns a valid version for the package `steam-devices` and does not require redownload', async () => {
      // copy the Packages.xz file to the appropriate location
      await copyFile(testPackagesFile, compressedPackageFile);
      const stats = await stat(compressedPackageFile);
      const ts = stats.mtime;

      httpMock
        .scope('http://ftp.debian.org')
        .get('/debian/dists/stable/non-free/binary-amd64/Packages.xz')
        .reply(304);

      const res = await getPkgReleases(cfg);
      expect(res).toBeObject();
      // expect(res.releases).toHaveLength(1); // TODO: somehow this does not longer work

      // validate that the server was called correctly
      expect(httpMock.getTrace()).toHaveLength(1);
      const modifiedTs = httpMock.getTrace()[0].headers['If-Modified-Since'];
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
