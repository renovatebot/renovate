import { getGcsClient, parseGcsUrl } from './gcs';

describe('util/gcs', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('parses GCS URLs', () => {
    expect(parseGcsUrl('gs://bucket/dir1/dir2')).toEqual({
      bucket: 'bucket',
      pathname: 'dir1/dir2',
    });
  });

  it('returns null for non-GCS URLs', () => {
    expect(parseGcsUrl(new URL('http://example.com/dir1/dir2'))).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(parseGcsUrl('thisisnotaurl')).toBeNull();
  });

  it('returns a singleton GCS client instance', () => {
    const client1 = getGcsClient();
    const client2 = getGcsClient();
    expect(client1).toBe(client2);
  });

  it('uses user-configured GCS values', async () => {
    const gcs = await import('./gcs.js');
    const globalConfig = await import('../config/global.js');
    globalConfig.GlobalConfig.set({
      gcsEndpoint: 'https://minio.domain.test',
    });
    const client1 = gcs.getGcsClient();
    const client2 = getGcsClient();
    expect(client1).not.toBe(client2);
    expect(client1.apiEndpoint).toBe('https://minio.domain.test');
  });
});
