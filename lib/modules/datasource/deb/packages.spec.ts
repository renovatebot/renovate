import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import * as upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { toSha256 } from '../../../util/hash';
import { Http } from '../../../util/http';

import { cacheSubDir } from './common';
import { computeFileChecksum, mockFetchInReleaseContent } from './index.spec';
import { downloadAndExtractPackage } from './packages';
import { getComponentUrl, getPackageUrl } from './url';
import * as utils from './utils';
import { Fixtures } from '~test/fixtures';
import * as httpMock from '~test/http-mock';
import { fs } from '~test/util';

const debBaseUrl = 'http://deb.debian.org';

describe('modules/datasource/deb/packages', () => {
  // const fixturePackagesArchivePath = Fixtures.getPath(`Packages.gz`);
  const fixturePackagesArchivePath2 = Fixtures.getPath(`Packages2.gz`);
  // const fixturePackagesPath = Fixtures.getPath(`Packages`);
  // let fixturePackagesArchiveHash: string;
  let fixturePackagesArchiveHash2: string;

  let cacheDir: DirectoryResult | null;
  // let cfg: GetPkgReleasesConfig;
  let extractionFolder: string;
  let extractedPackageFile: string;

  beforeEach(async () => {
    cacheDir = await dir({ unsafeCleanup: true });
    GlobalConfig.set({ cacheDir: cacheDir.path });

    extractionFolder = await fs.ensureCacheDir(cacheSubDir);
    extractedPackageFile = upath.join(
      extractionFolder,
      `${toSha256(getComponentUrl(debBaseUrl, 'stable', 'non-free', 'amd64'))}.txt`,
    );

    // cfg = {
    //   datasource: 'deb',
    //   packageName: 'album',
    //   registryUrls: [
    //     getRegistryUrl(debBaseUrl, 'stable', ['non-free'], 'amd64'),
    //   ],
    // };

    // fixturePackagesArchiveHash = await computeFileChecksum(
    //   fixturePackagesArchivePath,
    // );
    fixturePackagesArchiveHash2 = await computeFileChecksum(
      fixturePackagesArchivePath2,
    );
  });

  afterEach(async () => {
    await cacheDir?.cleanup();
    cacheDir = null;
  });

  describe('downloadAndExtractPackage', () => {
    const debBaseUrl = 'http://deb.debian.org';

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
      vi.spyOn(utils, 'extract').mockRejectedValueOnce(new Error());

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
