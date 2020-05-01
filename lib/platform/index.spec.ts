import { PLATFORM_NOT_FOUND } from '../constants/error-messages';
import { PLATFORM_TYPE_BITBUCKET } from '../constants/platforms';
import { loadModules } from '../util/modules';
import * as azure from './azure';
import * as bitbucket from './bitbucket';
import * as bitbucketServer from './bitbucket-server';
import * as gitea from './gitea';
import * as github from './github';
import * as gitlab from './gitlab';

import * as platform from '.';
import { Platform } from '.';

jest.unmock('.');

describe('platform', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('validates', () => {
    function validate(module: Platform, name: string): boolean {
      // TODO: test required api
      if (!module.initPlatform) {
        fail(`Missing api on ${name}`);
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
  it('has a list of supported methods for github', () => {
    const githubMethods = Object.keys(github).sort();
    expect(githubMethods).toMatchSnapshot();
  });

  it('has a list of supported methods for gitlab', () => {
    const gitlabMethods = Object.keys(gitlab).sort();
    expect(gitlabMethods).toMatchSnapshot();
  });

  it('has a list of supported methods for gitea', () => {
    const giteaMethods = Object.keys(gitea).sort();
    expect(giteaMethods).toMatchSnapshot();
  });

  it('has a list of supported methods for azure', () => {
    const azureMethods = Object.keys(azure).sort();
    expect(azureMethods).toMatchSnapshot();
  });

  it('has same API for github and gitlab', () => {
    const githubMethods = Object.keys(github).sort();
    const gitlabMethods = Object.keys(gitlab).sort();
    expect(githubMethods).toMatchObject(gitlabMethods);
  });

  it('has same API for github and gitea', () => {
    const githubMethods = Object.keys(github).sort();
    const giteaMethods = Object.keys(gitea).sort();
    expect(githubMethods).toMatchObject(giteaMethods);
  });

  it('has same API for github and azure', () => {
    const githubMethods = Object.keys(github).sort();
    const azureMethods = Object.keys(azure).sort();
    expect(githubMethods).toMatchObject(azureMethods);
  });

  it('has same API for github and Bitbucket', () => {
    const githubMethods = Object.keys(github).sort();
    const bitbucketMethods = Object.keys(bitbucket).sort();
    expect(bitbucketMethods).toMatchObject(githubMethods);
  });

  it('has same API for github and Bitbucket Server', () => {
    const githubMethods = Object.keys(github).sort();
    const bitbucketMethods = Object.keys(bitbucketServer).sort();
    expect(bitbucketMethods).toMatchObject(githubMethods);
  });
});
