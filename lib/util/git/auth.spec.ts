import { add, clear } from '../host-rules.ts';
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
        GIT_CONFIG_KEY_0: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://github.com/.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'Authorization: Basic dG9rZW4xMjM0Og==',
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
        GIT_CONFIG_KEY_0: 'url.https://example.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://example.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://example.com/.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@example.com/',
        GIT_CONFIG_VALUE_1: 'git@example.com:',
        GIT_CONFIG_VALUE_2: 'Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=',
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
        GIT_CONFIG_KEY_0: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://github.com/.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'Authorization: Basic dG9rZW4xMjM0Og==',
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
        GIT_CONFIG_KEY_0: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://github.com/.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'Authorization: Basic dG9rZW4xMjM0Og==',
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
        GIT_CONFIG_KEY_0: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://github.com/.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2:
          'Authorization: Basic eC1hY2Nlc3MtdG9rZW46dG9rZW4xMjM0',
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
        GIT_CONFIG_KEY_1: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_3: 'http.https://github.com/.extraHeader',
        GIT_CONFIG_VALUE_1: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_2: 'git@github.com:',
        GIT_CONFIG_VALUE_3: 'Authorization: Basic dG9rZW4xMjM0Og==',
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
        GIT_CONFIG_KEY_1: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_3: 'http.https://github.com/.extraHeader',
        GIT_CONFIG_VALUE_1: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_2: 'git@github.com:',
        GIT_CONFIG_VALUE_3: 'Authorization: Basic dG9rZW4xMjM0Og==',
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
        GIT_CONFIG_KEY_0: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://github.com/.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'Authorization: Basic dG9rZW4xMjM0Og==',
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
        GIT_CONFIG_KEY_0: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://github.com/.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'Authorization: Basic dG9rZW4xMjM0Og==',
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
        GIT_CONFIG_KEY_0: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://github.com/.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'Authorization: Basic dG9rZW4xMjM0Og==',
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
        GIT_CONFIG_KEY_0: 'url.https://gitlab.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://gitlab.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://gitlab.com/.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@gitlab.com/',
        GIT_CONFIG_VALUE_1: 'git@gitlab.com:',
        GIT_CONFIG_VALUE_2:
          'Authorization: Basic Z2l0bGFiLWNpLXRva2VuOnRva2VuMTIzNA==',
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
        GIT_CONFIG_KEY_0: 'url.https://gitlab.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://gitlab.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://gitlab.com/.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@gitlab.com/',
        GIT_CONFIG_VALUE_1: 'git@gitlab.com:',
        GIT_CONFIG_VALUE_2:
          'Authorization: Basic Z2l0bGFiLWNpLXRva2VuOnRva2VuMTIzNA==',
      });
    });

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
        GIT_CONFIG_KEY_0: 'url.http://github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.http://github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'http.http://github.com/.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'Authorization: Basic dG9rZW4xMjM0Og==',
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
        GIT_CONFIG_KEY_0: 'url.https://github.com/org.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://github.com/org.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://github.com/org.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/org',
        GIT_CONFIG_VALUE_1: 'git@github.com:org',
        GIT_CONFIG_VALUE_2: 'Authorization: Basic dG9rZW4xMjM0Og==',
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
        GIT_CONFIG_KEY_0: 'url.https://github.com/org/repo.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://github.com/org/repo.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://github.com/org/repo.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/org/repo',
        GIT_CONFIG_VALUE_1: 'git@github.com:org/repo',
        GIT_CONFIG_VALUE_2: 'Authorization: Basic dG9rZW4xMjM0Og==',
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
        GIT_CONFIG_KEY_0: 'url.https://github.com:89/org/repo.git.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://github.com:89/org/repo.git.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://github.com:89/org/repo.git.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com:89/org/repo.git',
        GIT_CONFIG_VALUE_1: 'ssh://git@github.com:89/org/repo.git',
        GIT_CONFIG_VALUE_2: 'Authorization: Basic dG9rZW4xMjM0Og==',
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
        GIT_CONFIG_KEY_0: 'url.https://git.mycompany.com/scm/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://git.mycompany.com/scm/.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://git.mycompany.com/scm/.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@git.mycompany.com:7999/',
        GIT_CONFIG_VALUE_1: 'ssh://git@git.mycompany.com:7999/',
        GIT_CONFIG_VALUE_2: 'Authorization: Basic dG9rZW4xMjM0Og==',
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

    it('returns environment variables with token if hostRule for api.github.com exists', () => {
      add({
        hostType: 'github',
        matchHost: 'api.github.com',
        token: 'token123',
      });
      expect(getGitEnvironmentVariables({})).toStrictEqual({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://github.com/.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'Authorization: Basic dG9rZW4xMjM6',
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
        GIT_CONFIG_KEY_1: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_3: 'http.https://github.com/.extraHeader',
        GIT_CONFIG_VALUE_0: 'existing-value',
        GIT_CONFIG_VALUE_1: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_2: 'git@github.com:',
        GIT_CONFIG_VALUE_3: 'Authorization: Basic dG9rZW4xMjM6',
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
        GIT_CONFIG_KEY_0: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://github.com/.extraHeader',
        GIT_CONFIG_KEY_3: 'url.https://gitlab.example.com/.insteadOf',
        GIT_CONFIG_KEY_4: 'url.https://gitlab.example.com/.insteadOf',
        GIT_CONFIG_KEY_5: 'http.https://gitlab.example.com/.extraHeader',
        GIT_CONFIG_KEY_6: 'url.https://github.example.com/.insteadOf',
        GIT_CONFIG_KEY_7: 'url.https://github.example.com/.insteadOf',
        GIT_CONFIG_KEY_8: 'http.https://github.example.com/.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'Authorization: Basic dG9rZW4xMjM6',
        GIT_CONFIG_VALUE_3: 'ssh://git@gitlab.example.com/',
        GIT_CONFIG_VALUE_4: 'git@gitlab.example.com:',
        GIT_CONFIG_VALUE_5:
          'Authorization: Basic Z2l0bGFiLWNpLXRva2VuOnRva2VuMjM0',
        GIT_CONFIG_VALUE_6: 'ssh://git@github.example.com/',
        GIT_CONFIG_VALUE_7: 'git@github.example.com:',
        GIT_CONFIG_VALUE_8: 'Authorization: Basic dG9rZW4zNDU6',
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
        GIT_CONFIG_KEY_0: 'url.https://gitlab.example.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://gitlab.example.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://gitlab.example.com/.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@gitlab.example.com/',
        GIT_CONFIG_VALUE_1: 'git@gitlab.example.com:',
        GIT_CONFIG_VALUE_2:
          'Authorization: Basic Z2l0bGFiLWNpLXRva2VuOnRva2VuMTIz',
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
        GIT_CONFIG_KEY_0: 'url.https://gitlab.example.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://gitlab.example.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://gitlab.example.com/.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@gitlab.example.com/',
        GIT_CONFIG_VALUE_1: 'git@gitlab.example.com:',
        GIT_CONFIG_VALUE_2: 'Authorization: Basic dXNlcjEyMzQ6cGFzczEyMzQ=',
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
        GIT_CONFIG_KEY_0: 'url.https://gitlab.example.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://gitlab.example.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://gitlab.example.com/.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@gitlab.example.com/',
        GIT_CONFIG_VALUE_1: 'git@gitlab.example.com:',
        GIT_CONFIG_VALUE_2:
          'Authorization: Basic dXNlciBAIDokIGFiYzphYmMgQCBibHViIHBhc3MwOg==',
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
        GIT_CONFIG_KEY_0: 'url.https://custom.example.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://custom.example.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://custom.example.com/.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@custom.example.com/',
        GIT_CONFIG_VALUE_1: 'git@custom.example.com:',
        GIT_CONFIG_VALUE_2: 'Authorization: Basic dG9rZW4xMjM6',
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
        GIT_CONFIG_KEY_0: 'url.https://git.mycompany.com/scm/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://git.mycompany.com/scm/.insteadOf',
        GIT_CONFIG_KEY_2: 'http.https://git.mycompany.com/scm/.extraHeader',
        GIT_CONFIG_VALUE_0: 'ssh://git@git.mycompany.com:7999/',
        GIT_CONFIG_VALUE_1: 'ssh://git@git.mycompany.com:7999/',
        GIT_CONFIG_VALUE_2: 'Authorization: Basic dG9rZW4xMjM6',
      });
    });
  });
});
