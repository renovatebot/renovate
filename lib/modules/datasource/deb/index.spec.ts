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

const debBaseUrl = 'http://ftp.debian.org';

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
      `${createHash('sha256')
        .update(getComponentUrl(debBaseUrl, 'stable', 'non-free', 'amd64'))
        .digest('hex')}.txt`,
    );

    cfg = {
      datasource: 'deb',
      packageName: 'album',
      registryUrls: [
        getRegistryUrl(debBaseUrl, 'stable', ['non-free'], 'amd64'),
      ],
    };
  });

  describe('getReleases', () => {
    it('returns a valid version for the package `album` and does not require redownload', async () => {
      await copyFile(fixturePackagesPath, extractedPackageFile);
      const stats = await stat(extractedPackageFile);
      const ts = stats.ctime;

      httpMock
        .scope(debBaseUrl)
        .head(getPackageUrl('', 'stable', 'non-free', 'amd64'))
        .reply(304);

      const res = await getPkgReleases(cfg);
      expect(res).toBeObject();
      expect(res!.releases).toHaveLength(1);

      const modifiedTs = httpMock.getTrace()[0].headers['if-modified-since'];
      expect(modifiedTs).toBeDefined();
      expect(modifiedTs).toEqual(ts.toUTCString());
    });

    describe('parsing of registry url', () => {
      it('returns null when registry url misses components', async () => {
        cfg.registryUrls = [
          `${debBaseUrl}/debian?suite=stable&binaryArch=amd64`,
        ];
        const res = await getPkgReleases(cfg);
        expect(res).toBeNull();
      });

      it('returns null when registry url misses binaryArch', async () => {
        cfg.registryUrls = [
          `${debBaseUrl}/debian?suite=stable&components=non-free`,
        ];
        const res = await getPkgReleases(cfg);
        expect(res).toBeNull();
      });

      it('returns null when registry url misses suite or release', async () => {
        cfg.registryUrls = [
          `${debBaseUrl}/debian?components=non-free&binaryArch=amd64`,
        ];
        const res = await getPkgReleases(cfg);
        expect(res).toBeNull();
      });
    });

    describe('without local version', () => {
      beforeEach(() => {
        httpMock
          .scope(debBaseUrl)
          .get(getPackageUrl('', 'stable', 'non-free', 'amd64'))
          .replyWithFile(200, fixturePackagesArchivePath);
      });

      it('returns a valid version for the package `album`', async () => {
        const res = await getPkgReleases(cfg);
        expect(res).toBeObject();
        expect(res!.releases).toHaveLength(1);
      });

      it('returns a valid version for the package `album` if release is used in the registryUrl', async () => {
        cfg.registryUrls = [
          getRegistryUrl(debBaseUrl, 'stable', ['non-free'], 'amd64'),
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
            .scope(debBaseUrl)
            .get(getPackageUrl('', 'stable', 'non-free-second', 'amd64'))
            .replyWithFile(200, fixturePackagesArchivePath2);

          cfg.registryUrls = [
            getRegistryUrl(
              debBaseUrl,
              'stable',
              ['non-free', 'non-free-second'],
              'amd64',
            ),
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
          .scope(debBaseUrl)
          .get(getPackageUrl('', 'stable', 'non-free', 'amd64'))
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
        .scope(debBaseUrl)
        .get(getPackageUrl('', 'stable', 'non-free', 'riscv'))
        .replyWithFile(200, fixturePackagesArchivePath);

      cfg.registryUrls = [
        getRegistryUrl(debBaseUrl, 'stable', ['non-free'], 'riscv'),
      ];

      const res = await getPkgReleases(cfg);
      expect(res).toBeObject();
      expect(res!.releases).toHaveLength(1);
    });
  });

  describe('parseExtractedPackage', () => {
    it('should parse the last package', async () => {
      await copyFile(fixturePackagesPath, extractedPackageFile);

      const release = await debDatasource.parseExtractedPackage(
        extractedPackageFile,
        'alien-arena-data',
        new Date(),
      );
      expect(release?.releases?.[0]?.version).toBe('7.71.3+ds-1');
    });
  });

  describe('extract', () => {
    it('should throw error for unsupported compression', async () => {
      await expect(
        DebDatasource.extract(
          fixturePackagesArchivePath,
          'xz',
          extractedPackageFile,
        ),
      ).rejects.toThrow('Unsupported compression standard');
    });
  });

  describe('downloadAndExtractPackage', () => {
    beforeEach(() => {
      httpMock
        .scope(debBaseUrl)
        .get(getPackageUrl('', 'bullseye', 'main', 'amd64'))
        .replyWithFile(200, fixturePackagesArchivePath2);
    });

    it('should throw error for unsupported compression', async () => {
      DebDatasource.extract = jest.fn().mockRejectedValueOnce(new Error());
      await expect(
        debDatasource.downloadAndExtractPackage(
          getComponentUrl(debBaseUrl, 'bullseye', 'main', 'amd64'),
        ),
      ).rejects.toThrow(`No compression standard worked for `);
    });
  });

  describe('checkIfModified', () => {
    it('should return true for different status code', async () => {
      httpMock
        .scope(debBaseUrl)
        .head(getPackageUrl('', 'stable', 'non-free', 'amd64'))
        .reply(200);

      await expect(
        debDatasource.checkIfModified(
          getPackageUrl(debBaseUrl, 'stable', 'non-free', 'amd64'),
          new Date(),
        ),
      ).resolves.toBe(true);
    });

    it('should return true if request failed', async () => {
      httpMock
        .scope(debBaseUrl)
        .head(getPackageUrl('', 'stable', 'non-free', 'amd64'))
        .replyWithError('Unexpected Error');

      await expect(
        debDatasource.checkIfModified(
          getPackageUrl(debBaseUrl, 'stable', 'non-free', 'amd64'),
          new Date(),
        ),
      ).resolves.toBe(true);
    });
  });
});

/**
 * Constructs a URL for accessing the component directory for a specific release and architecture.
 *
 * @param baseUrl - The base URL of the repository.
 * @param release - The release name or codename (e.g., 'buster', 'bullseye').
 * @param component - The component name (e.g., 'main', 'contrib', 'non-free').
 * @param arch - The architecture name (e.g., 'amd64', 'i386').
 * @returns The complete URL to the component directory.
 */
function getComponentUrl(
  baseUrl: string,
  release: string,
  component: string,
  arch: string,
): string {
  return `${baseUrl}/debian/dists/${release}/${component}/binary-${arch}`;
}

/**
 * Constructs a URL for accessing the Packages.gz file for a specific component, release, and architecture.
 *
 * @param baseUrl - The base URL of the repository.
 * @param release - The release name or codename (e.g., 'buster', 'bullseye').
 * @param component - The component name (e.g., 'main', 'contrib', 'non-free').
 * @param arch - The architecture name (e.g., 'amd64', 'i386').
 * @returns The complete URL to the Packages.gz file.
 */
function getPackageUrl(
  baseUrl: string,
  release: string,
  component: string,
  arch: string,
) {
  return `${getComponentUrl(baseUrl, release, component, arch)}/Packages.gz`;
}

/**
 * Constructs a URL used generating the component url with specific release, components, and architecture.
 *
 * @param baseUrl - The base URL of the repository.
 * @param release - The release name or codename (e.g., 'buster', 'bullseye').
 * @param components - An array of component names (e.g., ['main', 'contrib', 'non-free']).
 * @param arch - The architecture name (e.g., 'amd64', 'i386').
 * @returns The complete URL to the package registry.
 */
function getRegistryUrl(
  baseUrl: string,
  release: string,
  components: string[],
  arch: string,
) {
  return `${baseUrl}/debian?suite=${release}&components=${components.join(',')}&binaryArch=${arch}`;
}
