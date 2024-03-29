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

    it('returns Python prebuild data', async () => {
      jest
        .spyOn(githubGraphql, 'queryReleases')
        .mockResolvedValueOnce(JSON.parse(Fixtures.get('prebuild.json')));
      // httpMock
      //   .scope('https://api.github.com/')
      //   .post('/graphql')
      //   .reply(200, Fixtures.get('prebuild.json'));
      const res = await PythonVersionDatasource.getPrebuildReleases();
      expect(res).toMatchSnapshot();
    });
  });

  describe('getReleases', () => {
    beforeEach(() => {
      httpMock
        .scope('https://endoflife.date')
        .get('/api/python.json')
        .reply(200, Fixtures.get('eol.json'));
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
          isStable: true,
          releaseTimestamp: '2001-06-22T00:00:00.000Z',
          version: '2.0.1',
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
    });
  });
});
