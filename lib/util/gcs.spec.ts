import { getGCSClient, parseGCSUrl } from './gcs.ts';
import { parseUrl } from './url.ts';

const storageMock = vi.hoisted(() => ({
  loaded: false,
  Storage: vi.fn(),
}));

vi.mock('@google-cloud/storage', () => {
  storageMock.loaded = true;
  return { Storage: storageMock.Storage };
});

describe('util/gcs', () => {
  it('does not load the GCS client package until first use', async () => {
    expect(storageMock.loaded).toBeFalse();

    await getGCSClient();

    expect(storageMock.loaded).toBeTrue();
    expect(storageMock.Storage).toHaveBeenCalledOnce();
  });

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

  it('returns a singleton client instance', async () => {
    const client1 = await getGCSClient();
    const client2 = await getGCSClient();

    expect(client1).toBe(client2);
    expect(storageMock.Storage).not.toHaveBeenCalled();
  });
});
