import type { GithubGraphqlRelease } from '../../../../util/github/types';
import { GithubHttp } from '../../../../util/http/github';
import { CacheableGithubReleases } from '.';

describe('modules/datasource/github-releases/cache/index', () => {
  const http = new GithubHttp();
  const cache = new CacheableGithubReleases(http, { resetDeltaMinutes: 0 });

  const fetchedItem: GithubGraphqlRelease = {
    version: '1.2.3',
    releaseTimestamp: '2020-04-09T10:00:00.000Z',
    isDraft: false,
    isPrerelease: false,
    url: 'https://example.com/',
    id: 123,
    name: 'Some name',
    description: 'Some description',
  };

  describe('coerceFetched', () => {
    it('transforms GraphQL item', () => {
      expect(cache.coerceFetched(fetchedItem)).toEqual({
        description: 'Some description',
        id: 123,
        name: 'Some name',
        releaseTimestamp: '2020-04-09T10:00:00.000Z',
        url: 'https://example.com/',
        version: '1.2.3',
      });
    });

    it('marks pre-release as unstable', () => {
      expect(
        cache.coerceFetched({ ...fetchedItem, isPrerelease: true })
      ).toMatchObject({
        isStable: false,
      });
    });

    it('filters out drafts', () => {
      expect(cache.coerceFetched({ ...fetchedItem, isDraft: true })).toBeNull();
    });
  });
});
