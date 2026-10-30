import { GlobalConfig } from '../../../config/global.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { sanitize } from '../../../util/sanitize.ts';
import { getGoEnv } from './env.ts';

describe('modules/datasource/go/env', () => {
  beforeEach(() => {
    hostRules.clear();
    GlobalConfig.set({ goEnvFromHostRules: true });
    vi.stubEnv('GOPROXY', undefined);
    vi.stubEnv('GONOPROXY', undefined);
    vi.stubEnv('GOPRIVATE', undefined);
    vi.stubEnv('GONOSUMDB', undefined);
  });

  afterEach(() => {
    GlobalConfig.reset();
    vi.unstubAllEnvs();
  });

  it('returns the environment as-is when disabled', () => {
    GlobalConfig.reset();
    vi.stubEnv('GOPRIVATE', 'private.example.com');
    hostRules.add({ hostType: 'go-proxy', matchHost: 'bsr.example.com' });

    expect(getGoEnv()).toEqual({ GOPRIVATE: 'private.example.com' });
  });

  it('returns nothing without host rules', () => {
    expect(getGoEnv()).toEqual({});
  });

  it('derives GOPROXY and GONOSUMDB from a go-proxy rule', () => {
    hostRules.add({
      hostType: 'go-proxy',
      matchHost: 'bsr.example.com',
      username: 'user',
      password: 'p@ss',
    });

    expect(getGoEnv()).toEqual({
      GOPROXY: 'https://bsr.example.com,https://proxy.golang.org,direct',
      GONOSUMDB: 'bsr.example.com',
    });
    expect(getGoEnv(true)).toEqual({
      GOPROXY:
        'https://user:p%40ss@bsr.example.com,https://proxy.golang.org,direct',
      GONOSUMDB: 'bsr.example.com',
    });
  });

  it('sanitizes the encoded password', () => {
    hostRules.add({
      hostType: 'go-proxy',
      matchHost: 'bsr.example.com',
      username: 'user',
      password: 'p@ss/+=',
    });

    const { GOPROXY } = getGoEnv(true);

    expect(GOPROXY).toContain('p%40ss%2F%2B%3D');
    expect(sanitize(GOPROXY!)).not.toContain('p%40ss%2F%2B%3D');
  });

  it('keeps the proxy path and host rule order', () => {
    hostRules.add({
      hostType: 'go-proxy',
      matchHost: 'https://artifactory.example.com/api/go/remote/',
      token: 'token',
    });
    hostRules.add({ hostType: 'go-proxy', matchHost: 'bsr.example.com' });
    hostRules.add({ hostType: 'go-proxy', matchHost: '.example.com' });
    hostRules.add({ hostType: 'go-proxy', token: 'token' });

    expect(getGoEnv(true)).toEqual({
      GOPROXY:
        'https://artifactory.example.com/api/go/remote,https://bsr.example.com,https://proxy.golang.org,direct',
      GONOSUMDB: 'artifactory.example.com,bsr.example.com',
    });
  });

  it('derives GONOPROXY and GONOSUMDB from go rules with a path', () => {
    hostRules.add({
      hostType: 'go',
      matchHost: 'https://github.com/super-secret-private',
      token: 'token',
    });
    hostRules.add({
      hostType: 'go',
      matchHost: 'https://gitlab.example.com/group/',
      token: 'token',
    });
    hostRules.add({ hostType: 'go', matchHost: 'github.com', token: 'token' });
    hostRules.add({ hostType: 'go', token: 'token' });

    expect(getGoEnv()).toEqual({
      GONOPROXY: 'github.com/super-secret-private,gitlab.example.com/group',
      GONOSUMDB: 'github.com/super-secret-private,gitlab.example.com/group',
    });
  });

  it('keeps values set in the environment', () => {
    vi.stubEnv('GOPROXY', 'https://proxy.example.com');
    vi.stubEnv('GONOPROXY', '');
    hostRules.add({ hostType: 'go-proxy', matchHost: 'bsr.example.com' });
    hostRules.add({
      hostType: 'go',
      matchHost: 'https://github.com/org',
      token: 'token',
    });

    expect(getGoEnv()).toEqual({
      GOPROXY: 'https://proxy.example.com',
      GONOPROXY: '',
      GONOSUMDB: 'bsr.example.com,github.com/org',
    });
  });

  it('does not derive GONOPROXY or GONOSUMDB when GOPRIVATE is set', () => {
    vi.stubEnv('GOPRIVATE', 'private.example.com');
    hostRules.add({ hostType: 'go-proxy', matchHost: 'bsr.example.com' });
    hostRules.add({
      hostType: 'go',
      matchHost: 'https://github.com/org',
      token: 'token',
    });

    expect(getGoEnv()).toEqual({
      GOPROXY: 'https://bsr.example.com,https://proxy.golang.org,direct',
      GOPRIVATE: 'private.example.com',
    });
  });
});
