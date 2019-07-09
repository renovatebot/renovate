const { getUntrustedEnv } = require('../../lib/util/env');

describe('getUntrustedEnvVariable', () => {
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
    expect(getUntrustedEnv()).toHaveProperty(...envVars);
  });
  it('returns environment variable only if defined', () => {
    delete process.env.PATH;
    expect(getUntrustedEnv()).not.toHaveProperty('PATH');
  });
  it('returns custom environment variables if passed and defined', () => {
    process.env.LANG = 'LANG';
    expect(getUntrustedEnv(['LANG'])).toHaveProperty(...envVars, 'LANG');
    delete process.env.LANG;
  });
  it('returns environMent variables if in lower case', () => {
    process.env.lang = 'lang';
    expect(getUntrustedEnv(['LANG'])).toHaveProperty(...envVars, 'LANG');
    delete process.env.lang;
  });
});
