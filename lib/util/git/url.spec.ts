import { mockDeep } from 'jest-mock-extended';
import { hostRules } from '../../../test/util';
import { getHttpUrl, getRemoteUrlWithToken, parseGitUrl } from './url';

jest.mock('../host-rules', () => mockDeep());

describe('util/git/url', () => {
  describe('parseGitUrl', () => {
    it('supports ports', () => {
      expect(parseGitUrl('https://gitlab.com:8443/')).toEqual({
        filepath: '',
        filepathtype: '',
        full_name: '',
        git_suffix: false,
        hash: '',
        host: 'gitlab.com:8443',
        href: 'https://gitlab.com:8443',
        name: '',
        organization: '',
        owner: '',
        parse_failed: false,
        password: '',
        pathname: '/',
        port: '8443',
        protocol: 'https',
        protocols: ['https'],
        query: {},
        ref: '',
        resource: 'gitlab.com',
        search: '',
        source: 'gitlab.com',
        toString: expect.toBeFunction(),
        token: '',
        user: '',
      });
    });
  });

  describe('getHttpUrl()', () => {
    it('returns https url for git url', () => {
      expect(getHttpUrl('git://foo.bar/')).toBe('https://foo.bar/');
    });

    it('returns https url for https url', () => {
      expect(getHttpUrl('https://foo.bar/')).toBe('https://foo.bar/');
    });

    it('returns http url for http url', () => {
      expect(getHttpUrl('http://foo.bar/')).toBe('http://foo.bar/');
    });

    it('returns gitlab url with token', () => {
      expect(getHttpUrl('http://gitlab.com/', 'token')).toBe(
        'http://gitlab-ci-token:token@gitlab.com/',
      );
      expect(getHttpUrl('http://gitlab.com/', 'gitlab-ci-token:token')).toBe(
        'http://gitlab-ci-token:token@gitlab.com/',
      );
      expect(
        getHttpUrl('http://gitlab.com:8443/', 'gitlab-ci-token:token'),
      ).toBe('http://gitlab-ci-token:token@gitlab.com:8443/');
      expect(getHttpUrl('git@gitlab.com:some/repo', 'token')).toBe(
        'https://gitlab-ci-token:token@gitlab.com/some/repo',
      );
    });

    it('returns github url with token', () => {
      expect(getHttpUrl('http://github.com/', 'token')).toBe(
        'http://x-access-token:token@github.com/',
      );
      expect(getHttpUrl('http://github.com/', 'x-access-token:token')).toBe(
        'http://x-access-token:token@github.com/',
      );
      expect(
        getHttpUrl('http://github.com:8443/', 'x-access-token:token'),
      ).toBe('http://x-access-token:token@github.com:8443/');
      expect(getHttpUrl('git@github.com:some/repo', 'token')).toBe(
        'https://x-access-token:token@github.com/some/repo',
      );
    });

    it('removes username/password from URL', () => {
      expect(getHttpUrl('https://user:password@foo.bar/someOrg/someRepo')).toBe(
        'https://foo.bar/someOrg/someRepo',
      );
    });

    it('replaces username/password with given token', () => {
      expect(
        getHttpUrl(
          'https://user:password@foo.bar/someOrg/someRepo',
          'another-user:a-secret-pwd',
        ),
      ).toBe('https://another-user:a-secret-pwd@foo.bar/someOrg/someRepo');
    });
  });

  describe('getRemoteUrlWithToken()', () => {
    it('returns original url if no host rule is found', () => {
      expect(getRemoteUrlWithToken('https://foo.bar/')).toBe(
        'https://foo.bar/',
      );
    });

    it('transforms an ssh git url to https for the purpose of finding hostRules', () => {
      getRemoteUrlWithToken('git@foo.bar:some/repo');
      expect(hostRules.find).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: 'https://foo.bar/some/repo',
        }),
      );
    });

    it('does not transform urls that are not parseable as git urls', () => {
      getRemoteUrlWithToken('abcdefg');
      expect(hostRules.find).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: 'abcdefg',
        }),
      );
    });

    it('returns http url with token', () => {
      hostRules.find.mockReturnValueOnce({ token: 'token' });
      expect(getRemoteUrlWithToken('http://foo.bar/')).toBe(
        'http://token@foo.bar/',
      );
    });

    it('returns https url with token', () => {
      hostRules.find.mockReturnValueOnce({ token: 'token' });
      expect(getRemoteUrlWithToken('https://foo.bar/')).toBe(
        'https://token@foo.bar/',
      );
    });

    it('returns https url with token for non-http protocols', () => {
      hostRules.find.mockReturnValueOnce({ token: 'token' });
      expect(getRemoteUrlWithToken('ssh://foo.bar/')).toBe(
        'https://token@foo.bar/',
      );
    });

    it('returns https url with encoded token', () => {
      hostRules.find.mockReturnValueOnce({ token: 't#ken' });
      expect(getRemoteUrlWithToken('https://foo.bar/')).toBe(
        'https://t%23ken@foo.bar/',
      );
    });

    it('returns http url with username and password', () => {
      hostRules.find.mockReturnValueOnce({
        username: 'user',
        password: 'pass',
      });
      expect(getRemoteUrlWithToken('http://foo.bar/')).toBe(
        'http://user:pass@foo.bar/',
      );
    });

    it('returns https url with username and password', () => {
      hostRules.find.mockReturnValueOnce({
        username: 'user',
        password: 'pass',
      });
      expect(getRemoteUrlWithToken('https://foo.bar/')).toBe(
        'https://user:pass@foo.bar/',
      );
    });

    it('returns https url with username and password for non-http protocols', () => {
      hostRules.find.mockReturnValueOnce({
        username: 'user',
        password: 'pass',
      });
      expect(getRemoteUrlWithToken('ssh://foo.bar/')).toBe(
        'https://user:pass@foo.bar/',
      );
    });

    it('returns https url with encoded username and password', () => {
      hostRules.find.mockReturnValueOnce({
        username: 'u$er',
        password: 'p@ss',
      });
      expect(getRemoteUrlWithToken('https://foo.bar/')).toBe(
        'https://u%24er:p%40ss@foo.bar/',
      );
    });

    it('returns https url with encoded gitlab token', () => {
      hostRules.find.mockReturnValueOnce({
        token: 'token',
      });
      expect(getRemoteUrlWithToken('ssh://gitlab.com/some/repo.git')).toBe(
        'https://gitlab-ci-token:token@gitlab.com/some/repo.git',
      );
    });

    it('returns https url for ssh url with encoded github token', () => {
      hostRules.find.mockReturnValueOnce({
        token: 'token',
      });
      expect(getRemoteUrlWithToken('ssh://github.com/some/repo.git')).toBe(
        'https://x-access-token:token@github.com/some/repo.git',
      );
    });
  });
});
