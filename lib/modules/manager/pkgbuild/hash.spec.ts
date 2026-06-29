import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import * as httpMock from '~test/http-mock.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { computeChecksums } from './hash.ts';

const testContent = Buffer.from('hello pkgbuild');

describe('modules/manager/pkgbuild/hash', () => {
  let cacheDir: DirectoryResult;

  beforeEach(async () => {
    cacheDir = await dir({ unsafeCleanup: true });
    GlobalConfig.set({ cacheDir: cacheDir.path });
  });

  afterEach(() => cacheDir.cleanup());

  it('downloads file and computes all checksums', async () => {
    httpMock
      .scope('https://example.com')
      .get('/pkg-1.0.0.tar.gz')
      .reply(200, testContent);

    const result = await computeChecksums(
      'https://example.com/pkg-1.0.0.tar.gz',
    );

    expect(result.sha256).toHaveLength(64);
    expect(result.sha512).toHaveLength(128);
    expect(result.b2).toHaveLength(128);
    expect(result.md5).toHaveLength(32);
  });

  it('computes correct sha256 checksum', async () => {
    httpMock
      .scope('https://example.com')
      .get('/hello.tar.gz')
      .reply(200, testContent);

    const result = await computeChecksums('https://example.com/hello.tar.gz');

    expect(result.sha256).toBe(
      '1a124a49ced790cba03d96887ddc64b24a2895d2c9963c61d9009d9670704417',
    );
  });

  it('throws on HTTP error', async () => {
    httpMock
      .scope('https://example.com')
      .get('/error-1.0.0.tar.gz')
      .replyWithError('connection refused');

    await expect(
      computeChecksums('https://example.com/error-1.0.0.tar.gz'),
    ).rejects.toThrow();
  });

  it('handles URL with trailing slash', async () => {
    httpMock.scope('https://example.com').get('/path/').reply(200, testContent);

    const result = await computeChecksums('https://example.com/path/');

    expect(result.sha256).toHaveLength(64);
  });

  it('falls back to "download" filename when URL has no path segments', async () => {
    httpMock.scope('https://example.com').get('/').reply(200, testContent);

    const result = await computeChecksums('https://example.com/');

    expect(result.sha256).toHaveLength(64);
  });
});
