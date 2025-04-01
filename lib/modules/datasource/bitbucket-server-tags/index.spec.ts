import { getDigest, getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import { HttpError } from '../../../util/http';
import { BitbucketServerTagsDatasource } from '.';

const datasource = BitbucketServerTagsDatasource.id;
const baseUrl = 'https://bitbucket.some.domain.org';
const apiBaseUrl = 'https://bitbucket.some.domain.org/rest/api/1.0/';

describe('modules/datasource/bitbucket-server-tags/index', () => {
  describe('getReleases', () => {
    it('returns tags', async () => {
      httpMock
        .scope(apiBaseUrl)
        .get('/projects/some-org/repos/some-repo/tags?limit=100')
        .reply(200, {
          size: 3,
          limit: 100,
          isLastPage: true,
          start: 0,
          values: [
            {
              displayId: 'v17.7.2-deno',
              hash: '430f18aa2968b244fc91ecd9f374f62301af4b63',
            },
            {
              displayId: 'v17.7.2',
              hash: null,
            },
            {
              displayId: 'v17.7.1-deno',
              hash: '974b64a175bf11c81bfabfeb4325c74e49204b77',
            },
          ],
        });

      const res = await getPkgReleases({
        registryUrls: [baseUrl],
        datasource,
        packageName: 'some-org/some-repo',
      });
      expect(res).toMatchObject({
        sourceUrl:
          'https://bitbucket.some.domain.org/projects/some-org/repos/some-repo',
        registryUrl: 'https://bitbucket.some.domain.org',
        releases: [
          {
            version: 'v17.7.1-deno',
            gitRef: 'v17.7.1-deno',
            newDigest: '974b64a175bf11c81bfabfeb4325c74e49204b77',
          },
          {
            version: 'v17.7.2-deno',
            gitRef: 'v17.7.2-deno',
            newDigest: '430f18aa2968b244fc91ecd9f374f62301af4b63',
          },
          {
            version: 'v17.7.2',
            gitRef: 'v17.7.2',
            newDigest: undefined,
          },
        ],
      });
    });

    it('returns null on empty result', async () => {
      httpMock
        .scope(apiBaseUrl)
        .get('/projects/some-org/repos/empty/tags?limit=100')
        .reply(200, {});

      const res = await getPkgReleases({
        registryUrls: [baseUrl],
        datasource,
        packageName: 'some-org/empty',
      });
      expect(res).toBeNull();
    });

    it('returns null on missing registryUrl', async () => {
      const res = await getPkgReleases({
        datasource,
        packageName: 'some-org/notexisting',
      });
      expect(res).toBeNull();
    });

    it('handles not found', async () => {
      httpMock
        .scope(apiBaseUrl)
        .get('/projects/some-org/repos/notexisting/tags?limit=100')
        .reply(404);

      const res = await getPkgReleases({
        registryUrls: [baseUrl],
        datasource,
        packageName: 'some-org/notexisting',
      });
      expect(res).toBeNull();
    });
  });

  describe('getTagCommit', () => {
    it('returns commit hash of provided tag', async () => {
      httpMock
        .scope(apiBaseUrl)
        .get('/projects/some-org/repos/some-repo/tags/v1.0.0')
        .reply(200, {
          displayId: 'v1.0.0',
          hash: '430f18aa2968b244fc91ecd9f374f62301af4b62',
        });

      const res = await getDigest(
        {
          registryUrls: [baseUrl],
          datasource,
          packageName: 'some-org/some-repo',
        },
        'v1.0.0',
      );
      expect(res).toBe('430f18aa2968b244fc91ecd9f374f62301af4b62');
    });

    it('missing hash', async () => {
      httpMock
        .scope(apiBaseUrl)
        .get('/projects/some-org/repos/some-repo/tags/v1.0.0')
        .reply(200, {
          displayId: 'v1.0.0',
          hash: null,
        });

      const res = await getDigest(
        {
          registryUrls: [baseUrl],
          datasource,
          packageName: 'some-org/some-repo',
        },
        'v1.0.0',
      );
      expect(res).toBeNull();
    });
  });

  describe('getDigest', () => {
    it('returns most recent commit hash', async () => {
      httpMock
        .scope(apiBaseUrl)
        .get(
          '/projects/some-org/repos/some-repo/commits?ignoreMissing=true&limit=1',
        )
        .reply(200, {
          size: 1,
          limit: 1,
          isLastPage: false,
          start: 0,
          values: [
            {
              id: '0c95f9c79e1810cf9c8964fbf7d139009412f7e7',
              displayId: '0c95f9c79e1',
            },
          ],
        });

      const res = await getDigest({
        registryUrls: [baseUrl],
        datasource,
        packageName: 'some-org/some-repo',
      });
      expect(res).toBe('0c95f9c79e1810cf9c8964fbf7d139009412f7e7');
    });

    it('no commits', async () => {
      httpMock
        .scope(apiBaseUrl)
        .get(
          '/projects/some-org/repos/some-repo/commits?ignoreMissing=true&limit=1',
        )
        .reply(200, {
          size: 0,
          limit: 1,
          isLastPage: true,
          start: 0,
          values: [],
        });

      const res = await getDigest({
        registryUrls: [baseUrl],
        datasource,
        packageName: 'some-org/some-repo',
      });
      expect(res).toBeNull();
    });

    it('returns null on empty result', async () => {
      httpMock
        .scope(apiBaseUrl)
        .get(
          '/projects/some-org/repos/empty/commits?ignoreMissing=true&limit=1',
        )
        .reply(200, {});

      const res = await getDigest({
        registryUrls: [baseUrl],
        datasource,
        packageName: 'some-org/empty',
      });
      expect(res).toBeNull();
    });

    it('returns null on missing registryUrl', async () => {
      const res = await getDigest({
        datasource,
        packageName: 'some-org/notexisting',
      });
      expect(res).toBeNull();
    });

    it('handles not found', async () => {
      httpMock
        .scope(apiBaseUrl)
        .get(
          '/projects/some-org/repos/notexisting/commits?ignoreMissing=true&limit=1',
        )
        .reply(404);

      await expect(
        getDigest({
          registryUrls: [baseUrl],
          datasource,
          packageName: 'some-org/notexisting',
        }),
      ).rejects.toThrow(HttpError);
    });
  });
});
