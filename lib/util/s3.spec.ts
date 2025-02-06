import { getS3Client, parseS3Url } from './s3';

describe('util/s3', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('parses S3 URLs', () => {
    expect(parseS3Url('s3://bucket/key/path')).toEqual({
      Bucket: 'bucket',
      Key: 'key/path',
    });
  });

  it('returns null for non-S3 URLs', () => {
    expect(parseS3Url(new URL('http://example.com/key/path'))).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(parseS3Url('thisisnotaurl')).toBeNull();
  });

  it('returns a singleton S3 client instance', () => {
    const client1 = getS3Client();
    const client2 = getS3Client();
    expect(client1).toBe(client2);
  });

  it('uses user-configured s3 values', async () => {
    const s3 = await import('./s3');
    const globalConfig = await import('../config/global');
    globalConfig.GlobalConfig.set({
      s3Endpoint: 'https://minio.domain.test',
      s3PathStyle: true,
    });
    const client1 = s3.getS3Client();
    const client2 = getS3Client();
    expect(client1).not.toBe(client2);
    expect(await client1.config.endpoint?.()).toStrictEqual({
      hostname: 'minio.domain.test',
      path: '/',
      port: undefined,
      protocol: 'https:',
      query: undefined,
    });
    expect(client1.config.forcePathStyle).toBeTrue();
  });

  it('uses s3 values from globalConfig instead of GlobalConfig class', async () => {
    const s3 = await import('./s3');
    const client1 = s3.getS3Client('https://minio.domain.test', true);
    const client2 = getS3Client('https://minio.domain.test', true);
    expect(client1).not.toBe(client2);
    expect(await client1.config.endpoint?.()).toStrictEqual({
      hostname: 'minio.domain.test',
      path: '/',
      port: undefined,
      protocol: 'https:',
      query: undefined,
    });
    expect(client1.config.forcePathStyle).toBeTrue();
  });
});
