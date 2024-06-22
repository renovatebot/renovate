import { GlobalConfig } from '../../config/global';
import { getChildProcessEnv } from './env';

describe('util/exec/env', () => {
  const envVars = [
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'NO_PROXY',
    'HOME',
    'PATH',
    'LC_ALL',
    'LANG',
    'DOCKER_HOST',
    'SSL_CERT_FILE',
    'URL_REPLACE_1_FROM',
    'URL_REPLACE_1_TO',
    'PROGRAMFILES',
    'PROGRAMFILES(X86)',
    'APPDATA',
    'LOCALAPPDATA',
  ];

  beforeEach(() => {
    envVars.forEach((env) => {
      process.env[env] = env;
    });
  });

  afterEach(() => {
    envVars.forEach((env) => delete process.env[env]);
  });

  it('returns default environment variables', () => {
    expect(getChildProcessEnv()).toMatchObject({
      DOCKER_HOST: 'DOCKER_HOST',
      HOME: 'HOME',
      HTTPS_PROXY: 'HTTPS_PROXY',
      HTTP_PROXY: 'HTTP_PROXY',
      LANG: 'LANG',
      LC_ALL: 'LC_ALL',
      NO_PROXY: 'NO_PROXY',
      PATH: 'PATH',
      SSL_CERT_FILE: 'SSL_CERT_FILE',
      URL_REPLACE_1_FROM: 'URL_REPLACE_1_FROM',
      URL_REPLACE_1_TO: 'URL_REPLACE_1_TO',
      PROGRAMFILES: 'PROGRAMFILES',
      'PROGRAMFILES(X86)': 'PROGRAMFILES(X86)',
      APPDATA: 'APPDATA',
      LOCALAPPDATA: 'LOCALAPPDATA',
    });
  });

  it('returns environment variable only if defined', () => {
    delete process.env.PATH;
    expect(getChildProcessEnv()).not.toHaveProperty('PATH');
  });

  it('returns custom environment variables if passed and defined', () => {
    process.env.FOOBAR = 'FOOBAR';
    expect(getChildProcessEnv(['FOOBAR'])).toMatchObject({
      DOCKER_HOST: 'DOCKER_HOST',
      FOOBAR: 'FOOBAR',
      HOME: 'HOME',
      HTTPS_PROXY: 'HTTPS_PROXY',
      HTTP_PROXY: 'HTTP_PROXY',
      LANG: 'LANG',
      LC_ALL: 'LC_ALL',
      NO_PROXY: 'NO_PROXY',
      PATH: 'PATH',
    });
    delete process.env.LANG;
  });

  describe('getChildProcessEnv when trustlevel set to high', () => {
    it('returns process.env if trustlevel set to high', () => {
      GlobalConfig.set({ exposeAllEnv: true });
      expect(getChildProcessEnv()).toMatchObject(process.env);
    });
  });
});
