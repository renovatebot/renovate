import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { datasource, defaultRegistryUrl } from './common';

describe('modules/datasource/node-version/index', () => {
  describe('getReleases', () => {
    it('throws for 500', async () => {
      httpMock.scope(defaultRegistryUrl).get('/index.json').reply(500);
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'node',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for error', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/index.json')
        .replyWithError('error');
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'node',
        }),
      ).toBeNull();
    });

    it('returns null for empty 200 OK', async () => {
      httpMock.scope(defaultRegistryUrl).get('/index.json').reply(200, []);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'node',
        }),
      ).toBeNull();
    });

    it('processes real data', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/index.json')
        .reply(200, Fixtures.get('index.json'));
      const res = await getPkgReleases({
        datasource,
        packageName: 'node',
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(64);
    });
  });
});
