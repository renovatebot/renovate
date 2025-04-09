import upath from 'upath';
import { getCustomEnv } from '../../../../util/env';
import { getParentDir, readSystemFile } from '../../../../util/fs';
import getArgv from './__fixtures__/argv';
import * as _hostRulesFromEnv from './host-rules-from-env';

vi.mock('../../../../modules/datasource/npm');
vi.mock('../../../../util/fs');
vi.mock('./host-rules-from-env');

const { hostRulesFromEnv } = vi.mocked(_hostRulesFromEnv);

describe('workers/global/config/parse/index', () => {
  describe('.parseConfigs(env, defaultArgv)', () => {
    let configParser: typeof import('.');
    let defaultArgv: string[];
    let defaultEnv: NodeJS.ProcessEnv;

    beforeEach(async () => {
      configParser = await vi.importActual('./index');
      defaultArgv = getArgv();
      defaultEnv = {
        RENOVATE_CONFIG_FILE: upath.resolve(
          __dirname,
          './__fixtures__/default.js',
        ),
      };
    });

    it('supports token in env', async () => {
      const env: NodeJS.ProcessEnv = { ...defaultEnv, RENOVATE_TOKEN: 'abc' };
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig).toContainEntries([['token', 'abc']]);
    });

    it('supports token in CLI options', async () => {
      defaultArgv = defaultArgv.concat([
        '--token=abc',
        '--pr-footer=custom',
        '--log-context=123test',
      ]);
      const parsedConfig = await configParser.parseConfigs(
        defaultEnv,
        defaultArgv,
      );
      expect(parsedConfig).toContainEntries([
        ['token', 'abc'],
        ['prFooter', 'custom'],
        ['logContext', '123test'],
      ]);
    });

    it('supports forceCli', async () => {
      defaultArgv = defaultArgv.concat(['--force-cli=false']);
      const env: NodeJS.ProcessEnv = {
        ...defaultEnv,
        RENOVATE_TOKEN: 'abc',
      };
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig).toContainEntries([
        ['token', 'abc'],
        ['force', null],
      ]);
      expect(parsedConfig).not.toContainKey('configFile');
    });

    it('sets customEnvVariables', async () => {
      const env: NodeJS.ProcessEnv = {
        ...defaultEnv,
        RENOVATE_TOKEN: 'abc',
        RENOVATE_CUSTOM_ENV_VARIABLES: '{"customKey": "customValue"}',
      };
      await configParser.parseConfigs(env, defaultArgv);
      const customEnvVars = getCustomEnv();
      expect(customEnvVars).toEqual({
        customKey: 'customValue',
      });
    });

    it('supports config.force', async () => {
      const configPath = upath.join(__dirname, '__fixtures__/with-force.js');
      const env: NodeJS.ProcessEnv = {
        ...defaultEnv,
        RENOVATE_CONFIG_FILE: configPath,
      };
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig).toContainEntries([
        ['token', 'abcdefg'],
        [
          'force',
          {
            schedule: null,
          },
        ],
      ]);
    });

    it('reads private key from file', async () => {
      const privateKeyPath = upath.join(__dirname, '__fixtures__/private.pem');
      const privateKeyPathOld = upath.join(
        __dirname,
        '__fixtures__/private.pem',
      );
      const env: NodeJS.ProcessEnv = {
        ...defaultEnv,
        RENOVATE_PRIVATE_KEY_PATH: privateKeyPath,
        RENOVATE_PRIVATE_KEY_PATH_OLD: privateKeyPathOld,
      };
      const expected = await readSystemFile(privateKeyPath, 'utf8');
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);

      expect(parsedConfig).toContainEntries([['privateKey', expected]]);
    });

    it('supports Bitbucket username/password', async () => {
      defaultArgv = defaultArgv.concat([
        '--platform=bitbucket',
        '--username=user',
        '--password=pass',
      ]);
      const parsedConfig = await configParser.parseConfigs(
        defaultEnv,
        defaultArgv,
      );
      expect(parsedConfig).toContainEntries([
        ['platform', 'bitbucket'],
        ['username', 'user'],
        ['password', 'pass'],
      ]);
    });

    it('massages trailing slash into endpoint', async () => {
      defaultArgv = defaultArgv.concat([
        '--endpoint=https://github.renovatebot.com/api/v3',
      ]);
      const parsed = await configParser.parseConfigs(defaultEnv, defaultArgv);
      expect(parsed.endpoint).toBe('https://github.renovatebot.com/api/v3/');
    });

    it('parses global manager config', async () => {
      defaultArgv = defaultArgv.concat(['--detect-global-manager-config=true']);
      const parsed = await configParser.parseConfigs(defaultEnv, defaultArgv);
      expect(parsed.npmrc).toBeNull();
    });

    it('parses host rules from env', async () => {
      defaultArgv = defaultArgv.concat(['--detect-host-rules-from-env=true']);
      hostRulesFromEnv.mockReturnValueOnce([{ matchHost: 'example.org' }]);
      const parsed = await configParser.parseConfigs(defaultEnv, defaultArgv);
      expect(parsed.hostRules).toContainEqual({ matchHost: 'example.org' });
    });

    it('env dryRun = true replaced to full', async () => {
      const env: NodeJS.ProcessEnv = {
        ...defaultEnv,
        RENOVATE_DRY_RUN: 'true',
      };
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig).toContainEntries([['dryRun', 'full']]);
    });

    it('cli dryRun = true replaced to full', async () => {
      defaultArgv = defaultArgv.concat(['--dry-run=true']);
      const parsed = await configParser.parseConfigs(defaultEnv, defaultArgv);
      expect(parsed).toContainEntries([['dryRun', 'full']]);
    });

    it('cli dryRun replaced to full', async () => {
      defaultArgv = defaultArgv.concat(['--dry-run']);
      const parsed = await configParser.parseConfigs(defaultEnv, defaultArgv);
      expect(parsed).toContainEntries([['dryRun', 'full']]);
    });

    it('env dryRun = false replaced to null', async () => {
      const env: NodeJS.ProcessEnv = {
        ...defaultEnv,
        RENOVATE_DRY_RUN: 'false',
      };
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig).toContainEntries([['dryRun', null]]);
    });

    it('cli dryRun = false replaced to null', async () => {
      defaultArgv = defaultArgv.concat(['--dry-run=false']);
      const parsed = await configParser.parseConfigs(defaultEnv, defaultArgv);
      expect(parsed).toContainEntries([['dryRun', null]]);
    });

    it('only initializes the file when the env var LOG_FILE is properly set', async () => {
      vi.doMock('../../../../../config.js', () => ({ default: {} }));
      const env: NodeJS.ProcessEnv = {};
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig).not.toContain([['logFile', 'someFile']]);
      expect(getParentDir).not.toHaveBeenCalled();
    });

    it('massage onboardingNoDeps when autodiscover is false', async () => {
      vi.doMock('../../../../../config.js', () => ({
        default: {
          onboardingNoDeps: 'auto',
          autodiscover: false,
        },
      }));
      const env: NodeJS.ProcessEnv = {};
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig).toContainEntries([['onboardingNoDeps', 'enabled']]);
    });

    it('apply secrets to global config', async () => {
      vi.doMock('../../../../../config.js', () => ({
        default: {
          secrets: {
            SECRET_TOKEN: 'secret_token',
          },
          customEnvVariables: {
            TOKEN: '{{ secrets.SECRET_TOKEN }}',
          },
        },
      }));
      const env: NodeJS.ProcessEnv = {};
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig.secrets).toMatchObject({
        SECRET_TOKEN: 'secret_token',
      });
      expect(parsedConfig.customEnvVariables).toMatchObject({
        TOKEN: 'secret_token',
      });
    });
  });
});
