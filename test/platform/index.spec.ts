import * as github from '../../lib/platform/github';
import * as gitlab from '../../lib/platform/gitlab';
import * as azure from '../../lib/platform/azure';
import * as bitbucket from '../../lib/platform/bitbucket';
import * as bitbucketServer from '../../lib/platform/bitbucket-server';
import { PLATFORM_NOT_FOUND } from '../../lib/constants/error-messages';

import * as platform from '../../lib/platform';

jest.unmock('../../lib/platform');

describe('platform', () => {
  beforeEach(() => {
    jest.resetModules();
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
      platform: 'bitbucket',
      gitAuthor: 'user@domain.com',
      username: 'abc',
      password: '123',
    };
    expect(await platform.initPlatform(config)).toMatchSnapshot();
  });
  it('initializes no author', async () => {
    const config = {
      platform: 'bitbucket',
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

  it('has a list of supported methods for azure', () => {
    const azureMethods = Object.keys(azure).sort();
    expect(azureMethods).toMatchSnapshot();
  });

  it('has same API for github and gitlab', () => {
    const githubMethods = Object.keys(github).sort();
    const gitlabMethods = Object.keys(gitlab).sort();
    expect(githubMethods).toMatchObject(gitlabMethods);
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
