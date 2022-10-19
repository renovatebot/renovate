import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { FlutterVersionDatasource } from '.';

const baseUrl = 'https://storage.googleapis.com';
const urlPath = '/flutter_infra_release/releases/releases_linux.json';
const datasource = FlutterVersionDatasource.id;
const depName = 'flutter';

describe('modules/datasource/flutter-version/index', () => {
  describe('getReleases', () => {
    it('throws for 500', async () => {
      httpMock.scope(baseUrl).get(urlPath).reply(500);
      await expect(
        getPkgReleases({
          datasource,
          depName,
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for error', async () => {
      httpMock.scope(baseUrl).get(urlPath).replyWithError('error');
      expect(
        await getPkgReleases({
          datasource,
          depName,
        })
      ).toBeNull();
    });

    it('returns null for empty 200 OK', async () => {
      httpMock.scope(baseUrl).get(urlPath).reply(200, []);
      expect(
        await getPkgReleases({
          datasource,
          depName,
        })
      ).toBeNull();
    });

    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get(urlPath)
        .reply(200, Fixtures.get('index.json'));
      const res = await getPkgReleases({
        datasource,
        depName,
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(31);
    });
  });
});
