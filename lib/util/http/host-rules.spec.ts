import { GlobalConfig } from '../../config/global';
import { bootstrap } from '../../proxy';
import type { HostRule } from '../../types';
import * as hostRules from '../host-rules';
import { applyHostRule, findMatchingRule } from './host-rules';
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
    const opts = { ...options };
    const hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      token: 'token',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'github',
      token: 'token',
    });
  });

  it('adds auth', () => {
    const opts = { hostType: 'gitea' };
    const hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      password: 'password',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      hostType: 'gitea',
      password: 'password',
      username: undefined,
    });
  });

  it('adds custom auth', () => {
    const opts = { hostType: 'npm' };
    const hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      authType: 'Basic',
      timeout: 5000,
      token: 'XXX',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      context: {
        authType: 'Basic',
      },
      hostType: 'npm',
      timeout: 5000,
      token: 'XXX',
    });
  });

  it('skips', () => {
    const opts = { ...options, token: 'xxx' };
    const hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      token: 'token',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      hostType: 'github',
      token: 'xxx',
    });
  });

  it('uses http2', () => {
    hostRules.add({ enableHttp2: true });

    const opts = { ...options, token: 'xxx' };
    const hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      enableHttp2: true,
      token: 'token',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      hostType: 'github',
      http2: true,
      token: 'xxx',
    });
  });

  it('uses http keep-alive', () => {
    hostRules.add({ keepAlive: true });

    const opts = { ...options, token: 'xxx' };
    const hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      keepAlive: true,
      token: 'token',
    });
    expect(applyHostRule(url, opts, hostRule).agent).toBeDefined();
  });

  it('disables http2', () => {
    process.env.HTTP_PROXY = 'http://proxy';
    bootstrap();
    hostRules.add({ enableHttp2: true });

    const opts = { ...options, token: 'xxx' };
    const hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      enableHttp2: true,
      token: 'token',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      hostType: 'github',
      token: 'xxx',
    });
  });

  it('noAuth', () => {
    const opts = { ...options, noAuth: true };
    const hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      token: 'token',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      hostType: 'github',
      noAuth: true,
    });
  });

  it('certificateAuthority', () => {
    hostRules.add({
      hostType: 'maven',
      matchHost: 'https://custom.datasource.ca',
      httpsCertificateAuthority: 'ca-cert',
    });

    const url = 'https://custom.datasource.ca/data/path';
    const opts = { ...options, hostType: 'maven' };
    const hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      httpsCertificateAuthority: 'ca-cert',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      hostType: 'maven',
      https: {
        certificateAuthority: 'ca-cert',
      },
    });
  });

  it('privateKey', () => {
    hostRules.add({
      hostType: 'maven',
      matchHost: 'https://custom.datasource.key',
      httpsPrivateKey: 'key',
    });

    const url = 'https://custom.datasource.key/data/path';
    const opts = { ...options, hostType: 'maven' };
    const hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      httpsPrivateKey: 'key',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      hostType: 'maven',
      https: {
        key: 'key',
      },
    });
  });

  it('certificate', () => {
    hostRules.add({
      hostType: 'maven',
      matchHost: 'https://custom.datasource.cert',
      httpsCertificate: 'cert',
    });

    const url = 'https://custom.datasource.cert/data/path';
    const opts = { ...options, hostType: 'maven' };
    const hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      httpsCertificate: 'cert',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      hostType: 'maven',
      https: {
        certificate: 'cert',
      },
    });
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

    let opts: GotOptions;
    let hostRule: HostRule;

    opts = { ...options, hostType: 'github-releases' };
    hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      password: 'xxx',
      username: 'some',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      hostType: 'github-releases',
      username: 'some',
      password: 'xxx',
    });

    opts = { ...options, hostType: 'github-tags' };
    hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      password: 'xxx2',
      username: 'some2',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      hostType: 'github-tags',
      username: 'some2',
      password: 'xxx2',
    });

    opts = { ...options, hostType: 'pod' };
    hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      token: 'pod-token',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'pod',
      token: 'pod-token',
    });

    opts = { ...options, hostType: 'github-changelog' };
    hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      token: 'changelogtoken',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'github-changelog',
      token: 'changelogtoken',
    });
  });

  it('fallback to github', () => {
    let opts: GotOptions;
    let hostRule: HostRule;

    opts = { ...options, hostType: 'github-tags' };
    hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      token: 'token',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'github-tags',
      token: 'token',
    });

    opts = { ...options, hostType: 'github-changelog' };
    hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      token: 'token',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'github-changelog',
      token: 'token',
    });

    opts = { ...options, hostType: 'pod' };
    hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      token: 'token',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
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

    let opts: GotOptions;
    let hostRule: HostRule;

    opts = { ...options, hostType: 'gitlab-tags' };
    hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      token: 'tags-token',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'gitlab-tags',
      token: 'tags-token',
    });

    opts = { ...options, hostType: 'gitlab-releases' };
    hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      token: 'release-token',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'gitlab-releases',
      token: 'release-token',
    });

    opts = { ...options, hostType: 'gitlab-packages' };
    hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      token: 'package-token',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'gitlab-packages',
      token: 'package-token',
    });
  });

  it('fallback to gitlab', () => {
    let opts: GotOptions;
    let hostRule: HostRule;

    opts = { ...options, hostType: 'gitlab-tags' };
    hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      token: 'abc',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'gitlab-tags',
      token: 'abc',
    });

    opts = { ...options, hostType: 'gitlab-releases' };
    hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      token: 'abc',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'gitlab-releases',
      token: 'abc',
    });

    opts = { ...options, hostType: 'gitlab-packages' };
    hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      token: 'abc',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'gitlab-packages',
      token: 'abc',
    });

    opts = { ...options, hostType: 'gitlab-changelog' };
    hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      token: 'abc',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
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
    const opts = { ...options, hostType: 'bitbucket-tags' };
    const hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      password: 'xxx',
      username: 'some',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      hostType: 'bitbucket-tags',
      username: 'some',
      password: 'xxx',
    });
  });

  it('fallback to bitbucket', () => {
    const opts = { ...options, hostType: 'bitbucket-tags' };
    const hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      token: 'cdef',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
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

    const opts = { ...options, hostType: 'gitea-tags' };
    const hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      token: 'abc',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      context: {
        authType: undefined,
      },
      hostType: 'gitea-tags',
      token: 'abc',
    });
  });

  it('fallback to gitea', () => {
    const opts = { ...options, hostType: 'gitea-tags' };
    const hostRule = findMatchingRule(url, opts);
    expect(hostRule).toEqual({
      password: 'password',
    });
    expect(applyHostRule(url, opts, hostRule)).toEqual({
      hostType: 'gitea-tags',
      password: 'password',
      username: undefined,
    });
  });

  it('should remove forbidden headers from request', () => {
    GlobalConfig.set({ allowedHeaders: ['X-*'] });
    const hostRule = {
      matchHost: 'https://domain.com/all-versions',
      headers: {
        'X-Auth-Token': 'token',
        unallowedHeader: 'token',
      },
    };

    expect(applyHostRule(url, {}, hostRule)).toEqual({
      headers: {
        'X-Auth-Token': 'token',
      },
    });
  });
});
