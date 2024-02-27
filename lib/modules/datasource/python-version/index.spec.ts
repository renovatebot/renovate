import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { datasource, defaultRegistryUrl } from './common';

describe('modules/datasource/python-version/index', () => {
  describe('getReleases', () => {
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
