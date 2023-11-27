import * as marshal from '@hyrious/marshal';
import { codeBlock } from 'common-tags';
import { getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import * as rubyVersioning from '../../versioning/ruby';
import { memCache } from './versions-endpoint-cache';
import { RubyGemsDatasource } from '.';

const rubygemsOrgVersions = codeBlock`
  created_at: 2023-01-01T00:00:00.000Z
  ---
  foobar 1.0.0,2.0.0,3.0.0 01010101010101010101010101010101
`;

const rubyMarshal = (data: unknown) => Buffer.from(marshal.dump(data));

describe('modules/datasource/rubygems/index', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      memCache.clear();
    });

    it('returns null for missing pkg', async () => {
      httpMock
        .scope('https://example.com')
        .get('/api/v1/versions/foobar.json')
        .reply(200, [])
        .get('/info/foobar')
        .reply(200, '')
        .get('/api/v1/dependencies?gems=foobar')
        .reply(200, rubyMarshal([]));
      expect(
        await getPkgReleases({
          versioning: rubyVersioning.id,
          datasource: RubyGemsDatasource.id,
          packageName: 'foobar',
          registryUrls: ['https://example.com'],
        }),
      ).toBeNull();
    });

    it('returns null for rubygems.org package miss', async () => {
      httpMock.scope('https://rubygems.org').get('/versions').reply(404);
      const res = await getPkgReleases({
        versioning: rubyVersioning.id,
        datasource: RubyGemsDatasource.id,
        packageName: 'foobar',
        registryUrls: [],
      });
      expect(res).toBeNull();
    });

    it('returns a dep for rubygems.org package hit', async () => {
      httpMock
        .scope('https://rubygems.org')
        .get('/versions')
        .reply(200, rubygemsOrgVersions)
        .get('/api/v1/versions/foobar.json')
        .reply(200, [
          { number: '1.0.0', created_at: '2021-01-01' },
          { number: '2.0.0', created_at: '2022-01-01' },
          { number: '3.0.0', created_at: '2023-01-01' },
        ])
        .get('/api/v1/gems/foobar.json')
        .reply(200, {});

      const res = await getPkgReleases({
        versioning: rubyVersioning.id,
        datasource: RubyGemsDatasource.id,
        packageName: 'foobar',
        registryUrls: [],
      });

      expect(res).toEqual({
        registryUrl: 'https://rubygems.org',
        releases: [
          { version: '1.0.0', releaseTimestamp: '2021-01-01T00:00:00.000Z' },
          { version: '2.0.0', releaseTimestamp: '2022-01-01T00:00:00.000Z' },
          { version: '3.0.0', releaseTimestamp: '2023-01-01T00:00:00.000Z' },
        ],
      });
    });

    it('uses rubygems.org if no registry urls were provided', async () => {
      httpMock
        .scope('https://rubygems.org')
        .get('/versions')
        .reply(200, rubygemsOrgVersions)
        .get('/api/v1/gems/foobar.json')
        .reply(200, {})
        .get('/api/v1/versions/foobar.json')
        .reply(200, [
          { number: '1.0.0', created_at: '2021-01-01' },
          { number: '2.0.0', created_at: '2022-01-01' },
          { number: '3.0.0', created_at: '2023-01-01' },
        ]);

      const res = await getPkgReleases({
        versioning: rubyVersioning.id,
        datasource: RubyGemsDatasource.id,
        packageName: 'foobar',
        registryUrls: [],
      });

      expect(res).toEqual({
        registryUrl: 'https://rubygems.org',
        releases: [
          { version: '1.0.0', releaseTimestamp: '2021-01-01T00:00:00.000Z' },
          { version: '2.0.0', releaseTimestamp: '2022-01-01T00:00:00.000Z' },
          { version: '3.0.0', releaseTimestamp: '2023-01-01T00:00:00.000Z' },
        ],
      });
    });

    it('uses multiple source urls', async () => {
      httpMock
        .scope('https://registry-1.com/')
        .get('/api/v1/versions/foobar.json')
        .reply(404)
        .get('/info/foobar')
        .reply(404)
        .get('/api/v1/dependencies?gems=foobar')
        .reply(404);

      httpMock
        .scope('https://registry-2.com/nested/path')
        .get('/api/v1/gems/foobar.json')
        .reply(200, {})
        .get('/api/v1/versions/foobar.json')
        .reply(200, [
          { number: '1.0.0', created_at: '2021-01-01' },
          { number: '2.0.0', created_at: '2022-01-01' },
          { number: '3.0.0', created_at: '2023-01-01' },
        ]);

      const res = await getPkgReleases({
        versioning: rubyVersioning.id,
        datasource: RubyGemsDatasource.id,
        packageName: 'foobar',
        registryUrls: [
          'https://registry-1.com',
          'https://registry-2.com/nested/path',
        ],
      });

      expect(res).toEqual({
        registryUrl: 'https://registry-2.com/nested/path',
        releases: [
          { version: '1.0.0', releaseTimestamp: '2021-01-01T00:00:00.000Z' },
          { version: '2.0.0', releaseTimestamp: '2022-01-01T00:00:00.000Z' },
          { version: '3.0.0', releaseTimestamp: '2023-01-01T00:00:00.000Z' },
        ],
      });
    });

    it('falls back to dependencies API', async () => {
      httpMock
        .scope('https://example.com/')
        .get('/api/v1/versions/foobar.json')
        .reply(404, {})
        .get('/info/foobar')
        .reply(404)
        .get('/api/v1/dependencies?gems=foobar')
        .reply(
          200,
          rubyMarshal([
            { number: '1.0.0' },
            { number: '2.0.0' },
            { number: '3.0.0' },
          ]),
        );

      const res = await getPkgReleases({
        versioning: rubyVersioning.id,
        datasource: RubyGemsDatasource.id,
        packageName: 'foobar',
        registryUrls: ['https://example.com'],
      });

      expect(res).toEqual({
        registryUrl: 'https://example.com',
        releases: [
          { version: '1.0.0' },
          { version: '2.0.0' },
          { version: '3.0.0' },
        ],
      });
    });

    it('supports /info endpoint', async () => {
      httpMock
        .scope('https://example.com/')
        .get('/api/v1/versions/foobar.json')
        .reply(404)
        .get('/info/foobar')
        .reply(
          200,
          codeBlock`
            1.0.0 |checksum:aaa
            2.0.0 |checksum:bbb
            3.0.0 |checksum:ccc
          `,
        );

      const res = await getPkgReleases({
        versioning: rubyVersioning.id,
        datasource: RubyGemsDatasource.id,
        packageName: 'foobar',
        registryUrls: ['https://example.com'],
      });
      expect(res).toEqual({
        registryUrl: 'https://example.com',
        releases: [
          { version: '1.0.0' },
          { version: '2.0.0' },
          { version: '3.0.0' },
        ],
      });
    });

    it('errors when version request fails with server error', async () => {
      httpMock
        .scope('https://example.com/')
        .get('/api/v1/versions/foobar.json')
        .reply(500);

      await expect(
        getPkgReleases({
          versioning: rubyVersioning.id,
          datasource: RubyGemsDatasource.id,
          packageName: 'foobar',
          registryUrls: ['https://example.com'],
        }),
      ).rejects.toThrow(ExternalHostError);
    });

    it('errors when dependencies request fails server error', async () => {
      httpMock
        .scope('https://example.com/')
        .get('/info/foobar')
        .reply(404)
        .get('/api/v1/versions/foobar.json')
        .reply(404)
        .get('/api/v1/dependencies?gems=foobar')
        .reply(500);

      await expect(
        getPkgReleases({
          versioning: rubyVersioning.id,
          datasource: RubyGemsDatasource.id,
          packageName: 'foobar',
          registryUrls: ['https://example.com'],
        }),
      ).rejects.toThrow(ExternalHostError);
    });

    it('returns null for GitHub Packages package miss', async () => {
      httpMock
        .scope('https://rubygems.pkg.github.com/example')
        .get('/api/v1/dependencies?gems=foobar')
        .reply(200, rubyMarshal([]));

      const res = await getPkgReleases({
        versioning: rubyVersioning.id,
        datasource: RubyGemsDatasource.id,
        packageName: 'foobar',
        registryUrls: ['https://rubygems.pkg.github.com/example'],
      });

      expect(res).toBeNull();
    });

    it('returns a dep for GitHub Packages package hit', async () => {
      httpMock
        .scope('https://rubygems.pkg.github.com/example')
        .get('/api/v1/dependencies?gems=foobar')
        .reply(
          200,
          rubyMarshal([
            { number: '1.0.0' },
            { number: '2.0.0' },
            { number: '3.0.0' },
          ]),
        );

      const res = await getPkgReleases({
        versioning: rubyVersioning.id,
        datasource: RubyGemsDatasource.id,
        packageName: 'foobar',
        registryUrls: ['https://rubygems.pkg.github.com/example'],
      });

      expect(res).toEqual({
        registryUrl: 'https://rubygems.pkg.github.com/example',
        releases: [
          { version: '1.0.0' },
          { version: '2.0.0' },
          { version: '3.0.0' },
        ],
      });
    });
  });
});
