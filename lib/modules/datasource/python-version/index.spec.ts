import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { datasource, defaultRegistryUrl } from './common';

describe('modules/datasource/python-version/index', () => {
  describe('getReleases', () => {
    it('throws for 500', async () => {
      httpMock.scope(defaultRegistryUrl).get('/').reply(500);
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'python',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for error', async () => {
      httpMock.scope(defaultRegistryUrl).get('/').replyWithError('error');
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'python',
        }),
      ).toBeNull();
    });

    it('returns null for empty 200 OK', async () => {
      httpMock.scope(defaultRegistryUrl).get('/').reply(200, []);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'python',
        }),
      ).toBeNull();
    });

    it('processes real data', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/')
        .reply(200, Fixtures.get('release.json'));
      const res = await getPkgReleases({
        datasource,
        packageName: 'python',
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(367);
    });
  });
});
