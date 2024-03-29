import { satisfies } from '@renovatebot/pep440';
import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import * as githubGraphql from '../../../util/github/graphql';
import { registryUrl as eolRegistryUrl } from '../endoflife-date/common';
import { datasource, defaultRegistryUrl } from './common';
import { PythonVersionDatasource } from '.';

describe('modules/datasource/python-version/index', () => {
  describe('dependent datasources', () => {
    it('returns Python EOL data', async () => {
      httpMock
        .scope(eolRegistryUrl)
        .get('/python.json')
        .reply(200, Fixtures.get('eol.json'));
      const res = await PythonVersionDatasource.getEolReleases();
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

      jest.spyOn(githubGraphql, 'queryReleases').mockResolvedValueOnce([
        {
          id: 1,
          url: 'https://example.com',
          name: 'containerbase/python-prebuild',
          description: 'some description',
          version: '3.12.1',
          releaseTimestamp: '2020-03-09T13:00:00Z',
        },
        {
          id: 2,
          url: 'https://example.com',
          name: 'containerbase/python-prebuild',
          description: 'some description',
          version: '3.12.0',
          releaseTimestamp: '2020-03-09T13:00:00Z',
        },
        {
          id: 3,
          url: 'https://example.com',
          name: 'containerbase/python-prebuild',
          description: 'some description',
          version: '3.7.8',
          releaseTimestamp: '2020-03-09T13:00:00Z',
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
          releaseTimestamp: '2020-06-27T12:55:01.000Z',
          version: '3.7.8',
        });
      });

      it('returns no unstable versions', async () => {
        const res = await getPkgReleases({
          datasource,
          packageName: 'python',
        });
        res?.releases.forEach((release) => {
          expect(release.isStable).toBeTrue();
        });
      });

      it('returns no version that is not prebuilt', async () => {
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
        res?.releases
          .filter((release) => satisfies(release.version, '>=3'))
          .forEach((release) => {
            expect(release.isDeprecated).toBeBoolean();
          });
      });
    });
  });
});
