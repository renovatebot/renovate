import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import upath from 'upath';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { fs } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import * as cacheFs from '../../../util/fs/index.ts';
import { toSha256 } from '../../../util/hash.ts';
import { Http } from '../../../util/http/index.ts';
import { cacheSubDir } from './common.ts';
import {
  computeFileChecksum,
  mockFetchInReleaseContent,
} from './index.spec.ts';
import { downloadAndExtractPackage } from './packages.ts';
import { getComponentUrl, getPackageUrl } from './url.ts';

const debBaseUrl = 'http://deb.debian.org';

describe('modules/datasource/deb/packages', () => {
  const fixturePackagesArchivePath2 = Fixtures.getPath(`Packages2.gz`);
  let fixturePackagesArchiveHash2: string;

  let cacheDir: DirectoryResult | null;
  let extractionFolder: string;
  let extractedPackageFile: string;

  beforeEach(async () => {
    cacheDir = await dir({ unsafeCleanup: true });
    GlobalConfig.set({ cacheDir: cacheDir.path });

    extractionFolder = await fs.ensureCacheDir(cacheSubDir);
    extractedPackageFile = upath.join(
      extractionFolder,
      `${toSha256(getPackageUrl(debBaseUrl, 'stable', 'non-free', 'amd64'))}.txt`,
    );

    fixturePackagesArchiveHash2 = await computeFileChecksum(
      fixturePackagesArchivePath2,
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cacheDir?.cleanup();
    cacheDir = null;
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
        downloadAndExtractPackage(
          getComponentUrl(debBaseUrl, ...packageArgs),
          new Http('default'),
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
          new Http('default'),
        ),
      ).rejects.toThrow(`SHA256 checksum validation failed`);
    });

    it('should throw error for when extracting fails', async () => {
      const originalPipeline = cacheFs.pipeline;
      vi.spyOn(cacheFs, 'pipeline')
        .mockImplementationOnce(
          (...args: Parameters<typeof cacheFs.pipeline>) =>
            originalPipeline(...args),
        )
        .mockRejectedValueOnce(new Error('extract failed'));

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
        downloadAndExtractPackage(
          getComponentUrl(debBaseUrl, 'bullseye', 'main', 'amd64'),
          new Http('default'),
        ),
      ).rejects.toThrow(`Missing metadata in extracted package index file!`);
    });
  });
});
