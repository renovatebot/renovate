import { mockDeep } from 'vitest-mock-extended';
import { getDigest, getPkgReleases } from '..';
import * as githubGraphql from '../../../util/github/graphql';
import * as _hostRules from '../../../util/host-rules';
import type { Timestamp } from '../../../util/timestamp';
import { GithubReleasesDatasource } from '.';

vi.mock('../../../util/host-rules', () => mockDeep());
const hostRules = vi.mocked(_hostRules);

describe('modules/datasource/github-releases/index', () => {
  beforeEach(() => {
    hostRules.hosts.mockReturnValue([]);
    hostRules.find.mockReturnValue({
      token: 'some-token',
    });
  });

  describe('getReleases', () => {
    it('returns releases', async () => {
      vi.spyOn(githubGraphql, 'queryReleases').mockResolvedValueOnce([
        {
          id: 1,
          url: 'https://example.com',
          name: 'some/dep2',
          description: 'some description',
          version: 'a',
          releaseTimestamp: '2020-03-09T13:00:00Z' as Timestamp,
        },
        {
          id: 2,
          url: 'https://example.com',
          name: 'some/dep2',
          description: 'some description',
          version: 'v',
          releaseTimestamp: '2020-03-09T12:00:00Z' as Timestamp,
        },
        {
          id: 3,
          url: 'https://example.com',
          name: 'some/dep2',
          description: 'some description',
          version: '1.0.0',
          releaseTimestamp: '2020-03-09T11:00:00Z' as Timestamp,
        },
        {
          id: 4,
          url: 'https://example.com',
          name: 'some/dep2',
          description: 'some description',
          version: 'v1.1.0',
          releaseTimestamp: '2020-03-09T10:00:00Z' as Timestamp,
        },
        {
          id: 5,
          url: 'https://example.com',
          name: 'some/dep2',
          description: 'some description',
          version: '2.0.0',
          releaseTimestamp: '2020-04-09T10:00:00Z' as Timestamp,
          isStable: false,
        },
      ]);

      const res = await getPkgReleases({
        datasource: GithubReleasesDatasource.id,
        packageName: 'some/dep',
      });

      expect(res).toMatchObject({
        registryUrl: 'https://github.com',
        releases: [
          {
            releaseTimestamp: '2020-03-09T11:00:00.000Z' as Timestamp,
            version: '1.0.0',
          },
          {
            version: 'v1.1.0',
            releaseTimestamp: '2020-03-09T10:00:00.000Z' as Timestamp,
          },
          {
            version: '2.0.0',
            releaseTimestamp: '2020-04-09T10:00:00.000Z' as Timestamp,
            isStable: false,
          },
        ],
        sourceUrl: 'https://github.com/some/dep',
      });
    });
  });

  describe('getDigest', () => {
    const packageName = 'some/dep';
    const currentValue = 'v1.0.0';
    const currentDigest = 'sha-of-v1';
    const newValue = 'v15.0.0';
    const newDigest = 'sha-of-v15';

    beforeEach(() => {
      vi.spyOn(githubGraphql, 'queryTags').mockResolvedValueOnce([
        {
          version: 'v1.0.0',
          gitRef: 'v1.0.0',
          releaseTimestamp: '2021-01-01' as Timestamp,
          hash: 'sha-of-v1',
        },
        {
          version: 'v15.0.0',
          gitRef: 'v15.0.0',
          releaseTimestamp: '2022-10-01' as Timestamp,
          hash: 'sha-of-v15',
        },
      ]);
    });

    it('should be independent of the current digest', async () => {
      const digest = await getDigest(
        {
          datasource: GithubReleasesDatasource.id,
          packageName,
          currentValue,
        },
        newValue,
      );
      expect(digest).toBe(newDigest);
    });

    it('should be independent of the current value', async () => {
      const digest = await getDigest(
        { datasource: GithubReleasesDatasource.id, packageName },
        newValue,
      );
      expect(digest).toBe(newDigest);
    });

    it('returns updated digest in new release', async () => {
      const digest = await getDigest(
        {
          datasource: GithubReleasesDatasource.id,
          packageName,
          currentValue,
          currentDigest,
        },
        newValue,
      );
      expect(digest).toEqual(newDigest);
    });

    it('returns null if the new value/tag does not exist', async () => {
      const digest = await getDigest(
        {
          datasource: GithubReleasesDatasource.id,
          packageName,
          currentValue,
          currentDigest,
        },
        'unknown-tag',
      );
      expect(digest).toBeNull();
    });
  });
});
