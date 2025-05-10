import { createReadStream, readFileSync } from 'fs';
import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { hashStream, toSha256 } from '../../../util/hash';
import { Http } from '../../../util/http';
import { cacheSubDir } from './common';
import * as fileUtils from './file';
import { getPackageUrl, mockFetchInReleaseContent } from './index.spec';
import {
  checkIfModified,
  downloadAndExtractPackage,
  getPackagesRelativeUrlFromReleaseFile,
} from './packages';
import { Fixtures } from '~test/fixtures';
import * as httpMock from '~test/http-mock';
import { fs } from '~test/util';

const debBaseUrl = 'http://deb.debian.org';

describe('modules/datasource/deb/packages', () => {
  let extractedPackageFile: string;
  const fixtureInRelease = readFileSync(Fixtures.getPath('InRelease'), 'utf-8');
  const fixturePackagesArchivePath2 = Fixtures.getPath(`Packages2.gz`);
  let fixturePackagesArchiveHash2: string;
  const fixtureInReleaseBookworm = readFileSync(
    Fixtures.getPath('InReleaseBookworm'),
    'utf-8',
  );
  const fixtureInReleaseInvalid = readFileSync(
    Fixtures.getPath('InReleaseInvalid'),
    'utf-8',
  );

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('retrievePackagesBaseURLFromReleaseFile', () => {
    it('retrieves Packages.xz file from the release file', () => {
      const packageBaseUrl = 'main/binary-arm64/';

      const { hash, packagesFile } = getPackagesRelativeUrlFromReleaseFile(
        fixtureInRelease,
        packageBaseUrl,
      );

      expect(hash).toEqual(
        '14fd8848875e988f92d00d0baeb058c068b8352d537d2836eb1f0a6633c7cdd2',
      );

      expect(packagesFile).toEqual(`${packageBaseUrl}Packages.xz`);
    });

    it('retrieve Packages.xz if there is only Packages.xz available', () => {
      const { hash, packagesFile } = getPackagesRelativeUrlFromReleaseFile(
        fixtureInReleaseBookworm,
        'main/binary-arm64/',
      );

      expect(hash).toEqual(
        'e6334c735d1e2485ec9391c822fb133f18d18c27dc880a2678017f0365142543',
      );

      expect(packagesFile).toEqual('main/binary-arm64/Packages.xz');
    });

    it('retrieve Packages file if no compression is available', () => {
      const { hash, packagesFile } = getPackagesRelativeUrlFromReleaseFile(
        fixtureInReleaseBookworm,
        'main/binary-mipsel/',
      );

      expect(hash).toEqual(
        'ffd78fe14e1cc1883029fce4d128d2f8eb81bf338a64e2318251e908a714c987',
      );

      expect(packagesFile).toEqual('main/binary-mipsel/Packages');
    });

    it('no packages file found', () => {
      const { hash, packagesFile } = getPackagesRelativeUrlFromReleaseFile(
        fixtureInReleaseBookworm,
        'main/non-existend/',
      );

      expect(hash).toEqual('');
      expect(packagesFile).toEqual('');
    });

    it('do not match invalid release file lines', () => {
      const { hash, packagesFile } = getPackagesRelativeUrlFromReleaseFile(
        fixtureInReleaseInvalid,
        'non-free/binary-s390x/',
      );

      expect(hash).toEqual('');
      expect(packagesFile).toEqual('');
    });
  });

  describe('checkIfModified', () => {
    it('should return true for different status code', async () => {
      httpMock
        .scope(debBaseUrl)
        .head(getPackageUrl('', 'stable', 'non-free', 'amd64'))
        .reply(200);

      await expect(
        checkIfModified(
          getPackageUrl(debBaseUrl, 'stable', 'non-free', 'amd64'),
          new Date(),
          new Http('deb'),
        ),
      ).resolves.toBe(true);
    });

    it('should throw error if request failed', async () => {
      httpMock
        .scope(debBaseUrl)
        .head(getPackageUrl('', 'stable', 'non-free', 'amd64'))
        .replyWithError('Unexpected Error');

      await expect(
        checkIfModified(
          getPackageUrl(debBaseUrl, 'stable', 'non-free', 'amd64'),
          new Date(),
          new Http('deb'),
        ),
      ).rejects.toThrow('Unexpected Error');
    });
  });

  describe('downloadAndExtractPackage', () => {
    let cacheDir: DirectoryResult | null;
    let extractionFolder: string;

    beforeEach(async () => {
      vi.resetAllMocks();
      cacheDir = await dir({ unsafeCleanup: true });
      GlobalConfig.set({ cacheDir: cacheDir.path });

      extractionFolder = await fs.ensureCacheDir(cacheSubDir);
      extractedPackageFile = upath.join(
        extractionFolder,
        `${toSha256(getComponentUrl(debBaseUrl, 'stable', 'non-free', 'amd64'))}.txt`,
      );

      fixturePackagesArchiveHash2 = await computeFileChecksum(
        fixturePackagesArchivePath2,
      );
    });

    afterEach(async () => {
      await cacheDir?.cleanup();
      cacheDir = null;
    });

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
        downloadAndExtractPackage(
          getComponentUrl(debBaseUrl, ...packageArgs),
          new Http('deb'),
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
        downloadAndExtractPackage(
          getComponentUrl(debBaseUrl, 'bullseye', 'main', 'amd64'),
          new Http('deb'),
        ),
      ).rejects.toThrow(`SHA256 checksum validation failed`);
    });

    it('should throw error for when extracting fails', async () => {
      vi.spyOn(fileUtils, 'extract').mockRejectedValueOnce(new Error());

      // return package file
      httpMock
        .scope(debBaseUrl)
        .get(getPackageUrl('', 'bullseye', 'main', 'amd64', 'xz'))
        .replyWithFile(200, fixturePackagesArchivePath2);

      // return InRelease content
      mockFetchInReleaseContent(
        fixturePackagesArchiveHash2,
        'bullseye',
        'main',
        'amd64',
        false,
        'xz',
      );

      await expect(
        downloadAndExtractPackage(
          getComponentUrl(debBaseUrl, 'bullseye', 'main', 'amd64'),
          new Http('deb'),
        ),
      ).rejects.toThrow(`Missing metadata in extracted package index file!`);
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
export function getComponentUrl(
  baseUrl: string,
  release: string,
  component: string,
  arch: string,
): string {
  return `${baseUrl}/debian/dists/${release}/${component}/binary-${arch}`;
}

/**
 * Computes the SHA256 checksum of a specified file.
 *
 * @param filePath - path of the file
 * @returns resolves to the SHA256 checksum
 */
export function computeFileChecksum(filePath: string): Promise<string> {
  const stream = createReadStream(filePath);
  return hashStream(stream, 'sha256');
}
