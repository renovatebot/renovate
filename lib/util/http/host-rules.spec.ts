import { PlatformId } from '../../constants';
import { bootstrap } from '../../proxy';
import * as hostRules from '../host-rules';
import { dnsCache } from './dns';
import { applyHostRules } from './host-rules';

const url = 'https://github.com';

jest.mock('global-agent');

describe('util/http/host-rules', () => {
  const options = {
    hostType: PlatformId.Github,
  };

  beforeEach(() => {
    // reset module
    jest.resetAllMocks();

    delete process.env.HTTP_PROXY;

    // clean up hostRules
    hostRules.clear();
    hostRules.add({
      hostType: PlatformId.Github,
      token: 'token',
    });
    hostRules.add({
      hostType: PlatformId.Gitea,
      password: 'password',
    });

    hostRules.add({
      hostType: 'npm',
      authType: 'Basic',
      token: 'XXX',
      timeout: 5000,
    });

    hostRules.add({
      hostType: PlatformId.Gitlab,
      token: 'abc',
    });

    hostRules.add({
      hostType: PlatformId.Bitbucket,
      token: 'cdef',
    });
  });

  afterEach(() => {
    delete process.env.HTTP_PROXY;
  });

  it('adds token', () => {
    expect(applyHostRules(url, { ...options })).toMatchInlineSnapshot(`
      {
        "context": {
          "authType": undefined,
        },
        "hostType": "github",
        "token": "token",
      }
    `);
  });

  it('adds auth', () => {
    expect(applyHostRules(url, { hostType: PlatformId.Gitea }))
      .toMatchInlineSnapshot(`
      {
        "hostType": "gitea",
        "password": "password",
        "username": undefined,
      }
    `);
  });

  it('adds custom auth', () => {
    expect(applyHostRules(url, { hostType: 'npm' })).toMatchInlineSnapshot(`
      {
        "context": {
          "authType": "Basic",
        },
        "hostType": "npm",
        "timeout": 5000,
        "token": "XXX",
      }
    `);
  });

  it('skips', () => {
    expect(applyHostRules(url, { ...options, token: 'xxx' }))
      .toMatchInlineSnapshot(`
      {
        "hostType": "github",
        "token": "xxx",
      }
    `);
  });

  it('uses http2', () => {
    hostRules.add({ enableHttp2: true });
    expect(applyHostRules(url, { ...options, token: 'xxx' }))
      .toMatchInlineSnapshot(`
      {
        "hostType": "github",
        "http2": true,
        "token": "xxx",
      }
    `);
  });

  it('uses dnsCache', () => {
    hostRules.add({ dnsCache: true });
    expect(applyHostRules(url, { ...options, token: 'xxx' })).toMatchObject({
      hostType: 'github',
      dnsCache: dnsCache,
      token: 'xxx',
    });
  });

  it('disables http2', () => {
    process.env.HTTP_PROXY = 'http://proxy';
    bootstrap();
    hostRules.add({ enableHttp2: true });
    expect(applyHostRules(url, { ...options, token: 'xxx' }))
      .toMatchInlineSnapshot(`
      {
        "hostType": "github",
        "token": "xxx",
      }
    `);
  });

  it('noAuth', () => {
    expect(applyHostRules(url, { ...options, noAuth: true }))
      .toMatchInlineSnapshot(`
      {
        "hostType": "github",
        "noAuth": true,
      }
    `);
  });

  it('no fallback to github', () => {
    hostRules.add({
      hostType: 'github-tags',
      username: 'some2',
      password: 'xxx2',
    });
    hostRules.add({
      hostType: 'github-changelog',
      token: 'changelogtoken',
    });
    hostRules.add({
      hostType: 'pod',
      token: 'pod-token',
    });
    hostRules.add({
      hostType: 'github-releases',
      username: 'some',
      password: 'xxx',
    });
    expect(
      applyHostRules(url, { ...options, hostType: 'github-releases' })
    ).toEqual({
      hostType: 'github-releases',
      username: 'some',
      password: 'xxx',
    });
    expect(
      applyHostRules(url, { ...options, hostType: 'github-tags' })
    ).toEqual({
      hostType: 'github-tags',
      username: 'some2',
      password: 'xxx2',
    });
    expect(applyHostRules(url, { ...options, hostType: 'pod' })).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'pod',
      token: 'pod-token',
    });
    expect(
      applyHostRules(url, { ...options, hostType: 'github-changelog' })
    ).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'github-changelog',
      token: 'changelogtoken',
    });
  });

  it('fallback to github', () => {
    expect(
      applyHostRules(url, { ...options, hostType: 'github-tags' })
    ).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'github-tags',
      token: 'token',
    });
    expect(
      applyHostRules(url, { ...options, hostType: 'github-changelog' })
    ).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'github-changelog',
      token: 'token',
    });
    expect(applyHostRules(url, { ...options, hostType: 'pod' })).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'pod',
      token: 'token',
    });
  });

  it('no fallback to gitlab', () => {
    hostRules.add({
      hostType: 'gitlab-packages',
      token: 'package-token',
    });
    hostRules.add({
      hostType: 'gitlab-releases',
      token: 'release-token',
    });
    hostRules.add({
      hostType: 'gitlab-tags',
      token: 'tags-token',
    });
    expect(
      applyHostRules(url, { ...options, hostType: 'gitlab-tags' })
    ).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'gitlab-tags',
      token: 'tags-token',
    });
    expect(
      applyHostRules(url, { ...options, hostType: 'gitlab-releases' })
    ).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'gitlab-releases',
      token: 'release-token',
    });
    expect(
      applyHostRules(url, { ...options, hostType: 'gitlab-packages' })
    ).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'gitlab-packages',
      token: 'package-token',
    });
  });

  it('fallback to gitlab', () => {
    expect(
      applyHostRules(url, { ...options, hostType: 'gitlab-tags' })
    ).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'gitlab-tags',
      token: 'abc',
    });
    expect(
      applyHostRules(url, { ...options, hostType: 'gitlab-releases' })
    ).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'gitlab-releases',
      token: 'abc',
    });
    expect(
      applyHostRules(url, { ...options, hostType: 'gitlab-packages' })
    ).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'gitlab-packages',
      token: 'abc',
    });
    expect(
      applyHostRules(url, { ...options, hostType: 'gitlab-changelog' })
    ).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'gitlab-changelog',
      token: 'abc',
    });
  });

  it('no fallback to bitbucket', () => {
    hostRules.add({
      hostType: 'bitbucket-tags',
      username: 'some',
      password: 'xxx',
    });
    expect(
      applyHostRules(url, { ...options, hostType: 'bitbucket-tags' })
    ).toEqual({
      hostType: 'bitbucket-tags',
      username: 'some',
      password: 'xxx',
    });
  });

  it('fallback to bitbucket', () => {
    expect(
      applyHostRules(url, { ...options, hostType: 'bitbucket-tags' })
    ).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'bitbucket-tags',
      token: 'cdef',
    });
  });
});
