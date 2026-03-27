import { satisfies } from '@renovatebot/pep440';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import * as githubGraphql from '../../../util/github/graphql/index.ts';
import type { Timestamp } from '../../../util/timestamp.ts';
import { registryUrl as eolRegistryUrl } from '../endoflife-date/common.ts';
import { getPkgReleases } from '../index.ts';
import { datasource, defaultRegistryUrl } from './common.ts';
import { PythonVersionDatasource } from './index.ts';

describe('modules/datasource/python-version/index', () => {
  describe('dependent datasources', () => {
    it('returns Python EOL data', async () => {
      const datasource = new PythonVersionDatasource();
      httpMock
        .scope(eolRegistryUrl)
        .get('/python.json')
        .reply(200, Fixtures.get('eol.json'));
      const res = await datasource.getEolReleases();
      expect(
        res?.releases.find((release) => release.version === '3.7.17')
          ?.isDeprecated,
      ).toBeTrue();
    });
  });

  describe('getReleases', () => {
    beforeEach(() => {
      httpMock
        .scope('https://endoflife.date')
        .get('/api/python.json')
        .reply(200, Fixtures.get('eol.json'));

      vi.spyOn(githubGraphql, 'queryReleases').mockResolvedValueOnce([
        {
          id: 1,
          url: 'https://example.com',
          name: 'containerbase/python-prebuild',
          description: 'some description',
          version: '3.12.1',
          releaseTimestamp: '2020-03-09T13:00:00Z' as Timestamp,
        },
        {
          id: 2,
          url: 'https://example.com',
          name: 'containerbase/python-prebuild',
          description: 'some description',
          version: '3.12.0',
          releaseTimestamp: '2020-03-09T13:00:00Z' as Timestamp,
        },
        {
          id: 3,
          url: 'https://example.com',
          name: 'containerbase/python-prebuild',
          description: 'some description',
          version: '3.7.8',
          releaseTimestamp: '2020-03-09T13:00:00Z' as Timestamp,
        },
      ]);
    });

    it('throws for 500', async () => {
      httpMock.scope(defaultRegistryUrl).get('').reply(500);
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'python',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for error', async () => {
      httpMock.scope(defaultRegistryUrl).get('').replyWithError('error');
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'python',
        }),
      ).toBeNull();
    });

    it('falls back to prebuild releases on 429', async () => {
      httpMock.scope(defaultRegistryUrl).get('').reply(429);
      const res = await getPkgReleases({
        datasource,
        packageName: 'python',
      });
      expect(res?.releases).toHaveLength(3);
      const versions = res?.releases.map((r) => r.version);
      expect(versions).toContain('3.12.1');
      expect(versions).toContain('3.12.0');
      expect(versions).toContain('3.7.8');
      expect(
        res?.releases.find((r) => r.version === '3.7.8')?.isDeprecated,
      ).toBeTrue();
      expect(
        res?.releases.find((r) => r.version === '3.12.1')?.isDeprecated,
      ).toBeFalse();
    });

    it('returns null on 429 when prebuild releases are unavailable', async () => {
      vi.spyOn(
        PythonVersionDatasource.prototype,
        'getPrebuildReleases',
      ).mockResolvedValueOnce(null);
      httpMock.scope(defaultRegistryUrl).get('').reply(429);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'python',
        }),
      ).toBeNull();
    });

    it('returns null for empty 200 OK', async () => {
      httpMock.scope(defaultRegistryUrl).get('').reply(200, []);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'python',
        }),
      ).toBeNull();
    });

    describe('processes real data', () => {
      beforeEach(() => {
        httpMock
          .scope(defaultRegistryUrl)
          .get('')
          .reply(200, Fixtures.get('release.json'));
      });

      it('returns the correct data', async () => {
        const res = await getPkgReleases({
          datasource,
          packageName: 'python',
        });
        expect(res?.releases[0]).toEqual({
          isDeprecated: true,
          isStable: true,
          releaseTimestamp: '2020-06-27T12:55:01.000Z' as Timestamp,
          version: '3.7.8',
        });
      });

      it('only returns stable versions', async () => {
        const res = await getPkgReleases({
          datasource,
          packageName: 'python',
        });
        expect(res?.releases).toHaveLength(2);
        for (const release of res?.releases ?? []) {
          expect(release.isStable).toBeTrue();
        }
      });

      it('only returns versions that are prebuilt', async () => {
        const res = await getPkgReleases({
          datasource,
          packageName: 'python',
        });
        expect(
          res?.releases.filter((release) =>
            satisfies(release.version, '>3.12.1'),
          ),
        ).toHaveLength(0);
      });

      it('returns isDeprecated status for Python 3 minor releases', async () => {
        const res = await getPkgReleases({
          datasource,
          packageName: 'python',
        });
        expect(res?.releases).toHaveLength(2);
        for (const release of res?.releases ?? []) {
          expect(release.isDeprecated).toBeBoolean();
        }
      });
    });
  });
});
