import { getGitAuthenticatedEnvironmentVariables } from './auth';

describe('util/git/auth', () => {
  afterEach(() => {
    delete process.env.GIT_CONFIG_COUNT;
  });
  describe('getGitAuthenticatedEnvironmentVariables()', () => {
    it('returns url with token', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables(
          'https://github.com/',
          'token1234'
        )
      ).toStrictEqual({
        GIT_CONFIG_KEY_0: 'url.https://token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'https://github.com/',
        GIT_CONFIG_COUNT: '1',
      });
    });

    it('returns correct url if token already contains GitHub App username', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables(
          'https://github.com/',
          'x-access-token:token1234'
        )
      ).toStrictEqual({
        GIT_CONFIG_KEY_0:
          'url.https://x-access-token:token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'https://github.com/',
        GIT_CONFIG_COUNT: '1',
      });
    });

    it('returns url with token and already existing GIT_CONFIG_COUNT from parameter', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables(
          'https://github.com/',
          'token1234',
          { GIT_CONFIG_COUNT: '1' }
        )
      ).toStrictEqual({
        GIT_CONFIG_KEY_1: 'url.https://token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_1: 'https://github.com/',
        GIT_CONFIG_COUNT: '2',
      });
    });

    it('returns url with token and already existing GIT_CONFIG_COUNT from parameter over environment', () => {
      process.env.GIT_CONFIG_COUNT = '54';
      expect(
        getGitAuthenticatedEnvironmentVariables(
          'https://github.com/',
          'token1234',
          { GIT_CONFIG_COUNT: '1' }
        )
      ).toStrictEqual({
        GIT_CONFIG_KEY_1: 'url.https://token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_1: 'https://github.com/',
        GIT_CONFIG_COUNT: '2',
      });
    });

    it('returns url with token and already existing GIT_CONFIG_COUNT from environment', () => {
      process.env.GIT_CONFIG_COUNT = '1';
      expect(
        getGitAuthenticatedEnvironmentVariables(
          'https://github.com/',
          'token1234'
        )
      ).toStrictEqual({
        GIT_CONFIG_KEY_1: 'url.https://token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_1: 'https://github.com/',
        GIT_CONFIG_COUNT: '2',
      });
    });

    it('returns url with token and passthrough existing variables', () => {
      expect(
        getGitAuthenticatedEnvironmentVariables(
          'https://github.com/',
          'token1234',
          { RANDOM_VARIABLE: 'random' }
        )
      ).toStrictEqual({
        GIT_CONFIG_KEY_0: 'url.https://token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'https://github.com/',
        GIT_CONFIG_COUNT: '1',
        RANDOM_VARIABLE: 'random',
      });
    });

    it('return url with token with invalid GIT_CONFIG_COUNT from environment', () => {
      process.env.GIT_CONFIG_COUNT = 'notvalid';
      expect(
        getGitAuthenticatedEnvironmentVariables(
          'https://github.com/',
          'token1234'
        )
      ).toStrictEqual({
        GIT_CONFIG_KEY_0: 'url.https://token1234@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'https://github.com/',
        GIT_CONFIG_COUNT: '1',
      });
    });
  });
});
