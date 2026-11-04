import { GlobalConfig } from '../../config/global.ts';
import * as memCache from '../cache/memory/index.ts';
import { setCustomEnv, setUserEnv } from '../env.ts';
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

  describe('urlReplacements', () => {
    afterEach(() => {
      GlobalConfig.reset();
    });

    it('adds whole host replacements after the existing ones, in order', () => {
      vi.stubEnv('URL_REPLACE_3_FROM', 'https://a.example.com/');
      vi.stubEnv('URL_REPLACE_3_TO', 'https://b.example.com/');
      GlobalConfig.set({
        urlReplacements: [
          {
            matchUrlPrefix: 'https://repo.example.com/',
            replaceUrlPrefix: 'https://mirror.example.com/repo/',
          },
          {
            matchUrlPrefix: 'https://repo.example.com/maven2/',
            replaceUrlPrefix: 'https://mirror.example.com/maven/',
          },
          {
            matchUrlPrefix: 'https://npm.example.com/',
            replaceUrlPrefix: 'https://mirror.example.com/npm/',
            matchHostTypes: ['npm'],
          },
          {
            matchUrlPrefix: 'https://Invalid.example.com/',
            replaceUrlPrefix: 'https://mirror.example.com/invalid/',
          },
          {
            matchUrlPrefix: 'https://dl.example.com/',
            replaceUrlPrefix: 'https://mirror.example.com/dl/',
          },
        ],
      });

      const env = getChildProcessEnv();

      expect(
        Object.entries(env).filter(([key]) => key.startsWith('URL_REPLACE_')),
      ).toEqual([
        ['URL_REPLACE_1_FROM', 'URL_REPLACE_1_FROM'],
        ['URL_REPLACE_1_TO', 'URL_REPLACE_1_TO'],
        ['URL_REPLACE_3_FROM', 'https://a.example.com/'],
        ['URL_REPLACE_3_TO', 'https://b.example.com/'],
        ['URL_REPLACE_4_FROM', 'https://repo.example.com/'],
        ['URL_REPLACE_4_TO', 'https://mirror.example.com/repo/'],
        ['URL_REPLACE_5_FROM', 'https://dl.example.com/'],
        ['URL_REPLACE_5_TO', 'https://mirror.example.com/dl/'],
      ]);
    });

    it.each`
      index
      ${'1000000'}
      ${'9007199254740991'}
      ${'9'.repeat(400)}
    `('ignores the existing index $index for numbering', ({ index }) => {
      memCache.init();
      setUserEnv({
        [`URL_REPLACE_${index}_FROM`]: 'https://a.example.com/',
        [`URL_REPLACE_${index}_TO`]: 'https://b.example.com/',
      });
      GlobalConfig.set({
        urlReplacements: [
          {
            matchUrlPrefix: 'https://repo.example.com/',
            replaceUrlPrefix: 'https://mirror.example.com/repo/',
          },
          {
            matchUrlPrefix: 'https://dl.example.com/',
            replaceUrlPrefix: 'https://mirror.example.com/dl/',
          },
        ],
      });

      const env = getChildProcessEnv();

      memCache.reset();
      expect(env).toMatchObject({
        URL_REPLACE_2_FROM: 'https://repo.example.com/',
        URL_REPLACE_3_FROM: 'https://dl.example.com/',
      });
    });

    it('skips any number an existing variable uses', () => {
      memCache.init();
      setUserEnv({
        URL_REPLACE_999999_FROM: 'https://a.example.com/',
        URL_REPLACE_999999_TO: 'https://b.example.com/',
        URL_REPLACE_1000000_TO: 'https://c.example.com/',
      });
      GlobalConfig.set({
        urlReplacements: [
          {
            matchUrlPrefix: 'https://repo.example.com/',
            replaceUrlPrefix: 'https://mirror.example.com/repo/',
          },
          {
            matchUrlPrefix: 'https://dl.example.com/',
            replaceUrlPrefix: 'https://mirror.example.com/dl/',
          },
        ],
      });

      const env = getChildProcessEnv();

      memCache.reset();
      expect(env).not.toHaveProperty('URL_REPLACE_1000000_FROM');
      expect(env).toMatchObject({
        URL_REPLACE_1000001_FROM: 'https://repo.example.com/',
        URL_REPLACE_1000001_TO: 'https://mirror.example.com/repo/',
        URL_REPLACE_1000002_FROM: 'https://dl.example.com/',
      });
    });

    it('starts at 1 without existing replacements', () => {
      vi.stubEnv('URL_REPLACE_1_FROM', undefined);
      vi.stubEnv('URL_REPLACE_1_TO', undefined);
      GlobalConfig.set({
        urlReplacements: [
          {
            matchUrlPrefix: 'https://repo.example.com/',
            replaceUrlPrefix: 'https://mirror.example.com/repo/',
          },
        ],
      });

      expect(getChildProcessEnv()).toMatchObject({
        URL_REPLACE_1_FROM: 'https://repo.example.com/',
        URL_REPLACE_1_TO: 'https://mirror.example.com/repo/',
      });
    });

    const urlReplaceEnv = {
      URL_REPLACE_7_FROM: 'https://a.example.com/',
      URL_REPLACE_7_TO: 'https://b.example.com/',
    };

    it.each`
      source                  | customEnv        | userEnv
      ${'customEnvVariables'} | ${urlReplaceEnv} | ${{}}
      ${'the repository env'} | ${{}}            | ${urlReplaceEnv}
    `(
      'numbers them after the replacements of $source',
      ({ customEnv, userEnv }) => {
        memCache.init();
        setCustomEnv(customEnv);
        setUserEnv(userEnv);
        GlobalConfig.set({
          urlReplacements: [
            {
              matchUrlPrefix: 'https://repo.example.com/',
              replaceUrlPrefix: 'https://mirror.example.com/repo/',
            },
          ],
        });

        const env = getChildProcessEnv();

        setCustomEnv({});
        memCache.reset();
        expect(env).toMatchObject({
          URL_REPLACE_8_FROM: 'https://repo.example.com/',
          URL_REPLACE_8_TO: 'https://mirror.example.com/repo/',
        });
      },
    );

    it('adds them with exposeAllEnv=true too', () => {
      GlobalConfig.set({
        exposeAllEnv: true,
        urlReplacements: [
          {
            matchUrlPrefix: 'https://repo.example.com/',
            replaceUrlPrefix: 'https://mirror.example.com/repo/',
          },
        ],
      });

      expect(getChildProcessEnv()).toMatchObject({
        URL_REPLACE_1_FROM: 'URL_REPLACE_1_FROM',
        URL_REPLACE_2_FROM: 'https://repo.example.com/',
        URL_REPLACE_2_TO: 'https://mirror.example.com/repo/',
      });
    });
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
