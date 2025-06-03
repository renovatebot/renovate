import { createReadStream } from 'fs';
import { copyFile, stat } from 'fs-extra';
import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import upath from 'upath';
import { getPkgReleases } from '..';
import { GlobalConfig } from '../../../config/global';
import { hashStream, toSha256 } from '../../../util/hash';
import type { GetPkgReleasesConfig } from '../types';
import { cacheSubDir } from './common';
import * as fileUtils from './file';
import { getBaseSuiteUrl } from './url';
import { DebDatasource } from '.';
import { Fixtures } from '~test/fixtures';
import * as httpMock from '~test/http-mock';
import { fs } from '~test/util';

const debBaseUrl = 'http://deb.debian.org';

describe('modules/datasource/deb/index', () => {
  const fixturePackagesArchivePath = Fixtures.getPath(`Packages.gz`);
  const fixturePackagesArchivePath2 = Fixtures.getPath(`Packages2.gz`);
  const fixturePackagesPath = Fixtures.getPath(`Packages`);
  let fixturePackagesArchiveHash: string;
  let fixturePackagesArchiveHash2: string;

  let debDatasource: DebDatasource;
  let cacheDir: DirectoryResult | null;
  let cfg: GetPkgReleasesConfig;
  let extractionFolder: string;
  let extractedPackageFile: string;

  beforeEach(async () => {
    vi.resetAllMocks();
    debDatasource = new DebDatasource();
    cacheDir = await dir({ unsafeCleanup: true });
    GlobalConfig.set({ cacheDir: cacheDir.path });

    extractionFolder = await fs.ensureCacheDir(cacheSubDir);
    extractedPackageFile = upath.join(
      extractionFolder,
      `${toSha256(getComponentUrl(debBaseUrl, 'stable', 'non-free', 'amd64'))}.txt`,
    );

    cfg = {
      datasource: 'deb',
      packageName: 'album',
      registryUrls: [
        getRegistryUrl(debBaseUrl, 'stable', ['non-free'], 'amd64'),
      ],
    };

    fixturePackagesArchiveHash = await computeFileChecksum(
      fixturePackagesArchivePath,
    );
    fixturePackagesArchiveHash2 = await computeFileChecksum(
      fixturePackagesArchivePath2,
    );
  });

  afterEach(async () => {
    await cacheDir?.cleanup();
    cacheDir = null;
  });

  describe('getReleases', () => {
    it('returns a valid version for the package `album` and does not require redownload', async () => {
      await copyFile(fixturePackagesPath, extractedPackageFile);
      const stats = await stat(extractedPackageFile);
      const ts = stats.ctime;

      httpMock
        .scope(debBaseUrl, {
          // ensure the rest call sets the correct request headers
          reqheaders: {
            'if-modified-since': ts.toUTCString(),
          },
        })
        .head(getPackageUrl('', 'stable', 'non-free', 'amd64'))
        .reply(304);

      const res = await getPkgReleases(cfg);
      expect(res).toEqual({
        homepage: 'http://marginalhacks.com/Hacks/album',
        registryUrl:
          'http://deb.debian.org/debian?suite=stable&components=non-free&binaryArch=amd64',
        releases: [
          {
            version: '4.15-1',
          },
        ],
      });
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
        mockHttpCalls(
          'stable',
          'non-free',
          'amd64',
          false,
          fixturePackagesArchivePath,
          fixturePackagesArchiveHash,
        );
      });

      it('returns a valid version for the package `album`', async () => {
        const res = await getPkgReleases(cfg);
        expect(res).toEqual({
          homepage: 'http://marginalhacks.com/Hacks/album',
          registryUrl:
            'http://deb.debian.org/debian?suite=stable&components=non-free&binaryArch=amd64',
          releases: [
            {
              version: '4.15-1',
            },
          ],
        });
      });

      it('returns a valid version for the package `album` if release is used in the registryUrl', async () => {
        cfg.registryUrls = [
          getRegistryUrl(debBaseUrl, 'stable', ['non-free'], 'amd64'),
        ];
        const res = await getPkgReleases(cfg);
        expect(res).toEqual({
          homepage: 'http://marginalhacks.com/Hacks/album',
          registryUrl:
            'http://deb.debian.org/debian?suite=stable&components=non-free&binaryArch=amd64',
          releases: [
            {
              version: '4.15-1',
            },
          ],
        });
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

          mockFetchInReleaseContent(
            fixturePackagesArchiveHash2,
            'stable',
            'non-free-second',
            'amd64',
          );

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
          expect(res).toEqual({
            homepage: 'http://marginalhacks.com/Hacks/album',
            registryUrl:
              'http://deb.debian.org/debian?suite=stable&components=non-free,non-free-second&binaryArch=amd64',
            releases: [
              {
                version: '4.14-1',
              },
              {
                version: '4.15-1',
              },
            ],
          });
        });

        it('returns two releases for `album` which has different metadata across the components', async () => {
          cfg.packageName = 'album';
          const res = await getPkgReleases(cfg);
          expect(res).toEqual({
            homepage: 'http://marginalhacks.com/Hacks/album',
            registryUrl:
              'http://deb.debian.org/debian?suite=stable&components=non-free,non-free-second&binaryArch=amd64',
            releases: [
              {
                version: '4.14-1',
              },
              {
                version: '4.15-1',
              },
            ],
          });
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

      mockFetchInReleaseContent(
        fixturePackagesArchiveHash,
        'stable',
        'non-free',
        'riscv',
      );

      cfg.registryUrls = [
        getRegistryUrl(debBaseUrl, 'stable', ['non-free'], 'riscv'),
      ];

      const res = await getPkgReleases(cfg);
      expect(res).toEqual({
        homepage: 'http://marginalhacks.com/Hacks/album',
        registryUrl:
          'http://deb.debian.org/debian?suite=stable&components=non-free&binaryArch=riscv',
        releases: [
          {
            version: '4.15-1',
          },
        ],
      });
    });

    it('should not lead to a race condition on parallel lookups', async () => {
      const packages = [
        'album',
        'album-data',
        'alien-arena-data',
        'amiwm',
        'arb',
        'arb-common',
        'libfaac-dev',
        'amoeba-data',
      ];

      for (let i = 0; i < packages.length; i++) {
        // first call doesn't include a http head call, since the file doesn't exists locally yet
        // the package index is downloaded every time since the http head call returns 200
        mockHttpCalls(
          'stable',
          'non-free',
          'amd64',
          !!i,
          fixturePackagesArchivePath,
          fixturePackagesArchiveHash,
        );
      }

      const results = await Promise.all(
        packages.map((packageName) => getPkgReleases({ ...cfg, packageName })),
      );

      for (const result of results) {
        expect(result?.releases?.length).toBe(1);
      }
    });
  });

  describe('parseExtractedPackageIndex', () => {
    it('should parse the extracted package', async () => {
      await copyFile(fixturePackagesPath, extractedPackageFile);

      const parsedPackages = await debDatasource.parseExtractedPackageIndex(
        extractedPackageFile,
        new Date(),
      );

      expect(parsedPackages).toEqual({
        album: [
          {
            Homepage: 'http://marginalhacks.com/Hacks/album',
            Package: 'album',
            Version: '4.15-1',
          },
        ],
        'album-data': [
          {
            Homepage: 'http://marginalhacks.com/Hacks/album',
            Package: 'album-data',
            Version: '4.05-7.2',
          },
          {
            Homepage: 'http://marginalhacks.com/Hacks/album',
            Package: 'album-data',
            Version: '4.05-7.3',
          },
        ],
        'alien-arena-data': [
          {
            Homepage: 'https://martianbackup.com',
            Package: 'alien-arena-data',
            Version: '7.71.3+ds-1',
          },
        ],
      });
    });
  });

  describe('downloadAndExtractPackage', () => {
    it('should ignore error when fetching the InRelease content fails', async () => {
      const packageArgs: [release: string, component: string, arch: string] = [
        'stable',
        'non-free',
        'amd64',
      ];

      httpMock
        .scope(debBaseUrl)
        .get(getPackageUrl('', ...packageArgs))
        .replyWithFile(200, fixturePackagesArchivePath2);
      mockFetchInReleaseContent('wrong-hash', ...packageArgs, true);

      await expect(
        // TODO: method is private, so needs better testing
        // eslint-disable-next-line @typescript-eslint/dot-notation
        debDatasource['downloadAndExtractPackage'](
          getComponentUrl(debBaseUrl, ...packageArgs),
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          extractedFile: extractedPackageFile,
          lastTimestamp: expect.anything(),
        }),
      );
    });

    it('should throw error when checksum validation fails', async () => {
      httpMock
        .scope(debBaseUrl)
        .get(getPackageUrl('', 'bullseye', 'main', 'amd64'))
        .replyWithFile(200, fixturePackagesArchivePath2);
      mockFetchInReleaseContent('wrong-hash', 'bullseye', 'main', 'amd64');

      await expect(
        // TODO: method is private, so needs better testing
        // eslint-disable-next-line @typescript-eslint/dot-notation
        debDatasource['downloadAndExtractPackage'](
          getComponentUrl(debBaseUrl, 'bullseye', 'main', 'amd64'),
        ),
      ).rejects.toThrow(`SHA256 checksum validation failed`);
    });

    it('should throw error for when extracting fails', async () => {
      vi.spyOn(fileUtils, 'extract').mockRejectedValueOnce(new Error());

      httpMock
        .scope(debBaseUrl)
        .get(getPackageUrl('', 'bullseye', 'main', 'amd64'))
        .replyWithFile(200, fixturePackagesArchivePath2);
      mockFetchInReleaseContent(
        fixturePackagesArchiveHash2,
        'bullseye',
        'main',
        'amd64',
      );

      await expect(
        // TODO: method is private, so needs better testing
        // eslint-disable-next-line @typescript-eslint/dot-notation
        debDatasource['downloadAndExtractPackage'](
          getComponentUrl(debBaseUrl, 'bullseye', 'main', 'amd64'),
        ),
      ).rejects.toThrow(`Missing metadata in extracted package index file!`);
    });
  });

  describe('checkIfModified', () => {
    it('should return true for different status code', async () => {
      httpMock
        .scope(debBaseUrl)
        .head(getPackageUrl('', 'stable', 'non-free', 'amd64'))
        .reply(200);

      await expect(
        // TODO: method is private, so needs better testing
        // eslint-disable-next-line @typescript-eslint/dot-notation
        debDatasource['checkIfModified'](
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
        // TODO: method is private, so needs better testing
        // eslint-disable-next-line @typescript-eslint/dot-notation
        debDatasource['checkIfModified'](
          getPackageUrl(debBaseUrl, 'stable', 'non-free', 'amd64'),
          new Date(),
        ),
      ).resolves.toBe(true);
    });
  });
});

