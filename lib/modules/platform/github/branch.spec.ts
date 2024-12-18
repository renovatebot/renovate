import * as httpMock from '../../../../test/http-mock';
import { remoteBranchExists } from './branch';

describe('modules/platform/github/branch', () => {
  it('should return true if the branch exists', async () => {
    httpMock
      .scope('https://api.github.com')
      .get('/repos/my/repo/git/matching-refs/heads/renovate/foobar')
      .reply(200, [{ ref: 'refs/heads/renovate/foobar' }]);

    const result = await remoteBranchExists('my/repo', 'renovate/foobar');

    expect(result).toBe(true);
  });

  it('should return false if the branch does not exist', async () => {
    httpMock
      .scope('https://api.github.com')
      .get('/repos/my/repo/git/matching-refs/heads/renovate/foobar')
      .reply(200, []);

    const result = await remoteBranchExists('my/repo', 'renovate/foobar');

    expect(result).toBe(false);
  });

  it('should throw an error for nested branches', async () => {
    httpMock
      .scope('https://api.github.com')
      .get('/repos/my/repo/git/matching-refs/heads/renovate/foobar')
      .reply(200, [
        { ref: 'refs/heads/renovate/foobar/branch-1' },
        { ref: 'refs/heads/renovate/foobar/branch-2' },
        { ref: 'refs/heads/renovate/foobar/branch-3' },
      ]);

    await expect(
      remoteBranchExists('my/repo', 'renovate/foobar'),
    ).rejects.toThrow(
      `Trying to create a branch 'renovate/foobar' while it's the part of nested branch`,
    );
  });

  it('should throw an error if the request fails for any other reason', async () => {
    httpMock
      .scope('https://api.github.com')
      .get('/repos/my/repo/git/matching-refs/heads/renovate/foobar')
      .reply(500);

    await expect(
      remoteBranchExists('my/repo', 'renovate/foobar'),
    ).rejects.toThrow('external-host-error');
  });
});
