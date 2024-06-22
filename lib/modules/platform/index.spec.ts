import * as httpMock from '../../../test/http-mock';
import type { PlatformId } from '../../constants';
import { PLATFORM_NOT_FOUND } from '../../constants/error-messages';
import { loadModules } from '../../util/modules';
import type { Platform } from './types';
import * as platform from '.';

jest.unmock('.');
jest.unmock('./scm');

describe('modules/platform/index', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.RENOVATE_X_GITHUB_HOST_RULES = 'true';
  });

  it('validates', () => {
    function validate(module: Platform | undefined, name: string): boolean {
      // TODO: test required api (#9650)
      if (!module?.initPlatform) {
        throw Error(`Missing api on ${name}`);
      }
      return true;
    }
    const platforms = platform.getPlatforms();

    const loadedMgr = loadModules(
      __dirname,
      undefined,
      (m) => !['utils', 'git'].includes(m),
    );
    expect(Array.from(platforms.keys())).toEqual(Object.keys(loadedMgr));

    for (const name of platforms.keys()) {
      const value = platforms.get(name);
      expect(validate(value, name)).toBeTrue();
    }
  });

  it('throws if no platform', () => {
    expect(() => platform.platform.initPlatform({})).toThrow(
      PLATFORM_NOT_FOUND,
    );
  });

  it('throws if wrong platform', async () => {
    const config = {
      platform: 'wrong' as PlatformId,
      username: 'abc',
      password: '123',
    };
    await expect(platform.initPlatform(config)).rejects.toThrow();
  });

  it('initializes', async () => {
    httpMock
      .scope('https://api.bitbucket.org')
      .get('/2.0/user')
      .basicAuth({ user: 'abc', pass: '123' })
      .reply(200, { uuid: 123 });
    const config = {
      platform: 'bitbucket' as PlatformId,
      gitAuthor: 'user@domain.com',
      username: 'abc',
      password: '123',
    };
    expect(await platform.initPlatform(config)).toEqual({
      endpoint: 'https://api.bitbucket.org/',
      gitAuthor: 'user@domain.com',
      hostRules: [
        {
          hostType: 'bitbucket',
          matchHost: 'api.bitbucket.org',
          password: '123',
          username: 'abc',
        },
      ],
      platform: 'bitbucket',
    });
  });

  it('merges config hostRules with platform hostRules', async () => {
    httpMock.scope('https://ghe.renovatebot.com').head('/').reply(200);

    const config = {
      platform: 'github' as PlatformId,
      endpoint: 'https://ghe.renovatebot.com',
      gitAuthor: 'user@domain.com',
      username: 'abc',
      token: '123',
      hostRules: [
        {
          hostType: 'github',
          matchHost: 'github.com',
          token: '456',
          username: 'def',
        },
      ],
    };

    expect(await platform.initPlatform(config)).toEqual({
      endpoint: 'https://ghe.renovatebot.com/',
      gitAuthor: 'user@domain.com',
      hostRules: [
        {
          hostType: 'github',
          matchHost: 'github.com',
          token: '456',
          username: 'def',
        },
        {
          hostType: 'github',
          matchHost: 'ghe.renovatebot.com',
          token: '123',
          username: 'abc',
        },
      ],
      platform: 'github',
      renovateUsername: 'abc',
    });
  });

  describe('when platform endpoint is https://api.github.com/', () => {
    it('merges config hostRules with platform hostRules', async () => {
      const config = {
        platform: 'github' as PlatformId,
        endpoint: 'https://api.github.com',
        gitAuthor: 'user@domain.com',
        username: 'abc',
        token: '123',
        hostRules: [
          {
            hostType: 'github',
            matchHost: 'github.com',
            token: '456',
            username: 'def',
          },
        ],
      };

      expect(await platform.initPlatform(config)).toEqual({
        endpoint: 'https://api.github.com/',
        gitAuthor: 'user@domain.com',
        hostRules: [
          {
            hostType: 'docker',
            matchHost: 'ghcr.io',
            password: '123',
            username: 'USERNAME',
          },
          {
            hostType: 'npm',
            matchHost: 'npm.pkg.github.com',
            token: '123',
          },
          {
            hostType: 'rubygems',
            matchHost: 'rubygems.pkg.github.com',
            password: '123',
            username: 'abc',
          },
          {
            hostType: 'maven',
            matchHost: 'maven.pkg.github.com',
            password: '123',
            username: 'abc',
          },
          {
            hostType: 'nuget',
            matchHost: 'nuget.pkg.github.com',
            password: '123',
            username: 'abc',
          },
          {
            hostType: 'github',
            matchHost: 'github.com',
            token: '456',
            username: 'def',
          },
          {
            hostType: 'github',
            matchHost: 'api.github.com',
            token: '123',
            username: 'abc',
          },
        ],
        platform: 'github',
        renovateUsername: 'abc',
      });
    });

    it('merges platform hostRules with additionalHostRules', async () => {
      const config = {
        platform: 'github' as PlatformId,
        endpoint: 'https://api.github.com',
        gitAuthor: 'user@domain.com',
        username: 'abc',
        token: '123',
      };

      expect(await platform.initPlatform(config)).toEqual({
        endpoint: 'https://api.github.com/',
        gitAuthor: 'user@domain.com',
        hostRules: [
          {
            hostType: 'docker',
            matchHost: 'ghcr.io',
            password: '123',
            username: 'USERNAME',
          },
          {
            hostType: 'npm',
            matchHost: 'npm.pkg.github.com',
            token: '123',
          },
          {
            hostType: 'rubygems',
            matchHost: 'rubygems.pkg.github.com',
            password: '123',
            username: 'abc',
          },
          {
            hostType: 'maven',
            matchHost: 'maven.pkg.github.com',
            password: '123',
            username: 'abc',
          },
          {
            hostType: 'nuget',
            matchHost: 'nuget.pkg.github.com',
            password: '123',
            username: 'abc',
          },
          {
            hostType: 'github',
            matchHost: 'api.github.com',
            token: '123',
            username: 'abc',
          },
        ],
        platform: 'github',
        renovateUsername: 'abc',
      });
    });
  });
});
