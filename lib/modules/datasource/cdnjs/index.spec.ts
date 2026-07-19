import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { HttpError } from '../../../util/http/index.ts';
import { getDigest, getPkgReleases } from '../index.ts';
import { CdnjsDatasource } from './index.ts';

const baseUrl = 'https://api.cdnjs.com/';

function pathFor(s: string): string {
  return `/libraries/${s.split('/').shift()}?fields=homepage,repository,versions`;
}

function pathForDigest(s: string, version: string): string {
  return `/libraries/${s.split('/').shift()}/${version}?fields=sri`;
}

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
      expect(res).toMatchObject({
        homepage: 'https://d3js.org/d3-force/',
        sourceUrl: 'https://github.com/d3/d3-force',
        releases: [
          { version: '0.0.1' },
          { version: '0.0.2' },
          { version: '0.0.3' },
          { version: '0.0.4' },
          { version: '0.1.0' },
          { version: '0.2.0' },
          { version: '0.2.1' },
          { version: '0.2.2' },
          { version: '0.3.0' },
          { version: '0.4.0' },
          { version: '0.4.1' },
          { version: '0.5.0' },
          { version: '0.6.0' },
          { version: '0.6.1' },
          { version: '0.6.2' },
          { version: '0.6.3' },
          { version: '0.7.0' },
          { version: '0.7.1' },
          { version: '1.0.0' },
          { version: '1.0.1' },
          { version: '1.0.2' },
          { version: '1.0.3' },
          { version: '1.0.4' },
          { version: '1.0.5' },
          { version: '1.0.6' },
          { version: '1.1.0' },
          { version: '1.1.1' },
          { version: '1.1.2' },
          { version: '1.2.0' },
          { version: '1.2.1' },
          { version: '2.0.0' },
          { version: '2.0.1' },
          { version: '2.1.0' },
          { version: '2.1.0-rc.1' },
          { version: '2.1.0-rc.2' },
          { version: '2.1.1' },
          { version: '3.0.0' },
        ],
      });
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
