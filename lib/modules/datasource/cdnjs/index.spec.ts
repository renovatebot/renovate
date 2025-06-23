import { getDigest, getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { HttpError } from '../../../util/http';
import { CdnjsDatasource } from '.';

const baseUrl = 'https://api.cdnjs.com/';

const pathFor = (s: string): string =>
  `/libraries/${s.split('/').shift()}?fields=homepage,repository,versions`;

const pathForDigest = (s: string, version: string): string =>
  `/libraries/${s.split('/').shift()}/${version}?fields=sri`;

describe('modules/datasource/cdnjs/index', () => {
  describe('getReleases', () => {
    it('throws for empty result', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).reply(200, '}');
      await expect(
        getPkgReleases({
          datasource: CdnjsDatasource.id,
          packageName: 'foo/bar',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for error', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).replyWithError('error');
      await expect(
        getPkgReleases({
          datasource: CdnjsDatasource.id,
          packageName: 'foo/bar',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).reply(404);
      expect(
        await getPkgReleases({
          datasource: CdnjsDatasource.id,
          packageName: 'foo/bar',
        }),
      ).toBeNull();
    });

    it('returns null for empty 200 OK', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathFor('doesnotexist/doesnotexist'))
        .reply(200, {});
      expect(
        await getPkgReleases({
          datasource: CdnjsDatasource.id,
          packageName: 'doesnotexist/doesnotexist',
        }),
      ).toBeNull();
    });

    it('throws for 401', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).reply(401);
      await expect(
        getPkgReleases({
          datasource: CdnjsDatasource.id,
          packageName: 'foo/bar',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for 429', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).reply(429);
      await expect(
        getPkgReleases({
          datasource: CdnjsDatasource.id,
          packageName: 'foo/bar',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).reply(502);
      await expect(
        getPkgReleases({
          datasource: CdnjsDatasource.id,
          packageName: 'foo/bar',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for unknown error', async () => {
      httpMock.scope(baseUrl).get(pathFor('foo/bar')).replyWithError('error');
      await expect(
        getPkgReleases({
          datasource: CdnjsDatasource.id,
          packageName: 'foo/bar',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathFor('d3-force/d3-force.js'))
        .reply(200, Fixtures.get('d3-force.json'));
      const res = await getPkgReleases({
        datasource: CdnjsDatasource.id,
        packageName: 'd3-force/d3-force.js',
      });
      expect(res).toMatchSnapshot();
    });
  });

  describe('getDigest', () => {
    it('returs null for no result', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathForDigest('foo/bar', '1.2.0'))
        .reply(200, '{}');

      const res = await getDigest(
        {
          datasource: CdnjsDatasource.id,
          packageName: 'foo/bar',
        },
        '1.2.0',
      );
      expect(res).toBeNull();
    });

    it('returs null for empty sri object', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathForDigest('foo/bar', '1.2.0'))
        .reply(200, JSON.stringify({ sri: {} }));

      const res = await getDigest(
        {
          datasource: CdnjsDatasource.id,
          packageName: 'foo/bar',
        },
        '1.2.0',
      );
      expect(res).toBeNull();
    });

    it('returs null if file not found', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathForDigest('foo/bar', '1.2.0'))
        .reply(200, JSON.stringify({ sri: { string: 'hash' } }));

      const res = await getDigest(
        {
          datasource: CdnjsDatasource.id,
          packageName: 'foo/bar',
        },
        '1.2.0',
      );
      expect(res).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get(pathForDigest('foo/bar', '1.2.0')).reply(404);
      await expect(
        getDigest(
          {
            datasource: CdnjsDatasource.id,
            packageName: 'foo/bar',
          },
          '1.2.0',
        ),
      ).rejects.toThrow(HttpError);
    });

    it('returns digest', async () => {
      httpMock
        .scope(baseUrl)
        .get(pathForDigest('bootstrap/js/bootstrap.min.js', '5.2.3'))
        .reply(200, Fixtures.get('sri.json'));

      const res = await getDigest(
        {
          datasource: CdnjsDatasource.id,
          packageName: 'bootstrap/js/bootstrap.min.js',
        },
        '5.2.3',
      );
      expect(res).toBe(
        'sha512-1/RvZTcCDEUjY/CypiMz+iqqtaoQfAITmNSJY17Myp4Ms5mdxPS5UV7iOfdZoxcGhzFbOm6sntTKJppjvuhg4g==',
      );
    });
  });
});
