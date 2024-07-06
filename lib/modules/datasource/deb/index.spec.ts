import { createHash } from 'crypto';
import { copyFile, stat } from 'fs-extra';
import { DirectoryResult, dir } from 'tmp-promise';
import upath from 'upath';
import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { fs } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { GetPkgReleasesConfig } from '../types';
import { DebDatasource } from '.';

const fixturePackagesArchivePath = Fixtures.getPath(`Packages.gz`);
const fixturePackagesArchivePath2 = Fixtures.getPath(`Packages2.gz`);
const fixturePackagesPath = Fixtures.getPath(`Packages`);

describe('modules/datasource/deb/index', () => {
  let debDatasource: DebDatasource;
  let cacheDir: DirectoryResult;
  let cfg: GetPkgReleasesConfig;
  let extractionFolder: string;
  let extractedPackageFile: string;

  beforeEach(async () => {
    jest.resetAllMocks();
    debDatasource = new DebDatasource();
    cacheDir = await dir({ unsafeCleanup: true });
    GlobalConfig.set({ cacheDir: cacheDir.path });

    extractionFolder = await fs.ensureCacheDir(DebDatasource.cacheSubDir);
    extractedPackageFile = upath.join(
      extractionFolder,
      `${createHash('sha256').update('http://ftp.debian.org/debian/dists/stable/non-free/binary-amd64').digest('hex')}.txt`,
    );

    cfg = {
      datasource: 'deb',
      packageName: 'album',
      registryUrls: [
        'http://ftp.debian.org/debian?suite=stable&components=non-free&binaryArch=amd64',
      ],
    };
  });

  describe('getReleases', () => {
    it('returns a valid version for the package `album` and does not require redownload', async () => {
      await copyFile(fixturePackagesPath, extractedPackageFile);
      const stats = await stat(extractedPackageFile);
      const ts = stats.ctime;

      httpMock
        .scope('http://ftp.debian.org')
        .head('/debian/dists/stable/non-free/binary-amd64/Packages.gz')
        .reply(304);

      const res = await getPkgReleases(cfg);
      expect(res).toBeObject();
      expect(res!.releases).toHaveLength(1);

      expect(httpMock.getTrace()).toHaveLength(1);
      const modifiedTs = httpMock.getTrace()[0].headers['if-modified-since'];
      expect(modifiedTs).toBeDefined();
      expect(modifiedTs).toEqual(ts.toUTCString());
    });

    describe('parsing of registry url', () => {
      it('returns null when registry url misses components', async () => {
        cfg.registryUrls = [
          'http://ftp.debian.org/debian?suite=stable&binaryArch=amd64',
        ];
        const res = await getPkgReleases(cfg);
        expect(res).toBeNull();
      });

      it('returns null when registry url misses binaryArch', async () => {
        cfg.registryUrls = [
          'http://ftp.debian.org/debian?suite=stable&components=non-free',
        ];
        const res = await getPkgReleases(cfg);
        expect(res).toBeNull();
      });

      it('returns null when registry url misses suite or release', async () => {
        cfg.registryUrls = [
          'http://ftp.debian.org/debian?components=non-free&binaryArch=amd64',
        ];
        const res = await getPkgReleases(cfg);
        expect(res).toBeNull();
      });
    });

    describe('without local version', () => {
      beforeEach(() => {
        httpMock
          .scope('http://ftp.debian.org')
          .get('/debian/dists/stable/non-free/binary-amd64/Packages.gz')
          .replyWithFile(200, fixturePackagesArchivePath);
      });

      it('returns a valid version for the package `album`', async () => {
        const res = await getPkgReleases(cfg);
        expect(res).toBeObject();
        expect(res!.releases).toHaveLength(1);
      });

      it('returns a valid version for the package `album` if release is used in the registryUrl', async () => {
        cfg.registryUrls = [
          'http://ftp.debian.org/debian?release=stable&components=non-free&binaryArch=amd64',
        ];
        const res = await getPkgReleases(cfg);
        expect(res).toBeObject();
        expect(res!.releases).toHaveLength(1);
      });

      it('returns null for an unknown package', async () => {
        cfg.packageName = 'you-will-never-find-me';
        const res = await getPkgReleases(cfg);
        expect(res).toBeNull();
      });

      describe('with two components', () => {
        beforeEach(() => {
          httpMock
            .scope('http://ftp.debian.org')
            .get(
              '/debian/dists/stable/non-free-second/binary-amd64/Packages.gz',
            )
            .replyWithFile(200, fixturePackagesArchivePath2);

          cfg.registryUrls = [
            'http://ftp.debian.org/debian?suite=stable&components=non-free,non-free-second&binaryArch=amd64',
          ];
        });

        it('returns two releases for `album` which is the same across the components', async () => {
          const res = await getPkgReleases(cfg);
          expect(res).toBeObject();
          expect(res!.releases).toHaveLength(2);
        });

        it('returns two releases for `album` which has different metadata across the components', async () => {
          cfg.packageName = 'album';
          const res = await getPkgReleases(cfg);
          expect(res?.releases).toHaveLength(2);
        });
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
        cfg.packageName = 'you-will-never-find-me';
        const res = await getPkgReleases(cfg);
        expect(res).toBeNull();
      });
    });

    it('supports specifying a custom binary arch', async () => {
      httpMock
        .scope('http://ftp.debian.org')
        .get('/debian/dists/stable/non-free/binary-riscv/Packages.gz')
        .replyWithFile(200, fixturePackagesArchivePath);

      cfg.registryUrls = [
        'http://ftp.debian.org/debian?suite=stable&components=non-free&binaryArch=riscv',
      ];

      const res = await getPkgReleases(cfg);
      expect(res).toBeObject();
      expect(res!.releases).toHaveLength(1);
    });
  });

  describe('constructComponentUrls', () => {
    it('constructs URLs correctly from registry URL with suite', () => {
      const registryUrl =
        'https://ftp.debian.org/debian?suite=stable&components=main,contrib&binaryArch=amd64';
      const expectedUrls = [
        'https://ftp.debian.org/debian/dists/stable/main/binary-amd64',
        'https://ftp.debian.org/debian/dists/stable/contrib/binary-amd64',
      ];
      const componentUrls = debDatasource.constructComponentUrls(registryUrl);
      expect(componentUrls).toEqual(expectedUrls);
    });

    it('constructs URLs correctly from registry URL with release', () => {
      const registryUrl =
        'https://ftp.debian.org/debian?release=bullseye&components=main,contrib&binaryArch=amd64';
      const expectedUrls = [
        'https://ftp.debian.org/debian/dists/bullseye/main/binary-amd64',
        'https://ftp.debian.org/debian/dists/bullseye/contrib/binary-amd64',
      ];
      const componentUrls = debDatasource.constructComponentUrls(registryUrl);
      expect(componentUrls).toEqual(expectedUrls);
    });

    it('throws an error if required parameters are missing', () => {
      const registryUrl =
        'https://ftp.debian.org/debian?components=main,contrib';
      expect(() => debDatasource.constructComponentUrls(registryUrl)).toThrow(
        'Missing required query parameter',
      );
    });
  });

  describe('parseExtractedPackage', () => {
    it('should parse the last package', async () => {
      const release = await debDatasource.parseExtractedPackage(
        fixturePackagesPath,
        'alien-arena-data',
        new Date(),
      );
      expect(release?.releases?.[0]?.version).toBe('7.71.3+ds-1');
    });
  });

  describe('extract', () => {
    it('should throw error for unsupported compression', async () => {
      expect(
        async () =>
          await DebDatasource.extract(
            fixturePackagesArchivePath,
            'xz',
            extractedPackageFile,
          ),
      ).toThrow();
    });
  });
});
