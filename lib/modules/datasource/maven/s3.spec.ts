import { parseS3Url } from './s3';

describe('modules/datasource/maven/s3', () => {
  it('parses S3 URLs', () => {
    expect(parseS3Url('s3://bucket/key/path')).toEqual({
      Bucket: 'bucket',
      Key: 'key/path',
    });
  });
});
