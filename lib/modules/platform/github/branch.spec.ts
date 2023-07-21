import * as httpMock from '../../../../test/http-mock';
import { GithubHttp } from '../../../util/http/github';
import { remoteBranchExists } from './branch';

describe('modules/platform/github/branch', () => {
  const http = new GithubHttp();

  it('should return true if the branch exists', async () => {
    httpMock
      .scope('https://api.github.com')
      .get('/repos/my/repo/git/refs/heads/renovate/foobar')
      .reply(200, { ref: 'renovate/foobar' });

    const result = await remoteBranchExists(http, 'my/repo', 'renovate/foobar');

    expect(result).toBe(true);
  });

  it('should return false if the branch does not exist', async () => {
    httpMock
      .scope('https://api.github.com')
      .get('/repos/my/repo/git/refs/heads/renovate/foobar')
      .reply(404);

    const result = await remoteBranchExists(http, 'my/repo', 'renovate/foobar');

    expect(result).toBe(false);
  });

  it('should throw an error if the request fails for any other reason', async () => {
    httpMock
      .scope('https://api.github.com')
      .get('/repos/my/repo/git/refs/heads/renovate/foobar')
      .reply(500, { message: 'Something went wrong' });

    await expect(
      remoteBranchExists(http, 'my/repo', 'renovate/foobar')
    ).rejects.toThrow('external-host-error');
  });

  it('should throw an error if the branch has nested branches', async () => {
    httpMock
      .scope('https://api.github.com')
      .get('/repos/my/repo/git/refs/heads/renovate/foo')
      .reply(200, [
        { ref: 'renovate/foo/bar' },
        { ref: 'renovate/foo/baz' },
        { ref: 'renovate/foo/qux' },
      ]);

    await expect(
      remoteBranchExists(http, 'my/repo', 'renovate/foo')
    ).rejects.toThrow(
      'Trying to create a branch renovate/foo while nested branches exist: renovate/foo/bar, renovate/foo/baz, renovate/foo/qux'
    );
  });
});
