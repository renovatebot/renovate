import { getChildProcessEnv } from '../../lib/util/exec/env';

describe('getChildProcess environment when trustlevel set to low', () => {
  const envVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'HOME', 'PATH'];
  beforeEach(() => {
    envVars.forEach(env => {
      process.env[env] = env;
    });
  });
  afterEach(() => {
    envVars.forEach(env => delete process.env[env]);
  });
  it('returns default environment variables', () => {
    expect(getChildProcessEnv()).toMatchInlineSnapshot(`
      Object {
        "HOME": "HOME",
        "HTTPS_PROXY": "HTTPS_PROXY",
        "HTTP_PROXY": "HTTP_PROXY",
        "NO_PROXY": "NO_PROXY",
        "PATH": "PATH",
      }
    `);
  });
  it('returns environment variable only if defined', () => {
    delete process.env.PATH;
    expect(getChildProcessEnv()).not.toHaveProperty('PATH');
  });
  it('returns custom environment variables if passed and defined', () => {
    process.env.LANG = 'LANG';
    expect(getChildProcessEnv(['LANG'])).toMatchInlineSnapshot(`
      Object {
        "HOME": "HOME",
        "HTTPS_PROXY": "HTTPS_PROXY",
        "HTTP_PROXY": "HTTP_PROXY",
        "LANG": "LANG",
        "NO_PROXY": "NO_PROXY",
        "PATH": "PATH",
      }
    `);
    delete process.env.LANG;
  });

  describe('getChildProcessEnv when trustlevel set to high', () => {
    it('returns process.env if trustlevel set to high', () => {
      global.trustLevel = 'high';
      expect(getChildProcessEnv()).toMatchObject(process.env);
      delete global.trustLevel;
    });
  });
});
