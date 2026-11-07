import { promisify } from 'node:util';
import zlib from 'node:zlib';
import * as httpMock from '~test/http-mock.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import { hash } from '../../../util/hash.ts';
import { Http } from '../../../util/http/index.ts';
import { getPathInVcs } from './crate-zip.ts';

const deflateRaw = promisify(zlib.deflateRaw);

const zipBaseUrl = 'https://static.crates.io/crates/toml';
const zipPath = '/toml-1.2.0+spec-1.1.0.zip';
const version = '1.2.0+spec-1.1.0';

const http = new Http('crate');

interface VcsInfoOptions {
  compression?: 'deflate' | 'store';
  ignoresRange?: boolean;
  uncompressedSize?: number;
  sha256?: string;
}

async function mockVcsInfo(
  vcsInfo: string,
  {
    compression = 'deflate',
    ignoresRange = false,
    uncompressedSize = Buffer.byteLength(vcsInfo),
    sha256 = hash(vcsInfo, 'sha256'),
  }: VcsInfoOptions = {},
): Promise<void> {
  const prefix = Buffer.from('PK\x03\x04 other entries');
  let data = Buffer.from(vcsInfo);
  if (compression === 'deflate') {
    data = await deflateRaw(vcsInfo);
  }
  const start = prefix.length;
  const end = start + data.length - 1;

  const scope = httpMock.scope(zipBaseUrl);
  scope.get(`${zipPath}.json`).reply(200, {
    files: [
      {
        path: '.cargo_vcs_info.json',
        data_offset: start,
        compressed_size: data.length,
        uncompressed_size: uncompressedSize,
        compression,
        sha256,
      },
    ],
  });

  const zip = scope.get(zipPath).matchHeader('range', `bytes=${start}-${end}`);
  if (ignoresRange) {
    zip.reply(200, Buffer.concat([prefix, data, Buffer.from('trailer')]));
  } else {
    zip.reply(206, data);
  }
}

function vcsInfoCacheWrites() {
  return vi
    .mocked(packageCache.setWithRawTtl)
    .mock.calls.filter(
      ([namespace]) => namespace === 'datasource-crate-vcs-info',
    );
}

describe('modules/datasource/crate/crate-zip', () => {
  beforeEach(() => {
    vi.spyOn(packageCache, 'setWithRawTtl');
  });

  it('reads a deflated entry with a range request and caches the result', async () => {
    await mockVcsInfo('{"git":{"sha1":"8ffe3c5"},"path_in_vcs":"crates/toml"}');

    const res = await getPathInVcs(http, 'toml', version);

    expect(res).toBe('crates/toml');
    expect(vcsInfoCacheWrites()).toEqual([
      [
        'datasource-crate-vcs-info',
        expect.any(String),
        expect.anything(),
        30 * 24 * 60,
      ],
    ]);
  });

  it('extracts a stored entry when the server ignores the Range header', async () => {
    await mockVcsInfo('{"path_in_vcs":"crates/toml"}', {
      compression: 'store',
      ignoresRange: true,
    });

    const res = await getPathInVcs(http, 'toml', version);

    expect(res).toBe('crates/toml');
  });

  it.each`
    description         | vcsInfo
    ${'at the root'}    | ${'{"path_in_vcs":""}'}
    ${'without a path'} | ${'{"git":{"sha1":"8ffe3c5"}}'}
  `(
    'caches an empty path for crates published $description',
    async ({ vcsInfo }) => {
      await mockVcsInfo(vcsInfo);

      const res = await getPathInVcs(http, 'toml', version);

      expect(res).toBe('');
      expect(vcsInfoCacheWrites()).toHaveLength(1);
    },
  );

  it('caches crates without .cargo_vcs_info.json', async () => {
    httpMock.scope(zipBaseUrl).get(`${zipPath}.json`).reply(200, { files: [] });

    const res = await getPathInVcs(http, 'toml', version);

    expect(res).toBeNull();
    expect(vcsInfoCacheWrites()).toHaveLength(1);
  });

  it('does not cache a malformed manifest entry', async () => {
    httpMock
      .scope(zipBaseUrl)
      .get(`${zipPath}.json`)
      .reply(200, { files: [{ path: '.cargo_vcs_info.json' }] });

    const res = await getPathInVcs(http, 'toml', version);

    expect(res).toBeNull();
    expect(vcsInfoCacheWrites()).toBeEmpty();
  });

  it('does not cache invalid JSON', async () => {
    await mockVcsInfo('{"path_in_vcs":');

    const res = await getPathInVcs(http, 'toml', version);

    expect(res).toBeNull();
    expect(vcsInfoCacheWrites()).toBeEmpty();
  });

  it('does not cache a missing manifest', async () => {
    httpMock.scope(zipBaseUrl).get(`${zipPath}.json`).reply(404);

    const res = await getPathInVcs(http, 'toml', version);

    expect(res).toBeNull();
    expect(vcsInfoCacheWrites()).toBeEmpty();
  });

  it('does not cache a missing zip file', async () => {
    const scope = httpMock.scope(zipBaseUrl);
    scope.get(`${zipPath}.json`).reply(200, {
      files: [
        {
          path: '.cargo_vcs_info.json',
          data_offset: 0,
          compressed_size: 10,
          uncompressed_size: 10,
          compression: 'store',
          sha256: 'f'.repeat(64),
        },
      ],
    });
    scope.get(zipPath).reply(404);

    const res = await getPathInVcs(http, 'toml', version);

    expect(res).toBeNull();
    expect(vcsInfoCacheWrites()).toBeEmpty();
  });

  it.each`
    description            | options
    ${'uncompressed size'} | ${{ uncompressedSize: 1 }}
    ${'SHA-256'}           | ${{ sha256: 'f'.repeat(64) }}
  `(
    'does not cache an entry with a mismatching $description',
    async ({ options }) => {
      await mockVcsInfo('{"path_in_vcs":"crates/toml"}', options);

      const res = await getPathInVcs(http, 'toml', version);

      expect(res).toBeNull();
      expect(vcsInfoCacheWrites()).toBeEmpty();
    },
  );
});
