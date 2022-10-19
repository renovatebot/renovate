import { getS3Client, parseS3Url } from './s3';

describe('util/s3', () => {
  afterEach(() => {
    delete process.env.RENOVATE_X_S3_ENDPOINT;
    delete process.env.RENOVATE_X_S3_PATH_STYLE;
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

  it('is uses experimental env', async () => {
    process.env.RENOVATE_X_S3_ENDPOINT = 'https://minio.domain.test';
    process.env.RENOVATE_X_S3_PATH_STYLE = 'true';
    const s3 = await import('./s3');
    const client1 = s3.getS3Client();
    const client2 = getS3Client();
    expect(client1).not.toBe(client2);
    expect(await client1.config.endpoint()).toStrictEqual({
      hostname: 'minio.domain.test',
      path: '/',
      port: undefined,
      protocol: 'https:',
      query: undefined,
    });
    expect(client1.config.forcePathStyle).toBeTrue();
  });
});
