import { PlatformId } from '../../constants';
import { getGitAuthenticatedEnvironmentVariables } from './auth';

describe('util/git/auth', () => {
  afterEach(() => {
    delete process.env.GIT_CONFIG_COUNT;
  });

  describe('getGitAuthenticatedEnvironmentVariables()', () => {
    it('returns url with token', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables('https://github.com/', {
          token: 'token1234',
          hostType: PlatformId.Github,
          matchHost: 'github.com',
        })
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
          hostType: PlatformId.Github,
          matchHost: 'github.com',
        })
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
            hostType: PlatformId.Github,
            matchHost: 'github.com',
          },
          { GIT_CONFIG_COUNT: '1' }
        )
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
            hostType: PlatformId.Github,
            matchHost: 'github.com',
          },
          { GIT_CONFIG_COUNT: '1' }
        )
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
          hostType: PlatformId.Github,
          matchHost: 'github.com',
        })
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
            hostType: PlatformId.Github,
            matchHost: 'github.com',
          },
          { RANDOM_VARIABLE: 'random' }
        )
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
          hostType: PlatformId.Github,
          matchHost: 'github.com',
        })
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
        })
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
        getGitAuthenticatedEnvironmentVariables('http://github.com/', {
          token: 'token1234',
          hostType: PlatformId.Github,
          matchHost: 'github.com',
        })
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
          hostType: PlatformId.Github,
          matchHost: 'github.com',
        })
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
          hostType: PlatformId.Github,
          matchHost: 'github.com',
        })
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
            hostType: PlatformId.Github,
            matchHost: 'github.com',
          }
        )
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
});