/**
 * Mocks several http calls for the in parallel lookup test
 *
 * - Mocks the http get call for the Package Index file
 * - Mocks the http get call for the InRelease file
 * - Mocks the http head call for Package Index file (returns 200)
 *
 * @param release - The release name (e.g., 'bullseye').
 * @param component - The component name (e.g., 'main').
 * @param arch - The architecture (e.g., 'amd64').
 * @param checkIfModified - whether it should mock the http head call of the Package Index file
 * @param packageArchivePath - path to package index
 * @param packagesArchiveHash - sha256 hash of package
 */
function mockHttpCalls(
  release: string,
  component: string,
  arch: string,
  checkIfModified: boolean,
  packageArchivePath: string,
  packagesArchiveHash: string,
) {
  httpMock
    .scope(debBaseUrl)
    .get(getPackageUrl('', release, component, arch))
    .replyWithFile(200, packageArchivePath);

  mockFetchInReleaseContent(packagesArchiveHash, release, component, arch);

  if (checkIfModified) {
    httpMock
      .scope(debBaseUrl)
      .head(getPackageUrl('', release, component, arch))
      .reply(200);
  }
}

/**
 * Mocks the response for fetching the InRelease file content.
 *
 * This function sets up a mock HTTP response for a specific InRelease file request. The content includes a SHA256 checksum
 * entry for a package index file. It allows simulating both successful and error responses.
 *
 * @param packageIndexHash - The SHA256 checksum hash of the package index file.
 * @param release - The release name (e.g., 'bullseye').
 * @param component - The component name (e.g., 'main').
 * @param arch - The architecture (e.g., 'amd64').
 * @param error - Optional flag to simulate an error response (default is false).
 */
function mockFetchInReleaseContent(
  packageIndexHash: string,
  release: string,
  component: string,
  arch: string,
  error = false,
) {
  const packageIndexPath = `${component}/binary-${arch}/Packages.gz`;

  const content = `SHA256:
 3957f28db16e3f28c7b34ae84f1c929c567de6970f3f1b95dac9b498dd80fe63   738242 contrib/Contents-all
 ${packageIndexHash} 1234 ${packageIndexPath}
`;

  const mockCall = httpMock
    .scope(debBaseUrl)
    .get(
      getBaseSuiteUrl(getComponentUrl('', release, component, arch)) +
        '/InRelease',
    );

  if (error) {
    mockCall.replyWithError('Unexpected Error');
  } else {
    mockCall.reply(200, content);
  }
}

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

/**
 * Computes the SHA256 checksum of a specified file.
 *
 * @param filePath - path of the file
 * @returns resolves to the SHA256 checksum
 */
function computeFileChecksum(filePath: string): Promise<string> {
  const stream = createReadStream(filePath);
  return hashStream(stream, 'sha256');
}
