import { parseS3Url } from './s3';

describe('util/s3', () => {
  it('parses S3 URLs', () => {
    expect(parseS3Url('s3://bucket/key/path')).toEqual({
      Bucket: 'bucket',
      Key: 'key/path',
    });
  });

  it('returns null for non-S3 URLs', () => {
    expect(parseS3Url('http://example.com/key/path')).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(parseS3Url('thisisnotaurl')).toBeNull();
  });
});
