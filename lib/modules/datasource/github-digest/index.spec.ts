import * as githubGraphql from '../../../util/github/graphql/index.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { getPkgReleases } from '../index.ts';
import { GithubDigestDatasource } from './index.ts';

describe('modules/datasource/github-digest/index', () => {
  const github = new GithubDigestDatasource();

  beforeEach(() => {
    vi.spyOn(hostRules, 'hosts').mockReturnValue([]);
    vi.spyOn(hostRules, 'find').mockReturnValue({
      token: 'some-token',
    });
  });

  describe('getReleases', () => {
    const packageName = 'some/repo';

    it('returns tags and branches merged', async () => {
      vi.spyOn(githubGraphql, 'queryTags').mockResolvedValueOnce([
        {
          version: 'v1.0.0',
          gitRef: 'v1.0.0',
          releaseTimestamp: asTimestamp('2021-01-01')!,
          hash: 'tag-hash-1',
        },
      ]);
      vi.spyOn(githubGraphql, 'queryBranches').mockResolvedValueOnce([
        {
          version: 'main',
          gitRef: 'main',
          releaseTimestamp: asTimestamp('2022-01-01')!,
          hash: 'branch-hash-1',
        },
        {
          version: 'develop',
          gitRef: 'develop',
          releaseTimestamp: asTimestamp('2022-02-01')!,
          hash: 'branch-hash-2',
        },
      ]);

      const res = await getPkgReleases({ datasource: github.id, packageName });

      expect(res).toEqual({
        registryUrl: 'https://github.com',
        releases: [
          {
            version: 'v1.0.0',
            gitRef: 'v1.0.0',
            releaseTimestamp: '2021-01-01T00:00:00.000Z',
            newDigest: 'tag-hash-1',
          },
          {
            version: 'main',
            gitRef: 'main',
            releaseTimestamp: '2022-01-01T00:00:00.000Z',
            newDigest: 'branch-hash-1',
          },
          {
            version: 'develop',
            gitRef: 'develop',
            releaseTimestamp: '2022-02-01T00:00:00.000Z',
            newDigest: 'branch-hash-2',
          },
        ],
        sourceUrl: 'https://github.com/some/repo',
      });
    });

    it('prioritizes tags over branches with same name', async () => {
      vi.spyOn(githubGraphql, 'queryTags').mockResolvedValueOnce([
        {
          version: 'v4',
          gitRef: 'v4',
          releaseTimestamp: asTimestamp('2021-01-01')!,
          hash: 'tag-v4-hash',
        },
      ]);
      vi.spyOn(githubGraphql, 'queryBranches').mockResolvedValueOnce([
        {
          version: 'v4',
          gitRef: 'v4',
          releaseTimestamp: asTimestamp('2022-01-01')!,
          hash: 'branch-v4-hash',
        },
        {
          version: 'main',
          gitRef: 'main',
          releaseTimestamp: asTimestamp('2022-02-01')!,
          hash: 'main-hash',
        },
      ]);

      const res = await getPkgReleases({ datasource: github.id, packageName });

      expect(res).toEqual({
        registryUrl: 'https://github.com',
        releases: [
          {
            version: 'v4',
            gitRef: 'v4',
            releaseTimestamp: '2021-01-01T00:00:00.000Z',
            newDigest: 'tag-v4-hash',
          },
          {
            version: 'main',
            gitRef: 'main',
            releaseTimestamp: '2022-02-01T00:00:00.000Z',
            newDigest: 'main-hash',
          },
        ],
        sourceUrl: 'https://github.com/some/repo',
      });
    });

    it('returns only branches when no tags', async () => {
      vi.spyOn(githubGraphql, 'queryTags').mockResolvedValueOnce([]);
      vi.spyOn(githubGraphql, 'queryBranches').mockResolvedValueOnce([
        {
          version: 'v4',
          gitRef: 'v4',
          releaseTimestamp: asTimestamp('2022-01-01')!,
          hash: 'branch-hash',
        },
      ]);

      const res = await getPkgReleases({ datasource: github.id, packageName });

      expect(res).toEqual({
        registryUrl: 'https://github.com',
        releases: [
          {
            version: 'v4',
            gitRef: 'v4',
            releaseTimestamp: '2022-01-01T00:00:00.000Z',
            newDigest: 'branch-hash',
          },
        ],
        sourceUrl: 'https://github.com/some/repo',
      });
    });

    it('throws when tags query fails', async () => {
      vi.spyOn(githubGraphql, 'queryTags').mockRejectedValueOnce(
        new Error('Tags query failed'),
      );
      vi.spyOn(githubGraphql, 'queryBranches').mockResolvedValueOnce([]);

      await expect(github.getReleases({ packageName })).rejects.toThrow(
        'Tags query failed',
      );
    });

    it('throws when branches query fails', async () => {
      vi.spyOn(githubGraphql, 'queryTags').mockResolvedValueOnce([]);
      vi.spyOn(githubGraphql, 'queryBranches').mockRejectedValueOnce(
        new Error('Branches query failed'),
      );

      await expect(github.getReleases({ packageName })).rejects.toThrow(
        'Branches query failed',
      );
    });
  });

  describe('getDigest', () => {
    const packageName = 'some/repo';

    it('returns tag digest when tag exists', async () => {
      vi.spyOn(githubGraphql, 'queryTags').mockResolvedValueOnce([
        {
          version: 'v1.0.0',
          gitRef: 'v1.0.0',
          releaseTimestamp: asTimestamp('2021-01-01')!,
          hash: 'tag-hash',
        },
      ]);

      const res = await github.getDigest({ packageName }, 'v1.0.0');

      expect(res).toBe('tag-hash');
    });

    it('returns branch digest when tag not found', async () => {
      vi.spyOn(githubGraphql, 'queryTags').mockResolvedValueOnce([]);
      vi.spyOn(githubGraphql, 'queryBranches').mockResolvedValueOnce([
        {
          version: 'v4',
          gitRef: 'v4',
          releaseTimestamp: asTimestamp('2022-01-01')!,
          hash: 'branch-hash',
        },
      ]);

      const res = await github.getDigest({ packageName }, 'v4');

      expect(res).toBe('branch-hash');
    });

    it('prefers tag over branch with same name', async () => {
      vi.spyOn(githubGraphql, 'queryTags').mockResolvedValueOnce([
        {
          version: 'v4',
          gitRef: 'v4',
          releaseTimestamp: asTimestamp('2021-01-01')!,
          hash: 'tag-hash',
        },
      ]);

      const res = await github.getDigest({ packageName }, 'v4');

      expect(res).toBe('tag-hash');
    });

    it('returns null when not found in tags or branches', async () => {
      vi.spyOn(githubGraphql, 'queryTags').mockResolvedValueOnce([]);
      vi.spyOn(githubGraphql, 'queryBranches').mockResolvedValueOnce([]);

      const res = await github.getDigest({ packageName }, 'nonexistent');

      expect(res).toBeNull();
    });

    it('returns null when newValue is undefined', async () => {
      const res = await github.getDigest({ packageName }, undefined);

      expect(res).toBeNull();
    });
  });
});
