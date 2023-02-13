import { GithubHttp } from '../http/github';
import * as githubGraphql from './graphql';
import { findCommitOfTag } from './tags';

describe('util/github/tags', () => {
  describe('findCommitOfTag', () => {
    let http: GithubHttp;

    beforeEach(() => {
      http = new GithubHttp();
    });

    it('should be able to find the hash of a Git tag', async () => {
      jest.spyOn(githubGraphql, 'queryTags').mockResolvedValueOnce([
        {
          version: 'v1.0.0',
          gitRef: 'v1.0.0',
          releaseTimestamp: '2021-01-01',
          hash: '123',
        },
        {
          version: 'v2.0.0',
          gitRef: 'v2.0.0',
          releaseTimestamp: '2022-01-01',
          hash: 'abc',
        },
      ]);

      const commit = await findCommitOfTag(
        undefined,
        'some-org/repo',
        'v2.0.0',
        http
      );
      expect(commit).toBe('abc');
    });

    it('should support passing a custom registry URL', async () => {
      jest.spyOn(githubGraphql, 'queryTags').mockResolvedValueOnce([]);

      const commit = await findCommitOfTag(
        'https://my-enterprise-github.dev',
        'some-org/repo',
        'v2.0.0',
        http
      );
      expect(commit).toBe(null);
      expect(githubGraphql.queryTags).toHaveBeenCalledWith(
        {
          packageName: 'some-org/repo',
          registryUrl: 'https://my-enterprise-github.dev',
        },
        http
      );
    });

    it('should return `null` if the tag does not exist', async () => {
      jest.spyOn(githubGraphql, 'queryTags').mockResolvedValueOnce([]);

      const commit = await findCommitOfTag(
        undefined,
        'some-org/repo',
        'v2.0.0',
        http
      );
      expect(commit).toBe(null);
    });

    it('should gracefully return `null` if tags cannot be queried', async () => {
      jest
        .spyOn(githubGraphql, 'queryTags')
        .mockRejectedValue(new Error('some error'));

      const commit = await findCommitOfTag(
        undefined,
        'some-org/repo',
        'v2.0.0',
        http
      );
      expect(commit).toBe(null);
    });
  });
});
