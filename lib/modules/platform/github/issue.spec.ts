import * as memCache from '../../../util/cache/memory';
import { getCache, resetCache } from '../../../util/cache/repository';
import { GithubIssue, GithubIssueCache } from './issue';

describe('modules/platform/github/issue', () => {
  describe('GithubIssueCache', () => {
    let cache = getCache();

    beforeEach(() => {
      resetCache();
      cache = getCache();
      memCache.init();
    });

    it('returns null for empty cache', () => {
      expect(GithubIssueCache.getIssues()).toBeNull();
    });

    it('stores issues to the cache', () => {
      const issues: GithubIssue[] = [
        {
          number: 1,
          body: 'body-1',
          state: 'open',
          title: 'title-1',
          lastModified: '2020-01-01T00:00:00.000Z',
        },
        {
          number: 2,
          body: 'body-2',
          state: 'closed',
          title: 'title-2',
          lastModified: '2020-01-02T00:00:00.000Z',
        },
      ];

      GithubIssueCache.setIssues(issues);

      expect(cache).toEqual({
        platform: {
          github: {
            issuesCache: {
              '1': {
                number: 1,
                body: 'body-1',
                state: 'open',
                title: 'title-1',
                lastModified: '2020-01-01T00:00:00.000Z',
              },
              '2': {
                number: 2,
                body: 'body-2',
                state: 'closed',
                title: 'title-2',
                lastModified: '2020-01-02T00:00:00.000Z',
              },
            },
          },
        },
      });
    });

    it('returns issues from the cache in the correct order', () => {
      cache.platform = {
        github: {
          issuesCache: {
            '2': {
              number: 2,
              body: 'body-2',
              state: 'closed',
              title: 'title-2',
              lastModified: '2020-01-02T00:00:00.000Z',
            },
            '1': {
              number: 1,
              body: 'body-1',
              state: 'open',
              title: 'title-1',
              lastModified: '2020-01-01T00:00:00.000Z',
            },
            '3': {
              number: 3,
              body: 'body-3',
              state: 'closed',
              title: 'title-3',
              lastModified: '2020-01-03T00:00:00.000Z',
            },
          },
        },
      };

      const res = GithubIssueCache.getIssues();

      expect(res).toEqual([
        {
          number: 3,
          body: 'body-3',
          state: 'closed',
          title: 'title-3',
          lastModified: '2020-01-03T00:00:00.000Z',
        },
        {
          number: 2,
          body: 'body-2',
          state: 'closed',
          title: 'title-2',
          lastModified: '2020-01-02T00:00:00.000Z',
        },
        {
          number: 1,
          body: 'body-1',
          state: 'open',
          title: 'title-1',
          lastModified: '2020-01-01T00:00:00.000Z',
        },
      ]);
    });

    it('updates particular issue in the cache', () => {
      cache.platform = {
        github: {
          issuesCache: {
            '1': {
              number: 1,
              body: 'body-1',
              state: 'open',
              title: 'title-1',
              lastModified: '2020-01-01T00:00:00.000Z',
            },
          },
        },
      };

      const issue: GithubIssue = {
        number: 1,
        body: 'new-body-1',
        state: 'closed',
        title: 'new-title-1',
        lastModified: '2020-01-02T00:00:00.000Z',
      };

      GithubIssueCache.updateIssue(issue);

      expect(cache).toEqual({
        platform: {
          github: {
            issuesCache: {
              '1': {
                number: 1,
                body: 'new-body-1',
                state: 'closed',
                title: 'new-title-1',
                lastModified: '2020-01-02T00:00:00.000Z',
              },
            },
          },
        },
      });
    });

    it('reconciles cache', () => {
      cache.platform = {
        github: {
          issuesCache: {
            '1': {
              number: 1,
              body: 'body-1',
              state: 'open',
              title: 'title-1',
              lastModified: '2020-01-01T00:00:00.000Z',
            },
            '2': {
              number: 2,
              body: 'body-2',
              state: 'closed',
              title: 'title-2',
              lastModified: '2020-01-02T00:00:00.000Z',
            },
          },
        },
      };

      GithubIssueCache.addIssuesToReconcile([
        {
          number: 1,
          body: 'new-body-1',
          state: 'open',
          title: 'new-title-1',
          lastModified: '2020-01-04T00:00:00.000Z',
        },
        {
          number: 2,
          body: 'body-2',
          state: 'closed',
          title: 'title-2',
          lastModified: '2020-01-02T00:00:00.000Z',
        },
      ]);
      const res = GithubIssueCache.getIssues();

      expect(res).toEqual([
        {
          number: 1,
          body: 'new-body-1',
          state: 'open',
          title: 'new-title-1',
          lastModified: '2020-01-04T00:00:00.000Z',
        },
        {
          number: 2,
          body: 'body-2',
          state: 'closed',
          title: 'title-2',
          lastModified: '2020-01-02T00:00:00.000Z',
        },
      ]);
    });

    it('resets cache during failed reconciliation', () => {
      cache.platform = {
        github: {
          issuesCache: {
            '1': {
              number: 1,
              body: 'body-1',
              state: 'open',
              title: 'title-1',
              lastModified: '2020-01-01T00:00:00.000Z',
            },
            '2': {
              number: 2,
              body: 'body-2',
              state: 'closed',
              title: 'title-2',
              lastModified: '2020-01-02T00:00:00.000Z',
            },
          },
        },
      };

      GithubIssueCache.addIssuesToReconcile([]);
      const res = GithubIssueCache.getIssues();

      expect(res).toBeNull();
    });
  });
});
