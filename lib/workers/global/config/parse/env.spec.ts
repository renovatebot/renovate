import type { RequiredConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import * as env from './env';
import type { ParseConfigOptions } from './types';

describe('workers/global/config/parse/env', () => {
  describe('.getConfig(env)', () => {
    it('returns empty env', () => {
      expect(env.getConfig({})).toEqual({ hostRules: [] });
    });

    it('supports boolean true', () => {
      const envParam: NodeJS.ProcessEnv = { RENOVATE_CONFIG_MIGRATION: 'true' };
      expect(env.getConfig(envParam).configMigration).toBeTrue();
    });

    it('supports boolean false', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_CONFIG_MIGRATION: 'false',
      };
      expect(env.getConfig(envParam).configMigration).toBeFalse();
    });

    it('throws exception for invalid boolean value', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_CONFIG_MIGRATION: 'badvalue',
      };
      expect(() => env.getConfig(envParam)).toThrow(
        Error(
          "Invalid boolean value: expected 'true' or 'false', but got 'badvalue'",
        ),
      );
    });

    delete process.env.RENOVATE_CONFIG_MIGRATION;

    it('supports list single', () => {
      const envParam: NodeJS.ProcessEnv = { RENOVATE_LABELS: 'a' };
      expect(env.getConfig(envParam).labels).toEqual(['a']);
    });

    it('supports list multiple', () => {
      const envParam: NodeJS.ProcessEnv = { RENOVATE_LABELS: 'a,b,c' };
      expect(env.getConfig(envParam).labels).toEqual(['a', 'b', 'c']);
    });

    it('supports list multiple without blank items', () => {
      const envParam: NodeJS.ProcessEnv = { RENOVATE_LABELS: 'a,b,c,' };
      expect(env.getConfig(envParam).labels).toEqual(['a', 'b', 'c']);
    });

    it('supports string', () => {
      const envParam: NodeJS.ProcessEnv = { RENOVATE_TOKEN: 'a' };
      expect(env.getConfig(envParam).token).toBe('a');
    });

    it('coerces string newlines', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_GIT_PRIVATE_KEY: 'abc\\ndef',
      };
      expect(env.getConfig(envParam).gitPrivateKey).toBe('abc\ndef');
    });

    it('supports custom prefixes', () => {
      const envParam: NodeJS.ProcessEnv = {
        ENV_PREFIX: 'FOOBAR_',
        FOOBAR_TOKEN: 'abc',
      };
      const res = env.getConfig(envParam);
      expect(res).toMatchObject({ token: 'abc' });
    });

    it('supports json', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_LOCK_FILE_MAINTENANCE: '{}',
      };
      expect(env.getConfig(envParam).lockFileMaintenance).toEqual({});
    });

    it('supports arrays of objects', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_HOST_RULES: JSON.stringify([{ foo: 'bar' }]),
      };
      const res = env.getConfig(envParam);
      expect(res).toMatchObject({ hostRules: [{ foo: 'bar' }] });
    });

    test.each`
      envArg                                   | config
      ${{ RENOVATE_RECREATE_CLOSED: 'true' }}  | ${{ recreateWhen: 'always' }}
      ${{ RENOVATE_RECREATE_CLOSED: 'false' }} | ${{ recreateWhen: 'auto' }}
      ${{ RENOVATE_RECREATE_WHEN: 'auto' }}    | ${{ recreateWhen: 'auto' }}
      ${{ RENOVATE_RECREATE_WHEN: 'always' }}  | ${{ recreateWhen: 'always' }}
      ${{ RENOVATE_RECREATE_WHEN: 'never' }}   | ${{ recreateWhen: 'never' }}
    `('"$envArg" -> $config', ({ envArg, config }) => {
      expect(env.getConfig(envArg)).toMatchObject(config);
    });

    it('skips misconfigured arrays', () => {
      const envName = 'RENOVATE_HOST_RULES';
      const val = JSON.stringify('foobar');
      const envParam: NodeJS.ProcessEnv = { [envName]: val };

      const res = env.getConfig(envParam);

      expect(res).toEqual({ hostRules: [] });
      expect(logger.debug).toHaveBeenLastCalledWith(
        { val, envName },
        'Could not parse object array',
      );
    });

    it('skips garbage array values', () => {
      const envName = 'RENOVATE_HOST_RULES';
      const val = '!@#';
      const envParam: NodeJS.ProcessEnv = { [envName]: val };

      const res = env.getConfig(envParam);

      expect(res).toEqual({ hostRules: [] });
      expect(logger.debug).toHaveBeenLastCalledWith(
        { val, envName },
        'Could not parse environment variable',
      );
    });

    it('supports GitHub token', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_TOKEN: 'github.com token',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        token: 'github.com token',
      });
    });

    it('supports GitHub custom endpoint', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_ENDPOINT: 'a ghe endpoint',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        endpoint: 'a ghe endpoint',
      });
    });

    it('supports GitHub custom endpoint and github.com', () => {
      const envParam: NodeJS.ProcessEnv = {
        GITHUB_COM_TOKEN: 'a github.com token',
        RENOVATE_ENDPOINT: 'a ghe endpoint',
        RENOVATE_TOKEN: 'a ghe token',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        endpoint: 'a ghe endpoint',
        hostRules: [
          {
            hostType: 'github',
            matchHost: 'github.com',
            token: 'a github.com token',
          },
        ],
        token: 'a ghe token',
      });
    });

    it('supports GitHub fine-grained PATs', () => {
      const envParam: NodeJS.ProcessEnv = {
        GITHUB_COM_TOKEN: 'github_pat_XXXXXX',
        RENOVATE_TOKEN: 'a github.com token',
      };
      expect(env.getConfig(envParam)).toEqual({
        token: 'a github.com token',
        hostRules: [
          {
            hostType: 'github',
            matchHost: 'github.com',
            token: 'github_pat_XXXXXX',
          },
        ],
      });
    });

    it('supports GitHub custom endpoint and gitlab.com', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_ENDPOINT: 'a ghe endpoint',
        RENOVATE_TOKEN: 'a ghe token',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        endpoint: 'a ghe endpoint',
        token: 'a ghe token',
      });
    });

    it('supports GitLab token', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_PLATFORM: 'gitlab',
        RENOVATE_TOKEN: 'a gitlab.com token',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        platform: 'gitlab',
        token: 'a gitlab.com token',
      });
    });

    it('supports GitLab custom endpoint', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_PLATFORM: 'gitlab',
        RENOVATE_TOKEN: 'a gitlab token',
        RENOVATE_ENDPOINT: 'a gitlab endpoint',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        endpoint: 'a gitlab endpoint',
        platform: 'gitlab',
        token: 'a gitlab token',
      });
    });

    it('supports Azure DevOps', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_PLATFORM: 'azure',
        RENOVATE_TOKEN: 'an Azure DevOps token',
        RENOVATE_ENDPOINT: 'an Azure DevOps endpoint',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        endpoint: 'an Azure DevOps endpoint',
        platform: 'azure',
        token: 'an Azure DevOps token',
      });
    });

    it('supports Bitbucket token', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_PLATFORM: 'bitbucket',
        RENOVATE_ENDPOINT: 'a bitbucket endpoint',
        RENOVATE_USERNAME: 'some-username',
        RENOVATE_PASSWORD: 'app-password',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        platform: 'bitbucket',
        endpoint: 'a bitbucket endpoint',
        username: 'some-username',
        password: 'app-password',
      });
    });

    it('supports Bitbucket username/password', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_PLATFORM: 'bitbucket',
        RENOVATE_ENDPOINT: 'a bitbucket endpoint',
        RENOVATE_USERNAME: 'some-username',
        RENOVATE_PASSWORD: 'app-password',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot({
        endpoint: 'a bitbucket endpoint',
        hostRules: [],
        password: 'app-password',
        platform: 'bitbucket',
        username: 'some-username',
      });
    });

    it('merges full config from env', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_CONFIG: '{"enabled":false,"token":"foo"}',
        RENOVATE_TOKEN: 'a',
      };
      const config = env.getConfig(envParam);
      expect(config.enabled).toBeFalse();
      expect(config.token).toBe('a');
    });

    describe('malformed RENOVATE_CONFIG', () => {
      let processExit: jest.SpyInstance<never, [code?: number]>;

      beforeAll(() => {
        processExit = jest
          .spyOn(process, 'exit')
          .mockImplementation((() => {}) as never);
      });

      afterAll(() => {
        processExit.mockRestore();
      });

      it('crashes', () => {
        const envParam: NodeJS.ProcessEnv = { RENOVATE_CONFIG: '!@#' };
        env.getConfig(envParam);
        expect(processExit).toHaveBeenCalledWith(1);
      });
    });

    describe('migrations', () => {
      it('renames migrated variables', () => {
        const envParam: NodeJS.ProcessEnv = {
          RENOVATE_GIT_LAB_AUTOMERGE: 'true',
        };
        const config = env.getConfig(envParam);
        expect(config.platformAutomerge).toBe(true);
      });
    });
  });

  describe('.getEnvName(definition)', () => {
    it('returns empty', () => {
      const option: ParseConfigOptions = {
        name: 'foo',
        env: false,
      };
      expect(env.getEnvName(option)).toBe('');
    });

    it('returns existing env', () => {
      const option: ParseConfigOptions = {
        name: 'foo',
        env: 'FOO',
      };
      expect(env.getEnvName(option)).toBe('FOO');
    });

    it('generates RENOVATE_ env', () => {
      const option: ParseConfigOptions = {
        name: 'oneTwoThree',
      };
      expect(env.getEnvName(option)).toBe('RENOVATE_ONE_TWO_THREE');
    });

    it('dryRun boolean true', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_DRY_RUN: 'true',
      };
      const config = env.getConfig(envParam);
      expect(config.dryRun).toBe('full');
    });

    it('dryRun boolean false', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_DRY_RUN: 'false',
      };
      const config = env.getConfig(envParam);
      expect(config.dryRun).toBeUndefined();
    });

    it('dryRun null', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_DRY_RUN: 'null',
      };
      const config = env.getConfig(envParam);
      expect(config.dryRun).toBeUndefined();
    });

    it('requireConfig boolean true', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_REQUIRE_CONFIG: 'true' as RequiredConfig,
      };
      const config = env.getConfig(envParam);
      expect(config.requireConfig).toBe('required');
    });

    it('requireConfig boolean false', () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_REQUIRE_CONFIG: 'false' as RequiredConfig,
      };
      const config = env.getConfig(envParam);
      expect(config.requireConfig).toBe('optional');
    });
  });
});
