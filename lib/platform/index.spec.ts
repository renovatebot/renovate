import { getName } from '../../test/util';
import { PLATFORM_NOT_FOUND } from '../constants/error-messages';
import { PLATFORM_TYPE_BITBUCKET } from '../constants/platforms';
import { loadModules } from '../util/modules';
import type { Platform } from './types';
import * as platform from '.';

jest.unmock('.');

describe(getName(__filename), () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('validates', () => {
    function validate(module: Platform, name: string): boolean {
      // TODO: test required api
      if (!module.initPlatform) {
        throw Error(`Missing api on ${name}`);
      }
      return true;
    }
    const platforms = platform.getPlatforms();

    const loadedMgr = loadModules(
      __dirname,
      null,
      (m) => !['utils', 'git'].includes(m)
    );
    expect(Array.from(platforms.keys())).toEqual(Object.keys(loadedMgr));

    for (const name of platforms.keys()) {
      const value = platforms.get(name);
      expect(validate(value, name)).toBe(true);
    }
  });

  it('throws if no platform', () => {
    expect(() => platform.platform.initPlatform({})).toThrow(
      PLATFORM_NOT_FOUND
    );
  });
  it('throws if wrong platform', async () => {
    const config = { platform: 'wrong', username: 'abc', password: '123' };
    await expect(platform.initPlatform(config)).rejects.toThrow();
  });
  it('initializes', async () => {
    const config = {
      platform: PLATFORM_TYPE_BITBUCKET,
      gitAuthor: 'user@domain.com',
      username: 'abc',
      password: '123',
    };
    expect(await platform.initPlatform(config)).toMatchSnapshot();
  });
  it('initializes no author', async () => {
    const config = {
      platform: PLATFORM_TYPE_BITBUCKET,
      username: 'abc',
      password: '123',
    };
    expect(await platform.initPlatform(config)).toMatchSnapshot();
  });
  it('returns null if empty email given', () => {
    expect(platform.parseGitAuthor(undefined)).toBeNull();
  });
  it('parses bot email', () => {
    expect(
      platform.parseGitAuthor('some[bot]@users.noreply.github.com')
    ).toMatchSnapshot();
  });
  it('parses bot name and email', () => {
    expect(
      platform.parseGitAuthor(
        '"some[bot]" <some[bot]@users.noreply.github.com>'
      )
    ).toMatchSnapshot();
  });
  it('escapes names', () => {
    expect(
      platform.parseGitAuthor('name [what] <name@what.com>').name
    ).toMatchSnapshot();
  });
  it('gives up', () => {
    expect(platform.parseGitAuthor('a.b.c')).toBeNull();
  });
});
