import { CONFIG_GIT_URL_UNAVAILABLE } from '../../../constants/error-messages.ts';
import { parseUrl } from '../../../util/url.ts';
import { getRepoUrl } from './utils.ts';

describe('modules/platform/github/utils', () => {
  describe('getRepoUrl()', () => {
    it('returns sshUrl when gitUrl is ssh', () => {
      expect(
        getRepoUrl(
          'some/repo',
          'ssh',
          'git@github.com:some/repo.git',
          parseUrl('https://api.github.com')!,
          'token',
        ),
      ).toBe('git@github.com:some/repo.git');
    });

    it('throws when gitUrl is ssh but sshUrl is missing', () => {
      expect(() =>
        getRepoUrl(
          'some/repo',
          'ssh',
          null,
          parseUrl('https://api.github.com')!,
          'token',
        ),
      ).toThrow(CONFIG_GIT_URL_UNAVAILABLE);
    });

    it('builds an endpoint URL with embedded credentials by default', () => {
      expect(
        getRepoUrl(
          'some/repo',
          undefined,
          'git@github.com:some/repo.git',
          parseUrl('https://api.github.com')!,
          'x-access-token:abc123',
        ),
      ).toBe('https://x-access-token:abc123@github.com/some/repo.git');
    });

    it('builds an endpoint URL when gitUrl is endpoint', () => {
      expect(
        getRepoUrl(
          'some/repo',
          'endpoint',
          'git@github.com:some/repo.git',
          parseUrl('https://api.github.com')!,
          'token',
        ),
      ).toBe('https://token@github.com/some/repo.git');
    });

    it('omits credentials when authToken is null', () => {
      expect(
        getRepoUrl(
          'some/repo',
          undefined,
          null,
          parseUrl('https://api.github.com')!,
          null,
        ),
      ).toBe('https://github.com/some/repo.git');
    });

    it('preserves a GHES endpoint host', () => {
      expect(
        getRepoUrl(
          'some/repo',
          undefined,
          null,
          parseUrl('https://ghe.example.com/api/v3')!,
          'token',
        ),
      ).toBe('https://token@ghe.example.com/some/repo.git');
    });
  });
});
