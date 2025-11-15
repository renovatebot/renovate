import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { toSha256 } from '../../../util/hash';
import { Http } from '../../../util/http';
import { joinUrlParts } from '../../../util/url';
import { cacheSubDir } from './common';
import { getComponentUrl } from './index.spec';
import { getReleaseFileContent } from './release';
import * as httpMock from '~test/http-mock';
import { fs } from '~test/util';

const debBaseUrl = 'http://deb.debian.org';

describe('modules/datasource/deb/release', () => {
  const packageArgs: [release: string, component: string, arch: string] = [
    'stable',
    'non-free',
    'amd64',
  ];

  describe('getReleaseFileContent', () => {
    let cacheDir: DirectoryResult | null;
    let releaseFolder: string;
    let releaseFilePath: string;
    const contentOfInReleaseFile = 'content of InRelease file';
    const relativeReleaseFilePath = `/debian/dists/bullseye`;
    const releaseFileFolderUri = joinUrlParts(
      debBaseUrl,
      relativeReleaseFilePath,
    );

    beforeEach(async () => {
      cacheDir = await dir({ unsafeCleanup: true });
      GlobalConfig.set({ cacheDir: cacheDir.path });

      releaseFolder = await fs.ensureCacheDir(cacheSubDir);
      releaseFilePath = upath.join(
        releaseFolder,
        `${toSha256(getComponentUrl(debBaseUrl, ...packageArgs))}.txt`,
      );
    });

    afterEach(async () => {
      await cacheDir?.cleanup();
      cacheDir = null;
    });

    it('falls back to Release file if InRelease is not available', async () => {
      // no InRelease available
      httpMock
        .scope(debBaseUrl)
        .get(joinUrlParts(relativeReleaseFilePath, 'InRelease'))
        .reply(404, contentOfInReleaseFile);

      // Release available
      httpMock
        .scope(debBaseUrl)
        .get(joinUrlParts(relativeReleaseFilePath, 'Release'))
        .reply(200, contentOfInReleaseFile);

      const res = await getReleaseFileContent(
        releaseFileFolderUri,
        releaseFilePath,
        new Http('deb'),
      );
      expect(res).toEqual(contentOfInReleaseFile);
    });

    it('throws an error if neither InRelease nor Release file could be downloaded', async () => {
      // no InRelease available
      httpMock
        .scope(debBaseUrl)
        .get(joinUrlParts(relativeReleaseFilePath, 'InRelease'))
        .reply(404, 'Not Found');

      // Release available
      httpMock
        .scope(debBaseUrl)
        .get(joinUrlParts(relativeReleaseFilePath, 'Release'))
        .reply(404, 'Not Found');

      await expect(
        getReleaseFileContent(
          releaseFileFolderUri,
          releaseFilePath,
          new Http('deb'),
        ),
      ).rejects.toThrowError('Could not fetch InRelease or Release file');
    });

    it('does not download if file was not modified', async () => {
      // write file to cache
      await fs.outputCacheFile(releaseFilePath, contentOfInReleaseFile);

      // mock http head request
      httpMock
        .scope(debBaseUrl)
        .head(joinUrlParts(relativeReleaseFilePath, 'InRelease'))
        .reply(304, 'Not Modified');

      await expect(
        getReleaseFileContent(
          releaseFileFolderUri,
          releaseFilePath,
          new Http('deb'),
        ),
      ).resolves.toEqual(contentOfInReleaseFile);
    });

    it('proceed with download if modification of file cannot be determined', async () => {
      // write file to cache
      await fs.outputCacheFile(releaseFilePath, contentOfInReleaseFile);

      // mock http head request
      httpMock
        .scope(debBaseUrl)
        .head(joinUrlParts(relativeReleaseFilePath, 'InRelease'))
        .reply(500, 'Internal Server Error');

      // mock http get request
      httpMock
        .scope(debBaseUrl)
        .get(joinUrlParts(relativeReleaseFilePath, 'InRelease'))
        .reply(200, contentOfInReleaseFile);

      const res = await getReleaseFileContent(
        releaseFileFolderUri,
        releaseFilePath,
        new Http('deb'),
      );
      expect(res).toEqual(contentOfInReleaseFile);
    });
  });
});
