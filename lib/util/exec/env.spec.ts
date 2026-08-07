import { GlobalConfig } from '../../config/global.ts';
import * as instrumentationUtils from '../../instrumentation/utils.ts';
import { getChildProcessEnv } from './env.ts';

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

  describe('getChildProcessEnv when exposeAllEnv=true', () => {
    afterEach(() => {
      GlobalConfig.reset();
    });

    it('returns process.env if exposeAllEnv=true', () => {
      GlobalConfig.set({ exposeAllEnv: true });
      expect(getChildProcessEnv()).toMatchObject(process.env);
    });
  });

  describe('getChildProcessEnv when tracing is enabled', () => {
    beforeEach(() => {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
      process.env.OTEL_SERVICE_NAME = 'renovate-test';
    });

    afterEach(() => {
      delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
      delete process.env.OTEL_SERVICE_NAME;
    });

    it('forwards OTEL_* environment variables to the child process', () => {
      expect(getChildProcessEnv()).toMatchObject({
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
        OTEL_SERVICE_NAME: 'renovate-test',
      });
    });

    it('merges the current trace context into the child environment', () => {
      vi.spyOn(instrumentationUtils, 'getTraceContextEnv').mockReturnValue({
        TRACEPARENT: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
      });

      expect(getChildProcessEnv()).toMatchObject({
        TRACEPARENT: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
      });
    });
  });

  it('does not forward OTEL_* environment variables when tracing is disabled', () => {
    process.env.OTEL_SERVICE_NAME = 'renovate-test';
    expect(getChildProcessEnv()).not.toHaveProperty('OTEL_SERVICE_NAME');
    delete process.env.OTEL_SERVICE_NAME;
  });
});
