import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { loadFixture } from '../../../test/util';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import { datasource, defaultRegistryUrl } from './common';

const res1 = loadFixture('index.json');

describe('datasource/node/index', () => {
  describe('getReleases', () => {
    it('throws for 500', async () => {
      httpMock.scope(defaultRegistryUrl).get('/index.json').reply(500);
      await expect(
        getPkgReleases({
          datasource,
          depName: 'node',
        })
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
          depName: 'node',
        })
      ).toBeNull();
    });

    it('returns null for empty 200 OK', async () => {
      httpMock.scope(defaultRegistryUrl).get('/index.json').reply(200, []);
      expect(
        await getPkgReleases({
          datasource,
          depName: 'node',
        })
      ).toBeNull();
    });

    it('processes real data', async () => {
      httpMock.scope(defaultRegistryUrl).get('/index.json').reply(200, res1);
      const res = await getPkgReleases({
        datasource,
        depName: 'node',
      });
      expect(res).toMatchSnapshot();
      expect(res.releases).toHaveLength(64);
    });
  });
});
