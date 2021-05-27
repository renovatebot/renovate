import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName, loadFixture } from '../../../test/util';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import { CdnJsDatasource } from '.';

const res1 = loadFixture('d3-force.json');
const res2 = loadFixture('bulma.json');

const baseUrl = 'https://api.cdnjs.com/';

const pathFor = (s: string): string =>
  `/libraries/${s.split('/').shift()}?fields=homepage,repository,assets`;

describe(getName(), () => {
  describe('getReleases', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('throws for empty result', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).reply(200, null);
      await expect(
        getPkgReleases({
          datasource: CdnJsDatasource.id,
          depName: 'foo/bar',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws for error', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).replyWithError('error');
      await expect(
        getPkgReleases({
          datasource: CdnJsDatasource.id,
          depName: 'foo/bar',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).reply(404);
      expect(
        await getPkgReleases({
          datasource: CdnJsDatasource.id,
          depName: 'foo/bar',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('returns null for empty 200 OK', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathFor('doesnotexist/doesnotexist'))
        .reply(200, {});
      expect(
        await getPkgReleases({
          datasource: CdnJsDatasource.id,
          depName: 'doesnotexist/doesnotexist',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws for 401', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).reply(401);
      await expect(
        getPkgReleases({
          datasource: CdnJsDatasource.id,
          depName: 'foo/bar',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws for 429', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).reply(429);
      await expect(
        getPkgReleases({
          datasource: CdnJsDatasource.id,
          depName: 'foo/bar',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).reply(502);
      await expect(
        getPkgReleases({
          datasource: CdnJsDatasource.id,
          depName: 'foo/bar',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('throws for unknown error', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).replyWithError('error');
      await expect(
        getPkgReleases({
          datasource: CdnJsDatasource.id,
          depName: 'foo/bar',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathFor('d3-force/d3-force.js'))
        .reply(200, res1);
      const res = await getPkgReleases({
        datasource: CdnJsDatasource.id,
        depName: 'd3-force/d3-force.js',
      });
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('filters releases by asset presence', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathFor('bulma/only/0.7.5/style.css'))
        .reply(200, res2);
      const res = await getPkgReleases({
        datasource: CdnJsDatasource.id,
        depName: 'bulma/only/0.7.5/style.css',
      });
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});
