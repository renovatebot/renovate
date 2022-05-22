import { GithubHttp } from '../../../util/http/github';
import { CacheableGithubTags, FetchedTag, StoredTag } from './cache';

describe('modules/datasource/github-tags/cache', () => {
  const http = new GithubHttp();
  const cache = new CacheableGithubTags(http);

  const fetchedItem: FetchedTag = {
    version: '1.2.3',
    target: {
      type: 'Commit',
      hash: 'abc',
      releaseTimestamp: '2020-04-09T10:00:00.000Z',
    },
  };

  const storedItem: StoredTag = {
    version: '1.2.3',
    releaseTimestamp: '2020-04-09T10:00:00.000Z',
    hash: 'abc',
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

  describe('isEquivalent', () => {
    it('considers same object equivalent', () => {
      expect(cache.isEquivalent(storedItem, storedItem)).toBeTrue();

      const otherItem = { ...storedItem, hash: '123' };
      expect(cache.isEquivalent(otherItem, otherItem)).toBeTrue();

      expect(
        cache.isEquivalent(
          { hash: 'abc123' } as never,
          { hash: 'abc123' } as never
        )
      ).toBeTrue();
    });

    it('considers object with different `updatedAt` field as not equivalent', () => {
      expect(
        cache.isEquivalent(storedItem, { ...storedItem, hash: 'abc123' })
      ).toBeFalse();
    });
  });
});
