import type { RequiredConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import * as env from './env';
import type { ParseConfigOptions } from './types';

describe('workers/global/config/parse/env', () => {
  describe('.getConfig(env)', () => {
    it('returns empty env', async () => {
      expect(await env.getConfig({})).toEqual({ hostRules: [] });
    });

    it('supports boolean true', async () => {
      const envParam: NodeJS.ProcessEnv = { RENOVATE_CONFIG_MIGRATION: 'true' };
      expect((await env.getConfig(envParam)).configMigration).toBeTrue();
    });

    it('supports boolean false', async () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_CONFIG_MIGRATION: 'false',
      };
      expect((await env.getConfig(envParam)).configMigration).toBeFalse();
    });

    it('throws exception for invalid boolean value', async () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_CONFIG_MIGRATION: 'badvalue',
      };
      await expect(env.getConfig(envParam)).rejects.toThrow(
        Error(
          "Invalid boolean value: expected 'true' or 'false', but got 'badvalue'",
        ),
      );
    });

    delete process.env.RENOVATE_CONFIG_MIGRATION;

    it('supports list single', async () => {
      const envParam: NodeJS.ProcessEnv = { RENOVATE_LABELS: 'a' };
      expect((await env.getConfig(envParam)).labels).toEqual(['a']);
    });

    it('supports list multiple', async () => {
      const envParam: NodeJS.ProcessEnv = { RENOVATE_LABELS: 'a,b,c' };
      expect((await env.getConfig(envParam)).labels).toEqual(['a', 'b', 'c']);
    });

    it('supports list multiple without blank items', async () => {
      const envParam: NodeJS.ProcessEnv = { RENOVATE_LABELS: 'a,b,c,' };
      expect((await env.getConfig(envParam)).labels).toEqual(['a', 'b', 'c']);
    });

    it('supports string', async () => {
      const envParam: NodeJS.ProcessEnv = { RENOVATE_TOKEN: 'a' };
      expect((await env.getConfig(envParam)).token).toBe('a');
    });

    it('coerces string newlines', async () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_GIT_PRIVATE_KEY: 'abc\\ndef',
      };
      expect((await env.getConfig(envParam)).gitPrivateKey).toBe('abc\ndef');
    });

    it('supports custom prefixes', async () => {
      const envParam: NodeJS.ProcessEnv = {
        ENV_PREFIX: 'FOOBAR_',
        FOOBAR_TOKEN: 'abc',
      };
      const res = await env.getConfig(envParam);
      expect(res).toMatchObject({ token: 'abc' });
    });

    it('supports json', async () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_LOCK_FILE_MAINTENANCE: '{}',
      };
      expect((await env.getConfig(envParam)).lockFileMaintenance).toEqual({});
    });

    it('supports arrays of objects', async () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_HOST_RULES: JSON.stringify([{ foo: 'bar' }]),
      };
      const res = await env.getConfig(envParam);
      expect(res).toMatchObject({ hostRules: [{ foo: 'bar' }] });
    });

    test.each`
      envArg                                   | config
      ${{ RENOVATE_RECREATE_CLOSED: 'true' }}  | ${{ recreateWhen: 'always' }}
      ${{ RENOVATE_RECREATE_CLOSED: 'false' }} | ${{ recreateWhen: 'auto' }}
      ${{ RENOVATE_RECREATE_WHEN: 'auto' }}    | ${{ recreateWhen: 'auto' }}
      ${{ RENOVATE_RECREATE_WHEN: 'always' }}  | ${{ recreateWhen: 'always' }}
      ${{ RENOVATE_RECREATE_WHEN: 'never' }}   | ${{ recreateWhen: 'never' }}
    `('"$envArg" -> $config', async ({ envArg, config }) => {
      expect(await env.getConfig(envArg)).toMatchObject(config);
    });

    it('skips misconfigured arrays', async () => {
      const envName = 'RENOVATE_HOST_RULES';
      const val = JSON.stringify('foobar');
      const envParam: NodeJS.ProcessEnv = { [envName]: val };

      const res = await env.getConfig(envParam);

      expect(res).toEqual({ hostRules: [] });
      expect(logger.debug).toHaveBeenLastCalledWith(
        { val, envName },
        'Could not parse object array',
      );
    });

    it('skips garbage array values', async () => {
      const envName = 'RENOVATE_HOST_RULES';
      const val = '!@#';
      const envParam: NodeJS.ProcessEnv = { [envName]: val };

      const res = await env.getConfig(envParam);

      expect(res).toEqual({ hostRules: [] });
      expect(logger.debug).toHaveBeenLastCalledWith(
        { val, envName },
        'Could not parse environment variable',
      );
    });

    it('supports GitHub token', async () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_TOKEN: 'github.com token',
      };
      expect(await env.getConfig(envParam)).toMatchSnapshot({
        token: 'github.com token',
      });
    });

    it('supports GitHub custom endpoint', async () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_ENDPOINT: 'a ghe endpoint',
      };
      expect(await env.getConfig(envParam)).toMatchSnapshot({
        endpoint: 'a ghe endpoint',
      });
    });

    it('supports GitHub custom endpoint and github.com', async () => {
      const envParam: NodeJS.ProcessEnv = {
        GITHUB_COM_TOKEN: 'a github.com token',
        RENOVATE_ENDPOINT: 'a ghe endpoint',
        RENOVATE_TOKEN: 'a ghe token',
      };
      expect(await env.getConfig(envParam)).toMatchSnapshot({
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

    it('supports GitHub fine-grained PATs', async () => {
      const envParam: NodeJS.ProcessEnv = {
        GITHUB_COM_TOKEN: 'github_pat_XXXXXX',
        RENOVATE_TOKEN: 'a github.com token',
      };
      expect(await env.getConfig(envParam)).toEqual({
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

    it('supports GitHub custom endpoint and gitlab.com', async () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_ENDPOINT: 'a ghe endpoint',
        RENOVATE_TOKEN: 'a ghe token',
      };
      expect(await env.getConfig(envParam)).toMatchSnapshot({
        endpoint: 'a ghe endpoint',
        token: 'a ghe token',
      });
    });

    it('supports GitLab token', async () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_PLATFORM: 'gitlab',
        RENOVATE_TOKEN: 'a gitlab.com token',
      };
      expect(await env.getConfig(envParam)).toMatchSnapshot({
        platform: 'gitlab',
        token: 'a gitlab.com token',
      });
    });

    it('supports GitLab custom endpoint', async () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_PLATFORM: 'gitlab',
        RENOVATE_TOKEN: 'a gitlab token',
        RENOVATE_ENDPOINT: 'a gitlab endpoint',
      };
      expect(await env.getConfig(envParam)).toMatchSnapshot({
        endpoint: 'a gitlab endpoint',
        platform: 'gitlab',
        token: 'a gitlab token',
      });
    });

    it('supports Azure DevOps', async () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_PLATFORM: 'azure',
        RENOVATE_TOKEN: 'an Azure DevOps token',
        RENOVATE_ENDPOINT: 'an Azure DevOps endpoint',
      };
      expect(await env.getConfig(envParam)).toMatchSnapshot({
        endpoint: 'an Azure DevOps endpoint',
        platform: 'azure',
        token: 'an Azure DevOps token',
      });
    });

    it('supports Bitbucket token', async () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_PLATFORM: 'bitbucket',
        RENOVATE_ENDPOINT: 'a bitbucket endpoint',
        RENOVATE_USERNAME: 'some-username',
        RENOVATE_PASSWORD: 'app-password',
      };
      expect(await env.getConfig(envParam)).toMatchSnapshot({
        platform: 'bitbucket',
        endpoint: 'a bitbucket endpoint',
        username: 'some-username',
        password: 'app-password',
      });
    });

    it('supports Bitbucket username/password', async () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_PLATFORM: 'bitbucket',
        RENOVATE_ENDPOINT: 'a bitbucket endpoint',
        RENOVATE_USERNAME: 'some-username',
        RENOVATE_PASSWORD: 'app-password',
      };
      expect(await env.getConfig(envParam)).toMatchSnapshot({
        endpoint: 'a bitbucket endpoint',
        hostRules: [],
        password: 'app-password',
        platform: 'bitbucket',
        username: 'some-username',
      });
    });

    it('merges full config from env', async () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_CONFIG: '{"enabled":false,"token":"foo"}',
        RENOVATE_TOKEN: 'a',
      };
      const config = await env.getConfig(envParam);
      expect(config.enabled).toBeFalse();
      expect(config.token).toBe('a');
    });

    describe('RENOVATE_CONFIG tests', () => {
      let processExit: jest.SpyInstance<never, [code?: number]>;

      beforeAll(() => {
        processExit = jest
          .spyOn(process, 'exit')
          .mockImplementation((async () => {}) as never);
      });

      afterAll(() => {
        processExit.mockRestore();
      });

      it('crashes', async () => {
        const envParam: NodeJS.ProcessEnv = { RENOVATE_CONFIG: '!@#' };
        await env.getConfig(envParam);
        expect(processExit).toHaveBeenCalledWith(1);
      });

      it('migrates RENOVATE_CONFIG', async () => {
        const envParam: NodeJS.ProcessEnv = {
          RENOVATE_CONFIG: '{"automerge":"any","token":"foo"}',
        };
        const config = await env.getConfig(envParam);
        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(config.automerge).toBeTrue();
      });

      it('warns if config in RENOVATE_CONFIG is invalid', async () => {
        const envParam: NodeJS.ProcessEnv = {
          RENOVATE_CONFIG: '{"enabled":"invalid-value","prTitle":"something"}',
        };
        await env.getConfig(envParam);
        expect(logger.warn).toHaveBeenCalledTimes(2);
      });
    });

    describe('migrations', () => {
      it('renames migrated variables', async () => {
        const envParam: NodeJS.ProcessEnv = {
          RENOVATE_GIT_LAB_AUTOMERGE: 'true',
        };
        const config = await env.getConfig(envParam);
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

    it('dryRun boolean true', async () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_DRY_RUN: 'true',
      };
      const config = await env.getConfig(envParam);
      expect(config.dryRun).toBe('full');
    });

    it('dryRun boolean false', async () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_DRY_RUN: 'false',
      };
      const config = await env.getConfig(envParam);
      expect(config.dryRun).toBeUndefined();
    });

    it('dryRun null', async () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_DRY_RUN: 'null',
      };
      const config = await env.getConfig(envParam);
      expect(config.dryRun).toBeUndefined();
    });

    it('requireConfig boolean true', async () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_REQUIRE_CONFIG: 'true' as RequiredConfig,
      };
      const config = await env.getConfig(envParam);
      expect(config.requireConfig).toBe('required');
    });

    it('requireConfig boolean false', async () => {
      const envParam: NodeJS.ProcessEnv = {
        RENOVATE_REQUIRE_CONFIG: 'false' as RequiredConfig,
      };
      const config = await env.getConfig(envParam);
      expect(config.requireConfig).toBe('optional');
    });
  });
});
