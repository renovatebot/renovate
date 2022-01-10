import { PlatformId } from '../../constants';
import { getAuthenticatedEnvironmentVariables } from './auth';

describe('util/git/auth', () => {
  afterEach(() => {
    delete process.env.GIT_CONFIG_COUNT;
  });
  describe('getGitAuthenticatedEnvironmentVariables()', () => {
    it('returns url with token', () => {
      expect(
        getAuthenticatedEnvironmentVariables('https://github.com/', {
          token: 'token1234',
          hostType: PlatformId.Github,
          matchHost: 'github.com',
        })
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0: 'url.https://api:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://ssh:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://git:token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'https://github.com/',
        GIT_CONFIG_VALUE_1: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_2: 'git@github.com:',
      });
    });

    it('returns correct url if token already contains GitHub App username', () => {
      expect(
        getAuthenticatedEnvironmentVariables('https://github.com/', {
          token: 'x-access-token:token1234',
          hostType: PlatformId.Github,
          matchHost: 'github.com',
        })
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0:
          'url.https://x-access-token:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.https://x-access-token:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://x-access-token:token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'https://github.com/',
        GIT_CONFIG_VALUE_1: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_2: 'git@github.com:',
      });
    });

    it('returns url with token and already existing GIT_CONFIG_COUNT from parameter', () => {
      expect(
        getAuthenticatedEnvironmentVariables(
          'https://github.com/',
          {
            token: 'token1234',
            hostType: PlatformId.Github,
            matchHost: 'github.com',
          },
          { GIT_CONFIG_COUNT: '1' }
        )
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '4',
        GIT_CONFIG_KEY_1: 'url.https://api:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://ssh:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_3: 'url.https://git:token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_1: 'https://github.com/',
        GIT_CONFIG_VALUE_2: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_3: 'git@github.com:',
      });
    });

    it('returns url with token and already existing GIT_CONFIG_COUNT from parameter over environment', () => {
      process.env.GIT_CONFIG_COUNT = '54';
      expect(
        getAuthenticatedEnvironmentVariables(
          'https://github.com/',
          {
            token: 'token1234',
            hostType: PlatformId.Github,
            matchHost: 'github.com',
          },
          { GIT_CONFIG_COUNT: '1' }
        )
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '4',
        GIT_CONFIG_KEY_1: 'url.https://api:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://ssh:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_3: 'url.https://git:token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_1: 'https://github.com/',
        GIT_CONFIG_VALUE_2: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_3: 'git@github.com:',
      });
    });

    it('returns url with token and already existing GIT_CONFIG_COUNT from environment', () => {
      process.env.GIT_CONFIG_COUNT = '1';
      expect(
        getAuthenticatedEnvironmentVariables('https://github.com/', {
          token: 'token1234',
          hostType: PlatformId.Github,
          matchHost: 'github.com',
        })
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '4',
        GIT_CONFIG_KEY_1: 'url.https://api:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://ssh:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_3: 'url.https://git:token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_1: 'https://github.com/',
        GIT_CONFIG_VALUE_2: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_3: 'git@github.com:',
      });
    });

    it('returns url with token and passthrough existing variables', () => {
      expect(
        getAuthenticatedEnvironmentVariables(
          'https://github.com/',
          {
            token: 'token1234',
            hostType: PlatformId.Github,
            matchHost: 'github.com',
          },
          { RANDOM_VARIABLE: 'random' }
        )
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0: 'url.https://api:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://ssh:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://git:token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'https://github.com/',
        GIT_CONFIG_VALUE_1: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_2: 'git@github.com:',
        RANDOM_VARIABLE: 'random',
      });
    });

    it('return url with token with invalid GIT_CONFIG_COUNT from environment', () => {
      process.env.GIT_CONFIG_COUNT = 'notvalid';
      expect(
        getAuthenticatedEnvironmentVariables('https://github.com/', {
          token: 'token1234',
          hostType: PlatformId.Github,
          matchHost: 'github.com',
        })
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0: 'url.https://api:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://ssh:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://git:token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'https://github.com/',
        GIT_CONFIG_VALUE_1: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_2: 'git@github.com:',
      });
    });

    it('returns url with token containing username for GitLab token', () => {
      expect(
        getAuthenticatedEnvironmentVariables('https://gitlab.com/', {
          token: 'token1234',
          hostType: PlatformId.Gitlab,
          matchHost: 'github.com',
        })
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0:
          'url.https://gitlab-ci-token:token1234@gitlab.com/.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.https://gitlab-ci-token:token1234@gitlab.com/.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://gitlab-ci-token:token1234@gitlab.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'https://gitlab.com/',
        GIT_CONFIG_VALUE_1: 'ssh://git@gitlab.com/',
        GIT_CONFIG_VALUE_2: 'git@gitlab.com:',
      });
    });

    it('returns original environment variables when no token is set', () => {
      expect(
        getAuthenticatedEnvironmentVariables(
          'https://gitlab.com/',
          {
            username: 'testing',
            password: '1234',
            hostType: PlatformId.Gitlab,
            matchHost: 'github.com',
          },
          { env: 'value' }
        )
      ).toStrictEqual({
        env: 'value',
      });
    });

    it('returns url with token for http hosts', () => {
      expect(
        getAuthenticatedEnvironmentVariables('http://github.com/', {
          token: 'token1234',
          hostType: PlatformId.Github,
          matchHost: 'github.com',
        })
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0: 'url.http://api:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.http://ssh:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.http://git:token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'http://github.com/',
        GIT_CONFIG_VALUE_1: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_2: 'git@github.com:',
      });
    });
  });
});
