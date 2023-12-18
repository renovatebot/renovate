import { add, clear } from '../host-rules';
import {
  getGitAuthenticatedEnvironmentVariables,
  getGitEnvironmentVariables,
} from './auth';

describe('util/git/auth', () => {
  afterEach(() => {
    delete process.env.GIT_CONFIG_COUNT;
  });

  describe('getGitAuthenticatedEnvironmentVariables()', () => {
    it('returns url with token', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables('https://github.com/', {
          token: 'token1234',
          hostType: 'github',
          matchHost: 'github.com',
        }),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0: 'url.https://ssh:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://git:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'https://github.com/',
      });
    });

    it('returns url with username and password', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables('https://example.com/', {
          username: 'username',
          password: 'password',
          hostType: 'github',
          matchHost: 'example.com',
        }),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0:
          'url.https://username:password@example.com/.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.https://username:password@example.com/.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://username:password@example.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@example.com/',
        GIT_CONFIG_VALUE_1: 'git@example.com:',
        GIT_CONFIG_VALUE_2: 'https://example.com/',
      });
    });

    it('prefers token over username and password', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables('https://github.com/', {
          username: 'username',
          password: 'password',
          token: 'token1234',
          hostType: 'github',
          matchHost: 'github.com',
        }),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0: 'url.https://ssh:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://git:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'https://github.com/',
      });
    });

    it('returns url with token for different protocols', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables('foobar://github.com/', {
          token: 'token1234',
          hostType: 'github',
          matchHost: 'github.com',
        }),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0: 'url.https://ssh:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://git:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'https://github.com/',
      });
    });

    it('returns correct url if token already contains GitHub App username', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables('https://github.com/', {
          token: 'x-access-token:token1234',
          hostType: 'github',
          matchHost: 'github.com',
        }),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0:
          'url.https://x-access-token:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.https://x-access-token:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://x-access-token:token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'https://github.com/',
      });
    });

    it('returns url with token and already existing GIT_CONFIG_COUNT from parameter', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables(
          'https://github.com/',
          {
            token: 'token1234',
            hostType: 'github',
            matchHost: 'github.com',
          },
          { GIT_CONFIG_COUNT: '1' },
        ),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '4',
        GIT_CONFIG_KEY_1: 'url.https://ssh:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://git:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_3: 'url.https://token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_1: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_2: 'git@github.com:',
        GIT_CONFIG_VALUE_3: 'https://github.com/',
      });
    });

    it('returns url with token and already existing GIT_CONFIG_COUNT from parameter over environment', () => {
      process.env.GIT_CONFIG_COUNT = '54';
      expect(
        getGitAuthenticatedEnvironmentVariables(
          'https://github.com/',
          {
            token: 'token1234',
            hostType: 'github',
            matchHost: 'github.com',
          },
          { GIT_CONFIG_COUNT: '1' },
        ),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '4',
        GIT_CONFIG_KEY_1: 'url.https://ssh:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://git:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_3: 'url.https://token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_1: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_2: 'git@github.com:',
        GIT_CONFIG_VALUE_3: 'https://github.com/',
      });
    });

    it('returns url with token and already existing GIT_CONFIG_COUNT from environment', () => {
      process.env.GIT_CONFIG_COUNT = '1';
      expect(
        getGitAuthenticatedEnvironmentVariables('https://github.com/', {
          token: 'token1234',
          hostType: 'github',
          matchHost: 'github.com',
        }),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '4',
        GIT_CONFIG_KEY_1: 'url.https://ssh:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://git:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_3: 'url.https://token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_1: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_2: 'git@github.com:',
        GIT_CONFIG_VALUE_3: 'https://github.com/',
      });
    });

    it('returns url with token and passthrough existing variables', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables(
          'https://github.com/',
          {
            token: 'token1234',
            hostType: 'github',
            matchHost: 'github.com',
          },
          { RANDOM_VARIABLE: 'random' },
        ),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0: 'url.https://ssh:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://git:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'https://github.com/',
        RANDOM_VARIABLE: 'random',
      });
    });

    it('return url with token with invalid GIT_CONFIG_COUNT from environment', () => {
      process.env.GIT_CONFIG_COUNT = 'notvalid';
      expect(
        getGitAuthenticatedEnvironmentVariables('https://github.com/', {
          token: 'token1234',
          hostType: 'github',
          matchHost: 'github.com',
        }),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0: 'url.https://ssh:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://git:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'https://github.com/',
      });
    });

    it('returns url with token containing username for GitLab token', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables('https://gitlab.com/', {
          token: 'token1234',
          hostType: 'gitlab',
          matchHost: 'github.com',
        }),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0:
          'url.https://gitlab-ci-token:token1234@gitlab.com/.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.https://gitlab-ci-token:token1234@gitlab.com/.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://gitlab-ci-token:token1234@gitlab.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@gitlab.com/',
        GIT_CONFIG_VALUE_1: 'git@gitlab.com:',
        GIT_CONFIG_VALUE_2: 'https://gitlab.com/',
      });
    });

    it('returns url with token containing username for GitLab token without hostType', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables('https://gitlab.com/', {
          token: 'token1234',
          matchHost: 'gitlab.com',
        }),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0:
          'url.https://gitlab-ci-token:token1234@gitlab.com/.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.https://gitlab-ci-token:token1234@gitlab.com/.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://gitlab-ci-token:token1234@gitlab.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@gitlab.com/',
        GIT_CONFIG_VALUE_1: 'git@gitlab.com:',
        GIT_CONFIG_VALUE_2: 'https://gitlab.com/',
      });
    });

    it('returns original environment variables when no token is set', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables(
          'https://gitlab.com/',
          {
            hostType: 'gitlab',
            matchHost: 'gitlab.com',
          },
          { env: 'value' },
        ),
      ).toStrictEqual({
        env: 'value',
      });
    });

    it('returns url with token for http hosts', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables('http://github.com/', {
          token: 'token1234',
          hostType: 'github',
          matchHost: 'github.com',
        }),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0: 'url.http://ssh:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.http://git:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.http://token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'http://github.com/',
      });
    });

    it('returns url with token for orgs', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables('https://github.com/org', {
          token: 'token1234',
          hostType: 'github',
          matchHost: 'github.com',
        }),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0: 'url.https://ssh:token1234@github.com/org.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://git:token1234@github.com/org.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://token1234@github.com/org.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/org',
        GIT_CONFIG_VALUE_1: 'git@github.com:org',
        GIT_CONFIG_VALUE_2: 'https://github.com/org',
      });
    });

    it('returns url with token for orgs and projects', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables('https://github.com/org/repo', {
          token: 'token1234',
          hostType: 'github',
          matchHost: 'github.com',
        }),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0:
          'url.https://ssh:token1234@github.com/org/repo.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.https://git:token1234@github.com/org/repo.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://token1234@github.com/org/repo.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/org/repo',
        GIT_CONFIG_VALUE_1: 'git@github.com:org/repo',
        GIT_CONFIG_VALUE_2: 'https://github.com/org/repo',
      });
    });

    it('returns url with token for orgs and projects and ports', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables(
          'https://github.com:89/org/repo.git',
          {
            token: 'token1234',
            hostType: 'github',
            matchHost: 'github.com',
          },
        ),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0:
          'url.https://ssh:token1234@github.com:89/org/repo.git.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.https://git:token1234@github.com:89/org/repo.git.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://token1234@github.com:89/org/repo.git.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com:89/org/repo.git',
        GIT_CONFIG_VALUE_1: 'ssh://git@github.com:89/org/repo.git',
        GIT_CONFIG_VALUE_2: 'https://github.com:89/org/repo.git',
      });
    });
  });

  describe('getGitEnvironmentVariables()', () => {
    beforeEach(() => {
      clear();
    });

    it('returns empty object if no environment variables exist', () => {
      expect(getGitEnvironmentVariables()).toStrictEqual({});
    });

    it('returns environment variables with token if hostRule for api.github.com exists', () => {
      add({
        hostType: 'github',
        matchHost: 'api.github.com',
        token: 'token123',
      });
      expect(getGitEnvironmentVariables()).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0: 'url.https://ssh:token123@github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://git:token123@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://token123@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'https://github.com/',
      });
    });

    it('returns environment variables with token if hostRule for multiple hostsRules', () => {
      add({
        hostType: 'github',
        matchHost: 'api.github.com',
        token: 'token123',
      });
      add({
        hostType: 'gitlab',
        matchHost: 'https://gitlab.example.com',
        token: 'token234',
      });
      add({
        hostType: 'github',
        matchHost: 'https://github.example.com',
        token: 'token345',
      });
      expect(getGitEnvironmentVariables()).toStrictEqual({
        GIT_CONFIG_COUNT: '9',
        GIT_CONFIG_KEY_0: 'url.https://ssh:token123@github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://git:token123@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://token123@github.com/.insteadOf',
        GIT_CONFIG_KEY_3:
          'url.https://gitlab-ci-token:token234@gitlab.example.com/.insteadOf',
        GIT_CONFIG_KEY_4:
          'url.https://gitlab-ci-token:token234@gitlab.example.com/.insteadOf',
        GIT_CONFIG_KEY_5:
          'url.https://gitlab-ci-token:token234@gitlab.example.com/.insteadOf',
        GIT_CONFIG_KEY_6:
          'url.https://ssh:token345@github.example.com/.insteadOf',
        GIT_CONFIG_KEY_7:
          'url.https://git:token345@github.example.com/.insteadOf',
        GIT_CONFIG_KEY_8: 'url.https://token345@github.example.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'https://github.com/',
        GIT_CONFIG_VALUE_3: 'ssh://git@gitlab.example.com/',
        GIT_CONFIG_VALUE_4: 'git@gitlab.example.com:',
        GIT_CONFIG_VALUE_5: 'https://gitlab.example.com/',
        GIT_CONFIG_VALUE_6: 'ssh://git@github.example.com/',
        GIT_CONFIG_VALUE_7: 'git@github.example.com:',
        GIT_CONFIG_VALUE_8: 'https://github.example.com/',
      });
    });

    it('returns environment variables with token if hostRule is for Gitlab', () => {
      add({
        hostType: 'gitlab',
        matchHost: 'https://gitlab.example.com',
        token: 'token123',
      });
      expect(getGitEnvironmentVariables()).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0:
          'url.https://gitlab-ci-token:token123@gitlab.example.com/.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.https://gitlab-ci-token:token123@gitlab.example.com/.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://gitlab-ci-token:token123@gitlab.example.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@gitlab.example.com/',
        GIT_CONFIG_VALUE_1: 'git@gitlab.example.com:',
        GIT_CONFIG_VALUE_2: 'https://gitlab.example.com/',
      });
    });

    it('returns environment variables with username and password', () => {
      add({
        hostType: 'gitlab',
        matchHost: 'https://gitlab.example.com',
        username: 'user1234',
        password: 'pass1234',
      });
      expect(getGitEnvironmentVariables()).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0:
          'url.https://user1234:pass1234@gitlab.example.com/.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.https://user1234:pass1234@gitlab.example.com/.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://user1234:pass1234@gitlab.example.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@gitlab.example.com/',
        GIT_CONFIG_VALUE_1: 'git@gitlab.example.com:',
        GIT_CONFIG_VALUE_2: 'https://gitlab.example.com/',
      });
    });

    it('returns environment variables with URL encoded username and password', () => {
      add({
        hostType: 'gitlab',
        matchHost: 'https://gitlab.example.com',
        username: 'user @ :$ abc',
        password: 'abc @ blub pass0:',
      });
      expect(getGitEnvironmentVariables()).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0:
          'url.https://user%20%40%20%3A%24%20abc:abc%20%40%20blub%20pass0%3A@gitlab.example.com/.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.https://user%20%40%20%3A%24%20abc:abc%20%40%20blub%20pass0%3A@gitlab.example.com/.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://user%20%40%20%3A%24%20abc:abc%20%40%20blub%20pass0%3A@gitlab.example.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@gitlab.example.com/',
        GIT_CONFIG_VALUE_1: 'git@gitlab.example.com:',
        GIT_CONFIG_VALUE_2: 'https://gitlab.example.com/',
      });
    });

    it('returns no environment variables when hostType is not supported', () => {
      add({
        hostType: 'custom',
        matchHost: 'https://custom.example.com',
        token: 'token123',
      });
      expect(getGitEnvironmentVariables()).toStrictEqual({});
    });

    it('returns no environment variables when only username is set', () => {
      add({
        hostType: 'custom',
        matchHost: 'https://custom.example.com',
        username: 'user123',
      });
      expect(getGitEnvironmentVariables()).toStrictEqual({});
    });

    it('returns no environment variables when only password is set', () => {
      add({
        hostType: 'custom',
        matchHost: 'https://custom.example.com',
        password: 'pass123',
      });
      expect(getGitEnvironmentVariables()).toStrictEqual({});
    });

    it('returns environment variables when hostType is explicitly set', () => {
      add({
        hostType: 'custom',
        matchHost: 'https://custom.example.com',
        token: 'token123',
      });
      expect(getGitEnvironmentVariables(['custom'])).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0:
          'url.https://ssh:token123@custom.example.com/.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.https://git:token123@custom.example.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://token123@custom.example.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@custom.example.com/',
        GIT_CONFIG_VALUE_1: 'git@custom.example.com:',
        GIT_CONFIG_VALUE_2: 'https://custom.example.com/',
      });
    });

    it('returns empty environment variables when matchHost contains invalid protocol', () => {
      add({
        hostType: 'github',
        matchHost: 'invalid://*.github.example.com',
        token: 'token123',
      });
      expect(getGitEnvironmentVariables(['custom'])).toStrictEqual({});
    });
  });
});
