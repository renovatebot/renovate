import { GlobalConfig } from '../../config/global.ts';
import {
  basicEnvVars,
  getChildProcessEnv,
  hardcodedProcessEnv,
} from './env.ts';

describe('util/exec/env', () => {
  const envVars = [
    'CI',
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'NO_PROXY',
    'HOME',
    'PATH',
    'LC_ALL',
    'LANG',
    'DOCKER_HOST',
    'GIT_SSL_CAPATH',
    'GIT_SSL_CAINFO',
    'SSL_CERT_FILE',
    'URL_REPLACE_1_FROM',
    'URL_REPLACE_1_TO',
    'PROGRAMFILES',
    'PROGRAMFILES(X86)',
    'APPDATA',
    'LOCALAPPDATA',
  ];

  beforeEach(() => {
    // Clear any ambient value first, so that a forwarded variable which is set
    // in the surrounding environment cannot leak into the assertions below.
    basicEnvVars.forEach((env) => {
      vi.stubEnv(env, undefined);
    });
    envVars.forEach((env) => {
      vi.stubEnv(env, env);
    });
  });

  it('returns default environment variables', () => {
    expect(getChildProcessEnv()).toEqual({
      DOCKER_HOST: 'DOCKER_HOST',
      GIT_SSL_CAPATH: 'GIT_SSL_CAPATH',
      GIT_SSL_CAINFO: 'GIT_SSL_CAINFO',
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

      CI: 'true',
    });
  });

  it('always sets static values for CI', () => {
    expect(getChildProcessEnv()).toMatchObject({
      CI: 'true',
    });
  });

  it('static environment variables override the process environment variables', () => {
    vi.stubEnv('CI', 'false');

    expect(getChildProcessEnv()).toMatchObject({
      CI: 'true',
    });

    vi.stubEnv('CI', undefined);
  });

  it('returns environment variable only if defined', () => {
    vi.stubEnv('PATH', undefined);
    expect(getChildProcessEnv()).not.toHaveProperty('PATH');
  });

  it('returns custom environment variables if passed and defined', () => {
    vi.stubEnv('FOOBAR', 'FOOBAR');
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
    vi.stubEnv('LANG', undefined);
  });

  describe('getChildProcessEnv when exposeAllEnv=true', () => {
    it('returns process.env if exposeAllEnv=true', () => {
      GlobalConfig.set({ exposeAllEnv: true });
      expect(getChildProcessEnv()).toMatchObject({
        ...process.env,
        CI: 'true',
      });
    });

    it('static environment variables override the process environment variables', () => {
      GlobalConfig.set({ exposeAllEnv: true });
      vi.stubEnv('CI', 'false');

      expect(getChildProcessEnv()).toMatchObject({
        CI: 'true',
      });
    });
  });

  describe('basicEnvVars and hardcodedProcessEnv should not have any overlap', () => {
    describe('basicEnvVars does not include any environment variables in hardcodedProcessEnv', () => {
      for (const env of Object.keys(hardcodedProcessEnv)) {
        it(`${env} is not in basicEnvVars`, () => {
          expect(basicEnvVars).not.toContain(env);
        });
      }
    });

    describe('hardcodedProcessEnv does not include any environment variables in basicEnvVars', () => {
      for (const env of basicEnvVars) {
        it(`${env} is not in hardcodedProcessEnv`, () => {
          expect(hardcodedProcessEnv).not.toContainKey(env);
        });
      }
    });
  });

  describe('basicEnvVars and hardcodedProcessEnv should not have any overlap', () => {
    describe('basicEnvVars does not include any environment variables in hardcodedProcessEnv', () => {
      for (const env of Object.keys(hardcodedProcessEnv)) {
        it(`${env} is not in basicEnvVars`, () => {
          expect(basicEnvVars).not.toContain(env);
        });
      }
    });

    describe('hardcodedProcessEnv does not include any environment variables in basicEnvVars', () => {
      for (const env of basicEnvVars) {
        it(`${env} is not in hardcodedProcessEnv`, () => {
          expect(hardcodedProcessEnv).not.toContainKey(env);
        });
      }
    });
  });
});
