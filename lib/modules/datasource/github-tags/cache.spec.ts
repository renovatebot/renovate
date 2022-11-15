import type { GithubGraphqlTag } from '../../../util/github/types';
import { GithubHttp } from '../../../util/http/github';
import { CacheableGithubTags } from './cache';

describe('modules/datasource/github-tags/cache', () => {
  const http = new GithubHttp();
  const cache = new CacheableGithubTags(http, { resetDeltaMinutes: 0 });

  const fetchedItem: GithubGraphqlTag = {
    version: '1.2.3',
    target: {
      type: 'Commit',
      hash: 'abc',
      releaseTimestamp: '2020-04-09T10:00:00.000Z',
    },
  };

  describe('coerceFetched', () => {
    it('transforms GraphQL items', () => {
      expect(cache.coerceFetched(fetchedItem)).toEqual({
        version: '1.2.3',
        hash: 'abc',
        releaseTimestamp: '2020-04-09T10:00:00.000Z',
      });
      expect(
        cache.coerceFetched({
          version: '1.2.3',
          target: {
            type: 'Tag',
            target: {
              hash: 'abc',
            },
            tagger: {
              releaseTimestamp: '2020-04-09T10:00:00.000Z',
            },
          },
        })
      ).toEqual({
        version: '1.2.3',
        hash: 'abc',
        releaseTimestamp: '2020-04-09T10:00:00.000Z',
      });
    });

    it('returns null for tags we can not process', () => {
      expect(
        cache.coerceFetched({
          version: '1.2.3',
          target: { type: 'Blob' } as never,
        })
      ).toBeNull();
    });
  });
});
