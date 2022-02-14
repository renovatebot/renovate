import { copyFile, mkdirp, remove, stat } from 'fs-extra';
import { getPkgReleases } from '..';
import type { GetPkgReleasesConfig } from '..';
import * as httpMock from '../../../test/http-mock';
import { GlobalConfig } from '../../config/global';
import { DebDatasource } from '.';

describe('datasource/deb/index', () => {
  describe('getReleases', () => {
    const testPackagesFile = __dirname + '/test-data/Packages.gz';
    const extractedTestFile = __dirname + '/test-data/Packages';
    const cacheDir = '/tmp/renovate-cache/';
    // const downloadFolder =
    //   cacheDir + 'others/' + DebDatasource.downloadDirectory + '/';
    const extractionFolder =
      cacheDir + 'others/' + DebDatasource.cacheSubDir + '/';
    // const compressedPackageFile =
    //   downloadFolder +
    //   '0b01d9df270158d22c09c85f21b0f403d31b0da3cae4930fdb305df8f7749c27.gz';
    const extractedPackageFile =
      extractionFolder +
      '0b01d9df270158d22c09c85f21b0f403d31b0da3cae4930fdb305df8f7749c27.txt';

    GlobalConfig.set({ cacheDir: cacheDir });

    let cfg: GetPkgReleasesConfig; // this can be modified within the test cases

    beforeEach(async () => {
      jest.resetAllMocks();
      await remove(cacheDir);
      cfg = {
        datasource: 'deb',
        depName: 'steam-devices',
        registryUrls: [
          'http://ftp.debian.org/debian?suite=stable&components=non-free&binaryArch=amd64',
        ],
      };
    });

    it('returns a valid version for the package `steam-devices` and does not require redownload', async () => {
      // copy the Packages file to the appropriate location
      await mkdirp(extractionFolder);
      await copyFile(extractedTestFile, extractedPackageFile);
      const stats = await stat(extractedPackageFile);
      const ts = stats.ctime;

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

      it('works for two releases of `steam-devices` in two components', async () => {
        const testPackagesFile2 = __dirname + '/test-data/Packages2.gz';

        httpMock
          .scope('http://ftp.debian.org')
          .get('/debian/dists/stable/non-free-second/binary-amd64/Packages.gz')
          .replyWithFile(200, testPackagesFile2);

        // overwrite the previously set registryUrls to have two components
        cfg.registryUrls = [
          'http://ftp.debian.org/debian?suite=stable&components=non-free,non-free-second&binaryArch=amd64',
        ];

        const res = await getPkgReleases(cfg);
        expect(res).toBeObject();
        expect(res.releases).toHaveLength(2);
      });
    });

    describe('without server response', () => {
      beforeEach(() => {
        httpMock
          .scope('http://ftp.debian.org')
          .get('/debian/dists/stable/non-free/binary-amd64/Packages.gz')
          .reply(404);
      });

      it('returns null for the package', async () => {
        cfg.depName = 'you-will-never-find-me';
        const res = await getPkgReleases(cfg);
        expect(res).toBeNull();
      });
    });

    it('supports specifying a custom binary arch', async () => {
      httpMock
        .scope('http://ftp.debian.org')
        .get('/debian/dists/stable/non-free/binary-riscv/Packages.gz')
        .replyWithFile(200, testPackagesFile);

      cfg.registryUrls = [
        'http://ftp.debian.org/debian?suite=stable&components=non-free&binaryArch=riscv',
      ];

      const res = await getPkgReleases(cfg);
      expect(res).toBeObject();
      expect(res.releases).toHaveLength(1);
    });
  });
});
