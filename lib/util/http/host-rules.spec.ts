import { bootstrap } from '../../proxy';
import * as hostRules from '../host-rules';
import { dnsLookup } from './dns';
import { applyHostRules } from './host-rules';
import type { GotOptions } from './types';

const url = 'https://github.com';

jest.mock('global-agent');

describe('util/http/host-rules', () => {
  const options: GotOptions = {
    hostType: 'github',
  };

  beforeEach(() => {
    delete process.env.HTTP_PROXY;

    // clean up hostRules
    hostRules.clear();
    hostRules.add({
      hostType: 'github',
      token: 'token',
    });
    hostRules.add({
      hostType: 'gitea',
      password: 'password',
    });

    hostRules.add({
      hostType: 'npm',
      authType: 'Basic',
      token: 'XXX',
      timeout: 5000,
    });

    hostRules.add({
      hostType: 'gitlab',
      token: 'abc',
    });

    hostRules.add({
      hostType: 'bitbucket',
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
    expect(applyHostRules(url, { hostType: 'gitea' })).toMatchInlineSnapshot(`
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
      lookup: dnsLookup,
      token: 'xxx',
    });
  });

  it('uses http keepalives', () => {
    hostRules.add({ keepalive: true });
    expect(
      applyHostRules(url, { ...options, token: 'xxx' }).agent,
    ).toBeDefined();
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

  it('certificateAuthority', () => {
    hostRules.add({
      hostType: 'maven',
      matchHost: 'https://custom.datasource.ca',
      httpsCertificateAuthority: 'ca-cert',
    });

    expect(
      applyHostRules('https://custom.datasource.ca/data/path', {
        ...options,
        hostType: 'maven',
      }),
    ).toMatchInlineSnapshot(`
      {
        "hostType": "maven",
        "https": {
          "certificateAuthority": "ca-cert",
        },
      }
    `);
  });

  it('privateKey', () => {
    hostRules.add({
      hostType: 'maven',
      matchHost: 'https://custom.datasource.key',
      httpsPrivateKey: 'key',
    });
    expect(
      applyHostRules('https://custom.datasource.key/data/path', {
        ...options,
        hostType: 'maven',
      }),
    ).toMatchInlineSnapshot(`
      {
        "hostType": "maven",
        "https": {
          "key": "key",
        },
      }
    `);
  });

  it('certificate', () => {
    hostRules.add({
      hostType: 'maven',
      matchHost: 'https://custom.datasource.cert',
      httpsCertificate: 'cert',
    });

    expect(
      applyHostRules('https://custom.datasource.cert/data/path', {
        ...options,
        hostType: 'maven',
      }),
    ).toMatchInlineSnapshot(`
      {
        "hostType": "maven",
        "https": {
          "certificate": "cert",
        },
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
      applyHostRules(url, { ...options, hostType: 'github-releases' }),
    ).toEqual({
      hostType: 'github-releases',
      username: 'some',
      password: 'xxx',
    });
    expect(
      applyHostRules(url, { ...options, hostType: 'github-tags' }),
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
      applyHostRules(url, { ...options, hostType: 'github-changelog' }),
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
      applyHostRules(url, { ...options, hostType: 'github-tags' }),
    ).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'github-tags',
      token: 'token',
    });
    expect(
      applyHostRules(url, { ...options, hostType: 'github-changelog' }),
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
      applyHostRules(url, { ...options, hostType: 'gitlab-tags' }),
    ).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'gitlab-tags',
      token: 'tags-token',
    });
    expect(
      applyHostRules(url, { ...options, hostType: 'gitlab-releases' }),
    ).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'gitlab-releases',
      token: 'release-token',
    });
    expect(
      applyHostRules(url, { ...options, hostType: 'gitlab-packages' }),
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
      applyHostRules(url, { ...options, hostType: 'gitlab-tags' }),
    ).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'gitlab-tags',
      token: 'abc',
    });
    expect(
      applyHostRules(url, { ...options, hostType: 'gitlab-releases' }),
    ).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'gitlab-releases',
      token: 'abc',
    });
    expect(
      applyHostRules(url, { ...options, hostType: 'gitlab-packages' }),
    ).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'gitlab-packages',
      token: 'abc',
    });
    expect(
      applyHostRules(url, { ...options, hostType: 'gitlab-changelog' }),
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
      applyHostRules(url, { ...options, hostType: 'bitbucket-tags' }),
    ).toEqual({
      hostType: 'bitbucket-tags',
      username: 'some',
      password: 'xxx',
    });
  });

  it('fallback to bitbucket', () => {
    expect(
      applyHostRules(url, { ...options, hostType: 'bitbucket-tags' }),
    ).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'bitbucket-tags',
      token: 'cdef',
    });
  });

  it('no fallback to gitea', () => {
    hostRules.add({
      hostType: 'gitea-tags',
      token: 'abc',
    });
    expect(applyHostRules(url, { ...options, hostType: 'gitea-tags' })).toEqual(
      {
        context: {
          authType: undefined,
        },
        hostType: 'gitea-tags',
        token: 'abc',
      },
    );
  });

  it('fallback to gitea', () => {
    expect(applyHostRules(url, { ...options, hostType: 'gitea-tags' })).toEqual(
      {
        hostType: 'gitea-tags',
        password: 'password',
        username: undefined,
      },
    );
  });
});
