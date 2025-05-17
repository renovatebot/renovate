import { copyFileSync, createReadStream, readFileSync } from 'fs';
import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { hashStream, toSha256 } from '../../../util/hash';
import { Http } from '../../../util/http';
import { joinUrlParts } from '../../../util/url';
import { cacheSubDir } from './common';
import * as fileUtils from './file';
import { getPackageUrl, mockFetchInReleaseContent } from './index.spec';
import {
  downloadAndExtractPackage,
  downloadPackageFile,
  getPackageFromReleaseFile,
} from './packages';
import { Fixtures } from '~test/fixtures';
import * as httpMock from '~test/http-mock';
import { fs } from '~test/util';

const debBaseUrl = 'http://deb.debian.org';

describe('modules/datasource/deb/packages', () => {
  let downloadedPackageFile: string;
  const fixtureInRelease = readFileSync(Fixtures.getPath('InRelease'), 'utf-8');
  const fixturePackagesArchiveXzPath = Fixtures.getPath('Packages.xz');
  const fixturePackagesArchivePath2 = Fixtures.getPath(`Packages2.gz`);
  const fixturePackagesArchiveNoCompr = Fixtures.getPath(`Packages`);
  const fixtureInReleaseBookworm = readFileSync(
    Fixtures.getPath('InReleaseBookworm'),
    'utf-8',
  );
  const fixtureInReleaseInvalid = readFileSync(
    Fixtures.getPath('InReleaseInvalid'),
    'utf-8',
  );
  const packageArgs: [release: string, component: string, arch: string] = [
    'stable',
    'non-free',
    'amd64',
  ];

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getPackageFromReleaseFile', () => {
    it('retrieves Packages.xz file from the release file', () => {
      const packageBaseUrl = 'main/binary-arm64/';

      const { hash, packagesFile } = getPackageFromReleaseFile(
        fixtureInRelease,
        packageBaseUrl,
      );

      expect(hash).toEqual(
        '14fd8848875e988f92d00d0baeb058c068b8352d537d2836eb1f0a6633c7cdd2',
      );

      expect(packagesFile).toEqual(`${packageBaseUrl}Packages.xz`);
    });

    it('retrieve Packages.xz if there is only Packages.xz available', () => {
      const { hash, packagesFile } = getPackageFromReleaseFile(
        fixtureInReleaseBookworm,
        'main/binary-arm64/',
      );

      expect(hash).toEqual(
        'e6334c735d1e2485ec9391c822fb133f18d18c27dc880a2678017f0365142543',
      );

      expect(packagesFile).toEqual('main/binary-arm64/Packages.xz');
    });

    it('retrieve Packages file if no compression is available', () => {
      const { hash, packagesFile } = getPackageFromReleaseFile(
        fixtureInReleaseBookworm,
        'main/binary-mipsel/',
      );

      expect(hash).toEqual(
        'ffd78fe14e1cc1883029fce4d128d2f8eb81bf338a64e2318251e908a714c987',
      );

      expect(packagesFile).toEqual('main/binary-mipsel/Packages');
    });

    it('throw error if no packages file was found', () => {
      expect(() => {
        getPackageFromReleaseFile(
          fixtureInReleaseBookworm,
          'main/non-existend/',
        );
      }).toThrow('No valid package file found in release files');
    });

    it('do not match invalid release file lines', () => {
      expect(() => {
        getPackageFromReleaseFile(
          fixtureInReleaseInvalid,
          'non-free/binary-s390x/',
        );
      }).toThrow('No valid package file found in release files');
    });
  });

  describe('downloadPackageFile', () => {
    let cacheDir: DirectoryResult | null;
    let extractionFolder: string;

    beforeEach(async () => {
      cacheDir = await dir({ unsafeCleanup: true });
      GlobalConfig.set({ cacheDir: cacheDir.path });

      extractionFolder = await fs.ensureCacheDir(cacheSubDir);
      downloadedPackageFile = upath.join(
        extractionFolder,
        `${toSha256(getComponentUrl(debBaseUrl, ...packageArgs))}.txt`,
      );
    });

    afterEach(async () => {
      await cacheDir?.cleanup();
      cacheDir = null;
    });

    it('should download the package file if it has not been downloaded before', async () => {
      const fixturePackageHash = await computeFileChecksum(
        fixturePackagesArchiveXzPath,
      );

      const packageUrl = getPackageUrl('', ...packageArgs, 'xz');

      httpMock
        .scope(debBaseUrl)
        .get(packageUrl)
        .replyWithFile(200, fixturePackagesArchiveXzPath);

      await expect(
        downloadPackageFile(
          joinUrlParts(debBaseUrl, packageUrl),
          downloadedPackageFile,
          fixturePackageHash,
          new Http('deb'),
        ),
      ).resolves.toEqual(true);

      const fileHash = await computeFileChecksum(downloadedPackageFile);
      expect(fileHash).toEqual(fixturePackageHash);
    });

    it('should download the package file if it has been modified', async () => {
      const fixturePackageHash = await computeFileChecksum(
        fixturePackagesArchiveXzPath,
      );

      // write distinct cached file from fixturePackagesArchiveXzPath
      await fs.outputCacheFile(downloadedPackageFile, 'test');

      const packageUrl = getPackageUrl('', ...packageArgs, 'xz');

      // return the package file
      httpMock
        .scope(debBaseUrl)
        .get(packageUrl)
        .replyWithFile(200, fixturePackagesArchiveXzPath);

      await expect(
        downloadPackageFile(
          joinUrlParts(debBaseUrl, packageUrl),
          downloadedPackageFile,
          fixturePackageHash,
          new Http('deb'),
        ),
      ).resolves.toEqual(true);

      const fileHash = await computeFileChecksum(downloadedPackageFile);
      expect(fileHash).toEqual(fixturePackageHash);
    });

    it('should not download if the package file has not been modified', async () => {
      // write cached file from fixturePackagesArchiveXzPath
      const read = createReadStream(fixturePackagesArchiveXzPath);
      const write = fs.createCacheWriteStream(downloadedPackageFile);
      await fs.pipeline(read, write);

      const fixturePackageHash = await computeFileChecksum(
        fixturePackagesArchiveXzPath,
      );

      const packageUrl = getPackageUrl('', ...packageArgs, 'xz');

      await expect(
        downloadPackageFile(
          joinUrlParts(debBaseUrl, packageUrl),
          downloadedPackageFile,
          fixturePackageHash,
          new Http('deb'),
        ),
      ).resolves.toEqual(false);
    });

    it('should download even though the checksum is not provided', async () => {
      const fixturePackageHash = await computeFileChecksum(
        fixturePackagesArchiveXzPath,
      );

      const packageUrl = getPackageUrl('', ...packageArgs, 'xz');

      // return the package file
      httpMock
        .scope(debBaseUrl)
        .get(packageUrl)
        .replyWithFile(200, fixturePackagesArchiveXzPath);

      await expect(
        downloadPackageFile(
          joinUrlParts(debBaseUrl, packageUrl),
          downloadedPackageFile,
          '', // empty hash
          new Http('deb'),
        ),
      ).resolves.toEqual(true);

      const fileHash = await computeFileChecksum(downloadedPackageFile);
      expect(fileHash).toEqual(fixturePackageHash);
    });

    it('throw error if checksum does not match', async () => {
      const packageUrl = getPackageUrl('', ...packageArgs, 'xz');

      // return the package file
      httpMock
        .scope(debBaseUrl)
        .get(packageUrl)
        .replyWithFile(200, fixturePackagesArchiveXzPath);

      await expect(
        downloadPackageFile(
          joinUrlParts(debBaseUrl, packageUrl),
          downloadedPackageFile,
          'required-hash-value-from-InRelease-file', // assume value from inrelease file is provided
          new Http('deb'),
        ),
      ).rejects.toThrowError('SHA256 checksum validation failed');
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
      downloadedPackageFile = upath.join(
        extractionFolder,
        `${toSha256(getComponentUrl(debBaseUrl, ...packageArgs))}.txt`,
      );
    });

    afterEach(async () => {
      await cacheDir?.cleanup();
      cacheDir = null;
    });

    it('should ignore error when fetching of InRelease or Release content fails', async () => {
      // return no InRelease content
      mockFetchInReleaseContent(
        'no-hash-value',
        ...packageArgs,
        true,
        '',
        'InRelease',
      );

      // return no Release content
      mockFetchInReleaseContent(
        'no-hash-value',
        ...packageArgs,
        true,
        '',
        'Release',
      );

      // provide mock for the Package.gz file as it is the default behavior
      httpMock
        .scope(debBaseUrl)
        .get(getPackageUrl('', ...packageArgs))
        .replyWithFile(200, fixturePackagesArchivePath2);

      await expect(
        downloadAndExtractPackage(
          getComponentUrl(debBaseUrl, ...packageArgs),
          new Http('deb'),
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          extractedFile: downloadedPackageFile,
          lastTimestamp: expect.anything(),
        }),
      );
    });

    it('should fall back to no compression if release file only contains no compressed Package file', async () => {
      const fixturePackageHash = await computeFileChecksum(
        fixturePackagesArchiveNoCompr,
      );

      // return InRelease file
      mockFetchInReleaseContent(
        fixturePackageHash,
        ...packageArgs,
        false,
        '',
        'InRelease',
      );

      // return uncompressed Package file
      httpMock
        .scope(debBaseUrl)
        .get(getPackageUrl('', ...packageArgs, ''))
        .replyWithFile(200, fixturePackagesArchiveNoCompr);

      await expect(
        downloadAndExtractPackage(
          getComponentUrl(debBaseUrl, ...packageArgs),
          new Http('deb'),
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          extractedFile: downloadedPackageFile,
          lastTimestamp: expect.anything(),
        }),
      );
    });

    it('should fall back to Release file if InRelease cannot be found', async () => {
      const fixturePackagesXzArchiveHash = await computeFileChecksum(
        fixturePackagesArchiveXzPath,
      );

      // return no InRelease file
      mockFetchInReleaseContent('', ...packageArgs, true, '', 'InRelease');

      // return Release content
      mockFetchInReleaseContent(
        fixturePackagesXzArchiveHash,
        ...packageArgs,
        false,
        'xz',
        'Release',
      );

      // return package file
      httpMock
        .scope(debBaseUrl)
        .get(getPackageUrl('', ...packageArgs, 'xz'))
        .replyWithFile(200, fixturePackagesArchiveXzPath);

      await expect(
        downloadAndExtractPackage(
          getComponentUrl(debBaseUrl, ...packageArgs),
          new Http('deb'),
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          extractedFile: downloadedPackageFile,
          lastTimestamp: expect.anything(),
        }),
      );
    });

    it('should throw error when checksum validation fails', async () => {
      // return InRelease content
      mockFetchInReleaseContent(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', // wrong hash
        ...packageArgs,
        false,
        'xz',
      );

      // return package file
      httpMock
        .scope(debBaseUrl)
        .get(getPackageUrl('', ...packageArgs, 'xz'))
        .replyWithFile(200, fixturePackagesArchivePath2);

      await expect(
        downloadAndExtractPackage(
          getComponentUrl(debBaseUrl, ...packageArgs),
          new Http('deb'),
        ),
      ).rejects.toThrow(`SHA256 checksum validation failed`);
    });

    it('should throw error when release file is fetched but package cannot be found', async () => {
      // return InRelease content
      mockFetchInReleaseContent(
        'non-compliant-hash',
        ...packageArgs,
        false,
        'xz',
      );

      await expect(
        downloadAndExtractPackage(
          getComponentUrl(debBaseUrl, ...packageArgs),
          new Http('deb'),
        ),
      ).rejects.toThrow(`No valid package file found in release files`);
    });

    it('should throw error for when extracting fails', async () => {
      vi.spyOn(fileUtils, 'extract').mockRejectedValueOnce(new Error());

      const fixturePackagesArchiveHash2 = await computeFileChecksum(
        fixturePackagesArchivePath2,
      );

      // return InRelease content
      mockFetchInReleaseContent(
        fixturePackagesArchiveHash2,
        ...packageArgs,
        false,
        'gz',
      );

      // return package file
      httpMock
        .scope(debBaseUrl)
        .get(getPackageUrl('', ...packageArgs, 'gz'))
        .replyWithFile(200, fixturePackagesArchivePath2);

      await expect(
        downloadAndExtractPackage(
          getComponentUrl(debBaseUrl, ...packageArgs),
          new Http('deb'),
        ),
      ).rejects.toThrow(`Missing metadata in extracted package index file!`);
    });

    it('should not download if package file already exists', async () => {
      downloadedPackageFile = upath.join(
        extractionFolder,
        `${toSha256(getComponentUrl(debBaseUrl, ...packageArgs))}.xz`,
      );

      const extractedFile = upath.join(
        extractionFolder,
        `${toSha256(getComponentUrl(debBaseUrl, ...packageArgs))}.txt`,
      );

      // write cached compressed package file
      copyFileSync(fixturePackagesArchiveXzPath, downloadedPackageFile);

      // write cached extracted package file
      copyFileSync(fixturePackagesArchiveNoCompr, extractedFile);

      const fixturePackageHash = await computeFileChecksum(
        fixturePackagesArchiveXzPath,
      );

      // return InRelease content
      mockFetchInReleaseContent(
        fixturePackageHash,
        ...packageArgs,
        false,
        'xz',
        'InRelease',
      );

      await expect(
        downloadAndExtractPackage(
          getComponentUrl(debBaseUrl, ...packageArgs),
          new Http('deb'),
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          extractedFile,
          lastTimestamp: expect.anything(),
        }),
      );
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
