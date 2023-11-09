import * as httpMock from '../../../../test/http-mock';
import { remoteBranchExists } from './branch';

describe('modules/platform/github/branch', () => {
  it('should return true if the branch exists', async () => {
    httpMock
      .scope('https://api.github.com')
      .head('/repos/my/repo/git/refs/heads/renovate/foobar/')
      .reply(404)
      .head('/repos/my/repo/git/refs/heads/renovate/foobar')
      .reply(200, { ref: 'renovate/foobar' });

    const result = await remoteBranchExists('my/repo', 'renovate/foobar');

    expect(result).toBe(true);
  });

  it('should return false if the branch does not exist', async () => {
    httpMock
      .scope('https://api.github.com')
      .head('/repos/my/repo/git/refs/heads/renovate/foobar/')
      .reply(404)
      .head('/repos/my/repo/git/refs/heads/renovate/foobar')
      .reply(404);

    const result = await remoteBranchExists('my/repo', 'renovate/foobar');

    expect(result).toBe(false);
  });

  it('should throw an error for nested branches', async () => {
    httpMock
      .scope('https://api.github.com')
      .head('/repos/my/repo/git/refs/heads/renovate/foobar/')
      .reply(200);

    await expect(
      remoteBranchExists('my/repo', 'renovate/foobar'),
    ).rejects.toThrow(
      `Trying to create a branch 'renovate/foobar' while it's the part of nested branch`,
    );
  });

  it('should throw an error if the request fails for any other reason', async () => {
    httpMock
      .scope('https://api.github.com')
      .head('/repos/my/repo/git/refs/heads/renovate/foobar/')
      .reply(500, { message: 'Something went wrong' });

    await expect(
      remoteBranchExists('my/repo', 'renovate/foobar'),
    ).rejects.toThrow('external-host-error');
  });
});
