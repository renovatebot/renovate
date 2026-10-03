import { Storage } from '@google-cloud/storage';
import { getGCSClient, parseGCSUrl } from './gcs.ts';
import { parseUrl } from './url.ts';

vi.mock('@google-cloud/storage');

describe('util/gcs', () => {
  it('parses GCS URLs', () => {
    expect(parseGCSUrl('gs://bucket/key/path')).toEqual({
      bucket: 'bucket',
      pathname: 'key/path',
    });
  });

  it('parses GCS URL instances', () => {
    expect(parseGCSUrl(parseUrl('gs://bucket/key/path')!)).toEqual({
      bucket: 'bucket',
      pathname: 'key/path',
    });
  });

  it('returns null for non-GCS URLs', () => {
    expect(parseGCSUrl('s3://bucket/key/path')).toBeNull();
  });

  it('returns null for non-GCS URL instances', () => {
    expect(parseGCSUrl(parseUrl('http://example.com/key/path')!)).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(parseGCSUrl('thisisnotaurl')).toBeNull();
  });

  it('returns a singleton client instance', () => {
    const client1 = getGCSClient();
    const client2 = getGCSClient();

    expect(client1).toBe(client2);
    expect(Storage).toHaveBeenCalledTimes(1);
  });
});
