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
        ),
      ).toThrow(CONFIG_GIT_URL_UNAVAILABLE);
    });

    it('builds a clean endpoint URL by default', () => {
      expect(
        getRepoUrl(
          'some/repo',
          undefined,
          'git@github.com:some/repo.git',
          parseUrl('https://api.github.com')!,
        ),
      ).toBe('https://github.com/some/repo.git');
    });

    it('builds an endpoint URL when gitUrl is endpoint', () => {
      expect(
        getRepoUrl(
          'some/repo',
          'endpoint',
          'git@github.com:some/repo.git',
          parseUrl('https://api.github.com')!,
        ),
      ).toBe('https://github.com/some/repo.git');
    });

    it('builds an endpoint URL without an sshUrl', () => {
      expect(
        getRepoUrl(
          'some/repo',
          undefined,
          null,
          parseUrl('https://api.github.com')!,
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
        ),
      ).toBe('https://ghe.example.com/some/repo.git');
    });
  });
});
