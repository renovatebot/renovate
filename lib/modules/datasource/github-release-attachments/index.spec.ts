import { mockDeep } from 'jest-mock-extended';
import { getDigest, getPkgReleases } from '..';
import { mocked } from '../../../../test/util';
import * as githubGraphql from '../../../util/github/graphql';
import * as _hostRules from '../../../util/host-rules';
import { GitHubReleaseAttachmentMocker } from './test';
import { GithubReleaseAttachmentsDatasource } from '.';

jest.mock('../../../util/host-rules', () => mockDeep());
const hostRules = mocked(_hostRules);

const githubApiHost = 'https://api.github.com';

describe('modules/datasource/github-release-attachments/index', () => {
  beforeEach(() => {
    hostRules.hosts.mockReturnValue([]);
    hostRules.find.mockReturnValue({
      token: 'some-token',
    });
  });

  describe('getReleases', () => {
    it('returns releases', async () => {
      jest.spyOn(githubGraphql, 'queryReleases').mockResolvedValueOnce([
        {
          id: 1,
          url: 'https://example.com',
          name: 'some/dep2',
          description: 'some description',
          version: 'a',
          releaseTimestamp: '2020-03-09T13:00:00Z',
        },
        {
          id: 2,
          url: 'https://example.com',
          name: 'some/dep2',
          description: 'some description',
          version: 'v',
          releaseTimestamp: '2020-03-09T12:00:00Z',
        },
        {
          id: 3,
          url: 'https://example.com',
          name: 'some/dep2',
          description: 'some description',
          version: '1.0.0',
          releaseTimestamp: '2020-03-09T11:00:00Z',
        },
        {
          id: 4,
          url: 'https://example.com',
          name: 'some/dep2',
          description: 'some description',
          version: 'v1.1.0',
          releaseTimestamp: '2020-03-09T10:00:00Z',
        },
        {
          id: 5,
          url: 'https://example.com',
          name: 'some/dep2',
          description: 'some description',
          version: '2.0.0',
          releaseTimestamp: '2020-04-09T10:00:00Z',
          isStable: false,
        },
      ]);

      const res = await getPkgReleases({
        datasource: GithubReleaseAttachmentsDatasource.id,
        packageName: 'some/dep',
      });

      expect(res).toMatchObject({
        registryUrl: 'https://github.com',
        releases: [
          { releaseTimestamp: '2020-03-09T11:00:00.000Z', version: '1.0.0' },
          { version: 'v1.1.0', releaseTimestamp: '2020-03-09T10:00:00.000Z' },
          {
            version: '2.0.0',
            releaseTimestamp: '2020-04-09T10:00:00.000Z',
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
    const currentDigest = 'v1.0.0-digest';

    const releaseMock = new GitHubReleaseAttachmentMocker(
      githubApiHost,
      packageName,
    );

    it('requires currentDigest', async () => {
      const digest = await getDigest(
        { datasource: GithubReleaseAttachmentsDatasource.id, packageName },
        currentValue,
      );
      expect(digest).toBeNull();
    });

    it('defaults to currentDigest when currentVersion is missing', async () => {
      const digest = await getDigest(
        {
          datasource: GithubReleaseAttachmentsDatasource.id,
          packageName,
          currentDigest,
        },
        currentValue,
      );
      expect(digest).toEqual(currentDigest);
    });

    it('returns updated digest in new release', async () => {
      releaseMock.withDigestFileAsset(
        currentValue,
        `${currentDigest} asset.zip`,
      );
      const nextValue = 'v1.0.1';
      const nextDigest = 'updated-digest';
      releaseMock.withDigestFileAsset(nextValue, `${nextDigest} asset.zip`);
      const digest = await getDigest(
        {
          datasource: GithubReleaseAttachmentsDatasource.id,
          packageName,
          currentValue,
          currentDigest,
        },
        nextValue,
      );
      expect(digest).toEqual(nextDigest);
    });

    // This is awkward, but I found returning `null` in this case to not produce an update
    // I'd prefer a PR with the old digest (that I can manually patch) to no PR, so I made this decision.
    it('ignores failures verifying currentDigest', async () => {
      releaseMock.release(currentValue);
      const digest = await getDigest(
        {
          datasource: GithubReleaseAttachmentsDatasource.id,
          packageName,
          currentValue,
          currentDigest,
        },
        currentValue,
      );
      expect(digest).toEqual(currentDigest);
    });
  });
});
