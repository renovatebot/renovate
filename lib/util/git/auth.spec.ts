import { add, clear, detachUrlCredentials } from '../host-rules.ts';
import {
  getGitAuthenticatedEnvironmentVariables,
  getGitEnvironmentVariables,
} from './auth.ts';

describe('util/git/auth', () => {
  describe('getGitAuthenticatedEnvironmentVariables()', () => {
    it('returns url with token', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables({}, 'https://github.com/', {
          token: 'token1234',
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

    it('returns url with username and password', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables({}, 'https://example.com/', {
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
        getGitAuthenticatedEnvironmentVariables({}, 'https://github.com/', {
          username: 'username',
          password: 'password',
          token: 'token1234',
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

    it('returns url with token for different protocols', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables({}, 'foobar://github.com/', {
          token: 'token1234',
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

    it('returns correct url if token already contains GitHub App username', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables({}, 'https://github.com/', {
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
          { GIT_CONFIG_COUNT: '1' },
          'https://github.com/',
          {
            token: 'token1234',
            hostType: 'github',
            matchHost: 'github.com',
          },
        ),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '4',
        GIT_CONFIG_KEY_1:
          'url.https://x-access-token:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://x-access-token:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_3:
          'url.https://x-access-token:token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_1: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_2: 'git@github.com:',
        GIT_CONFIG_VALUE_3: 'https://github.com/',
      });
    });

    it('returns url with token and already existing GIT_CONFIG_COUNT from parameter over environment', () => {
      vi.stubEnv('GIT_CONFIG_COUNT', '54');
      expect(
        getGitAuthenticatedEnvironmentVariables(
          { GIT_CONFIG_COUNT: '1' },
          'https://github.com/',
          {
            token: 'token1234',
            hostType: 'github',
            matchHost: 'github.com',
          },
        ),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '4',
        GIT_CONFIG_KEY_1:
          'url.https://x-access-token:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://x-access-token:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_3:
          'url.https://x-access-token:token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_1: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_2: 'git@github.com:',
        GIT_CONFIG_VALUE_3: 'https://github.com/',
      });
    });

    it('does not inherit GIT_CONFIG_COUNT from the process environment', () => {
      vi.stubEnv('GIT_CONFIG_COUNT', '1');
      expect(
        getGitAuthenticatedEnvironmentVariables({}, 'https://github.com/', {
          token: 'token1234',
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

    it('returns url with token and passthrough existing variables', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables(
          { RANDOM_VARIABLE: 'random' },
          'https://github.com/',
          {
            token: 'token1234',
            hostType: 'github',
            matchHost: 'github.com',
          },
        ),
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
        RANDOM_VARIABLE: 'random',
      });
    });

    it('ignores an invalid supplied GIT_CONFIG_COUNT', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables(
          { GIT_CONFIG_COUNT: 'notvalid' },
          'https://github.com/',
          {
            token: 'token1234',
            hostType: 'github',
            matchHost: 'github.com',
          },
        ),
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

    it('returns url with token containing username for GitLab token', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables({}, 'https://gitlab.com/', {
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
        getGitAuthenticatedEnvironmentVariables({}, 'https://gitlab.com/', {
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

    it.each(['gitea', 'forgejo'])(
      'returns url with x-oauth-basic password for %s token',
      (hostType) => {
        expect(
          getGitAuthenticatedEnvironmentVariables(
            {},
            `https://${hostType}.example.com/`,
            {
              token: 'token1234',
              hostType,
              matchHost: `${hostType}.example.com`,
            },
          ),
        ).toStrictEqual({
          GIT_CONFIG_COUNT: '3',
          GIT_CONFIG_KEY_0: `url.https://token1234:x-oauth-basic@${hostType}.example.com/.insteadOf`,
          GIT_CONFIG_KEY_1: `url.https://token1234:x-oauth-basic@${hostType}.example.com/.insteadOf`,
          GIT_CONFIG_KEY_2: `url.https://token1234:x-oauth-basic@${hostType}.example.com/.insteadOf`,
          GIT_CONFIG_VALUE_0: `ssh://git@${hostType}.example.com/`,
          GIT_CONFIG_VALUE_1: `git@${hostType}.example.com:`,
          GIT_CONFIG_VALUE_2: `https://${hostType}.example.com/`,
        });
      },
    );

    it('keeps a token containing username and password unchanged', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables({}, 'https://gitea.com/', {
          token: 'user:pass',
          hostType: 'gitea',
          matchHost: 'gitea.com',
        }),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0: 'url.https://user:pass@gitea.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://user:pass@gitea.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://user:pass@gitea.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@gitea.com/',
        GIT_CONFIG_VALUE_1: 'git@gitea.com:',
        GIT_CONFIG_VALUE_2: 'https://gitea.com/',
      });
    });

    it.each(['go', 'cargo'])(
      'returns url with x-access-token username for %s host rule token on github.com',
      (hostType) => {
        expect(
          getGitAuthenticatedEnvironmentVariables({}, 'https://github.com/', {
            token: 'token1234',
            hostType,
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
      },
    );

    it('returns original environment variables when no token is set', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables(
          { env: 'value' },
          'https://gitlab.com/',
          {
            hostType: 'gitlab',
            matchHost: 'gitlab.com',
          },
        ),
      ).toStrictEqual({
        env: 'value',
      });
    });

    it('returns url with token for http hosts', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables({}, 'http://github.com/', {
          token: 'token1234',
          hostType: 'github',
          matchHost: 'github.com',
        }),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0:
          'url.http://x-access-token:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.http://x-access-token:token1234@github.com/.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.http://x-access-token:token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'http://github.com/',
      });
    });

    it('returns url with token for orgs', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables({}, 'https://github.com/org', {
          token: 'token1234',
          hostType: 'github',
          matchHost: 'github.com',
        }),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0:
          'url.https://x-access-token:token1234@github.com/org.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.https://x-access-token:token1234@github.com/org.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://x-access-token:token1234@github.com/org.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/org',
        GIT_CONFIG_VALUE_1: 'git@github.com:org',
        GIT_CONFIG_VALUE_2: 'https://github.com/org',
      });
    });

    it('returns url with token for orgs and projects', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables(
          {},
          'https://github.com/org/repo',
          {
            token: 'token1234',
            hostType: 'github',
            matchHost: 'github.com',
          },
        ),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0:
          'url.https://x-access-token:token1234@github.com/org/repo.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.https://x-access-token:token1234@github.com/org/repo.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://x-access-token:token1234@github.com/org/repo.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/org/repo',
        GIT_CONFIG_VALUE_1: 'git@github.com:org/repo',
        GIT_CONFIG_VALUE_2: 'https://github.com/org/repo',
      });
    });

    it('returns url with token for orgs and projects and ports', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables(
          {},
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
          'url.https://x-access-token:token1234@github.com:89/org/repo.git.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.https://x-access-token:token1234@github.com:89/org/repo.git.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://x-access-token:token1234@github.com:89/org/repo.git.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com:89/org/repo.git',
        GIT_CONFIG_VALUE_1: 'ssh://git@github.com:89/org/repo.git',
        GIT_CONFIG_VALUE_2: 'https://github.com:89/org/repo.git',
      });
    });

    it('returns url with token for bitbucket-server', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables(
          {},
          'https://git.mycompany.com/',
          {
            token: 'token1234',
            hostType: 'bitbucket-server',
            matchHost: 'git.mycompany.com',
          },
        ),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0:
          'url.https://x-token-auth:token1234@git.mycompany.com/scm/.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.https://x-token-auth:token1234@git.mycompany.com/scm/.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://x-token-auth:token1234@git.mycompany.com/scm/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@git.mycompany.com:7999/',
        GIT_CONFIG_VALUE_1: 'ssh://git@git.mycompany.com:7999/',
        GIT_CONFIG_VALUE_2: 'https://git.mycompany.com/scm/',
      });
    });

    it.each([
      ['azure', 'https://dev.azure.com/', 'dev.azure.com'],
      ['scm-manager', 'https://scm.example.com/', 'scm.example.com'],
    ])(
      'returns url with x-access-token username for %s token',
      (hostType, url, host) => {
        expect(
          getGitAuthenticatedEnvironmentVariables({}, url, {
            token: 'token1234',
            hostType,
            matchHost: host,
          }),
        ).toStrictEqual({
          GIT_CONFIG_COUNT: '3',
          GIT_CONFIG_KEY_0: `url.https://x-access-token:token1234@${host}/.insteadOf`,
          GIT_CONFIG_KEY_1: `url.https://x-access-token:token1234@${host}/.insteadOf`,
          GIT_CONFIG_KEY_2: `url.https://x-access-token:token1234@${host}/.insteadOf`,
          GIT_CONFIG_VALUE_0: `ssh://git@${host}/`,
          GIT_CONFIG_VALUE_1: `git@${host}:`,
          GIT_CONFIG_VALUE_2: url,
        });
      },
    );

    it.each([
      ['bitbucket.org', 'bitbucket'],
      ['bitbucket.org', undefined],
      ['bitbucket.com', 'bitbucket'],
      ['git.example.com', 'bitbucket'],
    ])(
      'returns url with a single x-token-auth username for %s token with hostType %s',
      (host, hostType) => {
        expect(
          getGitAuthenticatedEnvironmentVariables({}, `https://${host}/`, {
            token: 'token1234',
            hostType,
            matchHost: host,
          }),
        ).toStrictEqual({
          GIT_CONFIG_COUNT: '3',
          GIT_CONFIG_KEY_0: `url.https://x-token-auth:token1234@${host}/.insteadOf`,
          GIT_CONFIG_KEY_1: `url.https://x-token-auth:token1234@${host}/.insteadOf`,
          GIT_CONFIG_KEY_2: `url.https://x-token-auth:token1234@${host}/.insteadOf`,
          GIT_CONFIG_VALUE_0: `ssh://git@${host}/`,
          GIT_CONFIG_VALUE_1: `git@${host}:`,
          GIT_CONFIG_VALUE_2: `https://${host}/`,
        });
      },
    );

    it('keeps a bitbucket token containing username and password unchanged', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables({}, 'https://bitbucket.org/', {
          token: 'user:pass',
          hostType: 'bitbucket',
          matchHost: 'bitbucket.org',
        }),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0: 'url.https://user:pass@bitbucket.org/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://user:pass@bitbucket.org/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://user:pass@bitbucket.org/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@bitbucket.org/',
        GIT_CONFIG_VALUE_1: 'git@bitbucket.org:',
        GIT_CONFIG_VALUE_2: 'https://bitbucket.org/',
      });
    });
  });

  describe('getGitEnvironmentVariables()', () => {
    beforeEach(() => {
      clear();
    });

    it('returns empty object if no environment variables exist', () => {
      expect(getGitEnvironmentVariables({})).toStrictEqual({});
    });

    it('leaves out credentials detached from registry URLs', () => {
      detachUrlCredentials('https://user:pass@git.example.com/org/repo', [
        'go',
      ]);

      expect(getGitEnvironmentVariables({}, ['go'])).toStrictEqual({});
    });

    it('adds credentials detached from the URL of the repository only for that URL', () => {
      const url = 'https://git.example.com/index.git';
      detachUrlCredentials(
        'https://user:pat1234567890123@git.example.com/index.git',
        ['crate'],
      );

      expect(getGitEnvironmentVariables({}, ['crate'], url)).toMatchObject({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_2:
          'url.https://user:pat1234567890123@git.example.com/index.git.insteadOf',
        GIT_CONFIG_VALUE_2: url,
      });
      expect(getGitEnvironmentVariables({}, ['crate'])).toStrictEqual({});
      expect(getGitEnvironmentVariables({})).toStrictEqual({});
      expect(
        getGitEnvironmentVariables(
          {},
          ['crate'],
          'https://git.example.com/other.git',
        ),
      ).toStrictEqual({});
    });

    it('does not add a configured token without matchHost for the URL of the repository', () => {
      add({ hostType: 'crate', token: 'token123' });

      expect(
        getGitEnvironmentVariables(
          {},
          ['crate'],
          'https://git.example.com/index.git',
        ),
      ).toStrictEqual({});
    });

    it('adds a configured token with matchHost once for the URL of the repository', () => {
      const url = 'https://git.example.com/index.git';
      add({
        hostType: 'crate',
        matchHost: 'git.example.com',
        token: 'token123',
      });

      expect(getGitEnvironmentVariables({}, ['crate'], url)).toMatchObject({
        GIT_CONFIG_COUNT: '3',
      });
    });

    it('adds the credentials detached from the longest matching path for the URL of the repository', () => {
      const url = 'https://git.example.com/org/index.git';
      detachUrlCredentials(
        'https://outer:outerpass1234567890@git.example.com',
        ['crate'],
      );
      detachUrlCredentials(
        'https://inner:innerpass1234567890@git.example.com/org',
        ['crate'],
      );

      expect(getGitEnvironmentVariables({}, ['crate'], url)).toMatchObject({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_2:
          'url.https://inner:innerpass1234567890@git.example.com/org/index.git.insteadOf',
      });
    });

    it('adds a token detached from the URL of the repository on an unknown host as the username', () => {
      const url = 'https://git.example.com/index.git';
      detachUrlCredentials(
        'https://ghp_abcdefghijklmnopqrstuvwxyz@git.example.com/index.git',
        ['crate'],
      );

      expect(getGitEnvironmentVariables({}, ['crate'], url)).toMatchObject({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_2:
          'url.https://ghp_abcdefghijklmnopqrstuvwxyz@git.example.com/index.git.insteadOf',
        GIT_CONFIG_VALUE_2: url,
      });
    });

    it.each`
      url                                    | registryUrl                                                        | key
      ${'https://git.example.com/index.git'} | ${'https://abc%2Fdef%40xyz%3Atok123456@git.example.com/index.git'} | ${'url.https://abc%2Fdef%40xyz%3Atok123456@git.example.com/index.git.insteadOf'}
      ${'https://github.com/org/index.git'}  | ${'https://abc%2Fdef%40xyz%3Atok123456@github.com/org/index.git'}  | ${'url.https://x-access-token:abc%2Fdef%40xyz%3Atok123456@github.com/org/index.git.insteadOf'}
    `(
      'adds a detached token with reserved characters percent-encoded for $url',
      ({ url, registryUrl, key }) => {
        detachUrlCredentials(registryUrl, ['crate']);

        expect(getGitEnvironmentVariables({}, ['crate'], url)).toMatchObject({
          GIT_CONFIG_COUNT: '3',
          GIT_CONFIG_KEY_2: key,
          GIT_CONFIG_VALUE_2: url,
        });
      },
    );

    it('adds a token detached from the URL of a github.com repository with x-access-token', () => {
      const url = 'https://github.com/org/index.git';
      detachUrlCredentials(
        'https://ghp_abcdefghijklmnopqrstuvwxyz@github.com/org/index.git',
        ['crate'],
      );

      expect(getGitEnvironmentVariables({}, ['crate'], url)).toMatchObject({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_2:
          'url.https://x-access-token:ghp_abcdefghijklmnopqrstuvwxyz@github.com/org/index.git.insteadOf',
        GIT_CONFIG_VALUE_2: url,
      });
    });

    it('returns environment variables with token if hostRule for api.github.com exists', () => {
      add({
        hostType: 'github',
        matchHost: 'api.github.com',
        token: 'token123',
      });
      expect(getGitEnvironmentVariables({})).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0:
          'url.https://x-access-token:token123@github.com/.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.https://x-access-token:token123@github.com/.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://x-access-token:token123@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'https://github.com/',
      });
    });

    it('appends authentication to the supplied environment', () => {
      add({
        hostType: 'github',
        matchHost: 'api.github.com',
        token: 'token123',
      });
      expect(
        getGitEnvironmentVariables({
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: 'existing-key',
          GIT_CONFIG_VALUE_0: 'existing-value',
        }),
      ).toStrictEqual({
        GIT_CONFIG_COUNT: '4',
        GIT_CONFIG_KEY_0: 'existing-key',
        GIT_CONFIG_KEY_1:
          'url.https://x-access-token:token123@github.com/.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://x-access-token:token123@github.com/.insteadOf',
        GIT_CONFIG_KEY_3:
          'url.https://x-access-token:token123@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'existing-value',
        GIT_CONFIG_VALUE_1: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_2: 'git@github.com:',
        GIT_CONFIG_VALUE_3: 'https://github.com/',
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
      expect(getGitEnvironmentVariables({})).toStrictEqual({
        GIT_CONFIG_COUNT: '9',
        GIT_CONFIG_KEY_0:
          'url.https://x-access-token:token123@github.com/.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.https://x-access-token:token123@github.com/.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://x-access-token:token123@github.com/.insteadOf',
        GIT_CONFIG_KEY_3:
          'url.https://gitlab-ci-token:token234@gitlab.example.com/.insteadOf',
        GIT_CONFIG_KEY_4:
          'url.https://gitlab-ci-token:token234@gitlab.example.com/.insteadOf',
        GIT_CONFIG_KEY_5:
          'url.https://gitlab-ci-token:token234@gitlab.example.com/.insteadOf',
        GIT_CONFIG_KEY_6:
          'url.https://x-access-token:token345@github.example.com/.insteadOf',
        GIT_CONFIG_KEY_7:
          'url.https://x-access-token:token345@github.example.com/.insteadOf',
        GIT_CONFIG_KEY_8:
          'url.https://x-access-token:token345@github.example.com/.insteadOf',
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
      expect(getGitEnvironmentVariables({})).toStrictEqual({
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
      expect(getGitEnvironmentVariables({})).toStrictEqual({
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
      expect(getGitEnvironmentVariables({})).toStrictEqual({
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
      expect(getGitEnvironmentVariables({})).toStrictEqual({});
    });

    it('returns no environment variables when only username is set', () => {
      add({
        hostType: 'custom',
        matchHost: 'https://custom.example.com',
        username: 'user123',
      });
      expect(getGitEnvironmentVariables({})).toStrictEqual({});
    });

    it('returns no environment variables when only password is set', () => {
      add({
        hostType: 'custom',
        matchHost: 'https://custom.example.com',
        password: 'pass123',
      });
      expect(getGitEnvironmentVariables({})).toStrictEqual({});
    });

    it('returns environment variables when hostType is explicitly set', () => {
      add({
        hostType: 'custom',
        matchHost: 'https://custom.example.com',
        token: 'token123',
      });
      expect(getGitEnvironmentVariables({}, ['custom'])).toStrictEqual({
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
      expect(getGitEnvironmentVariables({}, ['custom'])).toStrictEqual({});
    });

    it('returns environment variables for bitbucket-server', () => {
      add({
        hostType: 'bitbucket-server',
        matchHost: 'git.mycompany.com',
        token: 'token123',
      });
      expect(getGitEnvironmentVariables({})).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0:
          'url.https://x-token-auth:token123@git.mycompany.com/scm/.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.https://x-token-auth:token123@git.mycompany.com/scm/.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://x-token-auth:token123@git.mycompany.com/scm/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@git.mycompany.com:7999/',
        GIT_CONFIG_VALUE_1: 'ssh://git@git.mycompany.com:7999/',
        GIT_CONFIG_VALUE_2: 'https://git.mycompany.com/scm/',
      });
    });
  });
});
