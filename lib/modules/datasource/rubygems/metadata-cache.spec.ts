import * as httpMock from '../../../../test/http-mock';
import { mocked } from '../../../../test/util';
import * as _packageCache from '../../../util/cache/package';
import { Http } from '../../../util/http';
import { MetadataCache } from './metadata-cache';

jest.mock('../../../util/cache/package');
const packageCache = mocked(_packageCache);

describe('modules/datasource/rubygems/metadata-cache', () => {
  const packageCacheMock: Map<string, unknown> = new Map();

  beforeEach(() => {
    packageCacheMock.clear();

    packageCache.get.mockImplementation(
      (ns, key) =>
        Promise.resolve(packageCacheMock.get(`${ns}::${key}`)) as never,
    );

    packageCache.set.mockImplementation((ns, key, value) => {
      packageCacheMock.set(`${ns}::${key}`, value);
      return Promise.resolve() as never;
    });
  });

  it('fetches data', async () => {
    const cache = new MetadataCache(new Http('test'));

    httpMock
      .scope('https://rubygems.org')
      .get('/api/v1/versions/foobar.json')
      .reply(200, [
        {
          number: '1.0.0',
          created_at: '2021-01-01',
          metadata: {
            changelog_uri: 'https://v1.example.com/changelog',
            source_code_uri: 'https://v1.example.com/source',
          },
        },
        {
          number: '2.0.0',
          created_at: '2022-01-01',
          metadata: {
            changelog_uri: 'https://v2.example.com/changelog',
            source_code_uri: 'https://v2.example.com/source',
          },
        },
        {
          number: '3.0.0',
          created_at: '2023-01-01',
          metadata: {
            changelog_uri: 'https://v3.example.com/changelog',
            source_code_uri: 'https://v3.example.com/source',
          },
        },
      ])
      .get('/api/v1/gems/foobar.json')
      .reply(200, {
        name: 'foobar',
        created_at: '2023-01-01',
        changelog_uri: 'https://example.com/changelog',
        source_code_uri: 'https://example.com/source',
        homepage_uri: 'https://example.com',
      });

    const res = await cache.getRelease('https://rubygems.org', 'foobar', [
      '1.0.0',
      '2.0.0',
      '3.0.0',
    ]);

    expect(res).toEqual({
      changelogUrl: 'https://example.com/changelog',
      sourceUrl: 'https://example.com/source',
      homepage: 'https://example.com',
      releases: [
        {
          version: '1.0.0',
          releaseTimestamp: '2021-01-01',
          changelogUrl: 'https://v1.example.com/changelog',
          sourceUrl: 'https://v1.example.com/source',
        },
        {
          version: '2.0.0',
          releaseTimestamp: '2022-01-01',
          changelogUrl: 'https://v2.example.com/changelog',
          sourceUrl: 'https://v2.example.com/source',
        },
        {
          version: '3.0.0',
          releaseTimestamp: '2023-01-01',
          changelogUrl: 'https://v3.example.com/changelog',
          sourceUrl: 'https://v3.example.com/source',
        },
      ],
    });
  });

  it('handles inconsistent data between versions and endpoint', async () => {
    const cache = new MetadataCache(new Http('test'));

    httpMock
      .scope('https://rubygems.org')
      .get('/api/v1/versions/foobar.json')
      .reply(200, [
        { number: '1.0.0', created_at: '2021-01-01' },
        { number: '2.0.0', created_at: '2022-01-01' },
        { number: '3.0.0', created_at: '2023-01-01' },
      ])
      .get('/api/v1/gems/foobar.json')
      .reply(200, {
        name: 'foobar',
        created_at: '2023-01-01',
        changelog_uri: 'https://example.com/changelog',
        source_code_uri: 'https://example.com/source',
        homepage_uri: 'https://example.com',
      });

    const res = await cache.getRelease('https://rubygems.org', 'foobar', [
      '1.0.0',
      '2.0.0',
      '3.0.0',
      '4.0.0',
    ]);

    expect(res).toEqual({
      releases: [
        { version: '1.0.0' },
        { version: '2.0.0' },
        { version: '3.0.0' },
        { version: '4.0.0' },
      ],
    });
  });

  it('handles inconsistent data between cache and endpoint', async () => {
    packageCacheMock.set(
      'datasource-rubygems::metadata-cache:https://rubygems.org:foobar',
      {
        hash: '123',
        createdAt: '2021-01-01',
        data: {
          releases: [
            { version: '1.0.0' },
            { version: '2.0.0' },
            { version: '3.0.0' },
          ],
        },
      },
    );
    const cache = new MetadataCache(new Http('test'));

    httpMock
      .scope('https://rubygems.org')
      .get('/api/v1/versions/foobar.json')
      .reply(200, [
        { number: '1.0.0', created_at: '2021-01-01' },
        { number: '2.0.0', created_at: '2022-01-01' },
        { number: '3.0.0', created_at: '2023-01-01' },
      ])
      .get('/api/v1/gems/foobar.json')
      .reply(200, {
        name: 'foobar',
        created_at: '2023-01-01',
        changelog_uri: 'https://example.com/changelog',
        source_code_uri: 'https://example.com/source',
        homepage_uri: 'https://example.com',
      });

    const res = await cache.getRelease('https://rubygems.org', 'foobar', [
      '1.0.0',
      '2.0.0',
      '3.0.0',
      '4.0.0',
    ]);

    expect(res).toEqual({
      releases: [
        { version: '1.0.0' },
        { version: '2.0.0' },
        { version: '3.0.0' },
      ],
    });
    expect(packageCache.set).toHaveBeenCalledWith(
      'datasource-rubygems',
      'metadata-cache:https://rubygems.org:foobar',
      {
        createdAt: '2021-01-01',
        data: {
          releases: [
            { version: '1.0.0' },
            { version: '2.0.0' },
            { version: '3.0.0' },
          ],
        },
        hash: '123',
        isFallback: true,
      },
      24 * 60,
    );
  });

  it('returns cached data', async () => {
    const cache = new MetadataCache(new Http('test'));

    httpMock
      .scope('https://rubygems.org')
      .get('/api/v1/versions/foobar.json')
      .reply(200, [
        { number: '1.0.0', created_at: '2021-01-01' },
        { number: '2.0.0', created_at: '2022-01-01' },
        { number: '3.0.0', created_at: '2023-01-01' },
      ])
      .get('/api/v1/gems/foobar.json')
      .reply(200, { name: 'foobar' });

    const versions = ['1.0.0', '2.0.0', '3.0.0'];

    const res1 = await cache.getRelease(
      'https://rubygems.org',
      'foobar',
      versions,
    );
    const res2 = await cache.getRelease(
      'https://rubygems.org',
      'foobar',
      versions,
    );

    expect(res1).toEqual(res2);
    expect(packageCache.set).toHaveBeenCalledOnce();
  });

  it('fetches for stale key', async () => {
    const cache = new MetadataCache(new Http('test'));

    const oldVersions = [
      { number: '1.0.0', created_at: '2021-01-01' },
      { number: '2.0.0', created_at: '2022-01-01' },
    ];
    httpMock
      .scope('https://rubygems.org')
      .get('/api/v1/versions/foobar.json')
      .reply(200, oldVersions)
      .get('/api/v1/gems/foobar.json')
      .reply(200, { name: 'foobar' });

    const res1 = await cache.getRelease('https://rubygems.org', 'foobar', [
      '1.0.0',
      '2.0.0',
    ]);
    expect(res1).toMatchObject({
      releases: [{ version: '1.0.0' }, { version: '2.0.0' }],
    });

    httpMock
      .scope('https://rubygems.org')
      .get('/api/v1/versions/foobar.json')
      .reply(200, [
        ...oldVersions,
        { number: '3.0.0', created_at: '2023-01-01' },
      ])
      .get('/api/v1/gems/foobar.json')
      .reply(200, { name: 'foobar' });

    const res2 = await cache.getRelease('https://rubygems.org', 'foobar', [
      '1.0.0',
      '2.0.0',
      '3.0.0',
    ]);

    expect(res2).toMatchObject({
      releases: [
        { version: '1.0.0' },
        { version: '2.0.0' },
        { version: '3.0.0' },
      ],
    });
    expect(packageCache.set).toHaveBeenCalledTimes(2);
  });

  it('returns fallback results on 404', async () => {
    const cache = new MetadataCache(new Http('test'));

    httpMock
      .scope('https://rubygems.org')
      .get('/api/v1/versions/foobar.json')
      .reply(404);

    const versions = ['1', '2', '3'];
    const res = await cache.getRelease(
      'https://rubygems.org',
      'foobar',
      versions,
    );

    expect(res).toEqual({
      releases: [{ version: '1' }, { version: '2' }, { version: '3' }],
    });
  });

  it('returns fallback result on unknown error', async () => {
    const cache = new MetadataCache(new Http('test'));

    httpMock
      .scope('https://rubygems.org')
      .get('/api/v1/versions/foobar.json')
      .reply(500);

    const versions = ['1', '2', '3'];
    const res = await cache.getRelease(
      'https://rubygems.org',
      'foobar',
      versions,
    );

    expect(res).toEqual({
      releases: [{ version: '1' }, { version: '2' }, { version: '3' }],
    });
  });
});
