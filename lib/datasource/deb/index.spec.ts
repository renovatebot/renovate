import { copyFile, mkdirp, remove, stat } from 'fs-extra';
import { getPkgReleases } from '..';
import type { GetPkgReleasesConfig } from '..';
import * as httpMock from '../../../test/http-mock';
import { GlobalConfig } from '../../config/global';
import type { DebLanguageConfig } from './types';

describe('datasource/deb/index', () => {
  describe('getReleases', () => {
    const testPackagesFile = __dirname + '/test-data/Packages.gz';
    const downloadFolder = '/tmp/renovate-cache/others/deb/download/';
    const compressedPackageFile =
      downloadFolder +
      '0b01d9df270158d22c09c85f21b0f403d31b0da3cae4930fdb305df8f7749c27.gz';
    // const extractedPackageFile =
    //   '/tmp/renovate-cache/others/deb/extract/0b01d9df270158d22c09c85f21b0f403d31b0da3cae4930fdb305df8f7749c27.txt';
    const cacheDir = '/tmp/renovate-cache/';

    GlobalConfig.set({ cacheDir: cacheDir });

    let cfg: GetPkgReleasesConfig & DebLanguageConfig; // this can be modified within the test cases

    beforeEach(async () => {
      jest.resetAllMocks();
      await remove(cacheDir);
      cfg = {
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
    });

    it('returns a valid version for the package `steam-devices` and does not require redownload', async () => {
      // copy the Packages.gz file to the appropriate location
      await mkdirp(downloadFolder);
      await copyFile(testPackagesFile, compressedPackageFile);
      const stats = await stat(compressedPackageFile);
      const ts = stats.mtime;

      httpMock
        .scope('http://ftp.debian.org')
        .head('/debian/dists/stable/non-free/binary-amd64/Packages.gz')
        .reply(304);

      const res = await getPkgReleases(cfg);
      expect(res).toBeObject();
      expect(res.releases).toHaveLength(1);

      // validate that the server was called correctly
      expect(httpMock.getTrace()).toHaveLength(1);
      const modifiedTs = httpMock.getTrace()[0].headers['if-modified-since'];
      expect(modifiedTs).toBeDefined();
      expect(modifiedTs).toEqual(ts.toUTCString());
    });

    describe('without local version', () => {
      beforeEach(() => {
        httpMock
          .scope('http://ftp.debian.org')
          .get('/debian/dists/stable/non-free/binary-amd64/Packages.gz')
          .replyWithFile(200, testPackagesFile);
      });

      it('returns a valid version for the package `steam-devices`', async () => {
        const res = await getPkgReleases(cfg);
        expect(res).toBeObject();
        expect(res.releases).toHaveLength(1);
      });

      it('returns null for an unknown package', async () => {
        cfg.depName = 'you-will-never-find-me';
        const res = await getPkgReleases(cfg);
        expect(res).toBeNull();
      });
    });
  });
});
