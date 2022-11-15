import * as httpMock from '../../../test/http-mock';
import type { PlatformId } from '../../constants';
import { PLATFORM_NOT_FOUND } from '../../constants/error-messages';
import { loadModules } from '../../util/modules';
import type { Platform } from './types';
import * as platform from '.';

jest.unmock('.');

describe('modules/platform/index', () => {
  beforeEach(() => {
    jest.resetModules();
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
      (m) => !['utils', 'git'].includes(m)
    );
    expect(Array.from(platforms.keys())).toEqual(Object.keys(loadedMgr));

    for (const name of platforms.keys()) {
      const value = platforms.get(name);
      expect(validate(value, name)).toBeTrue();
    }
  });

  it('throws if no platform', () => {
    expect(() => platform.platform.initPlatform({})).toThrow(
      PLATFORM_NOT_FOUND
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
});
