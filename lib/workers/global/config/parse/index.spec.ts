import upath from 'upath';
import * as httpMock from '~test/http-mock.ts';
import { getConfigFileNames } from '../../../../config/app-strings.ts';
import * as _decrypt from '../../../../config/decrypt.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import { CONFIG_PRESETS_INVALID } from '../../../../constants/error-messages.ts';
import { logger } from '../../../../logger/index.ts';
import { getCustomEnv } from '../../../../util/env.ts';
import { getParentDir, readSystemFile } from '../../../../util/fs/index.ts';
import * as hostRules from '../../../../util/host-rules.ts';
import { toBase64 } from '../../../../util/string.ts';
import getArgv from './__fixtures__/argv.ts';
import * as _fileConfigParser from './file.ts';
import * as _hostRulesFromEnv from './host-rules-from-env.ts';

vi.mock('../../../../modules/datasource/npm.ts');
vi.mock('../../../../modules/manager/index.ts', () => ({
  detectAllGlobalConfig: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../../../util/fs/index.ts');
vi.mock('../../../../config/decrypt.ts');
vi.mock('./host-rules-from-env.ts');
vi.mock('./file.ts');

const decrypt = vi.mocked(_decrypt);
const fileConfigParser = vi.mocked(_fileConfigParser);

const { hostRulesFromEnv } = vi.mocked(_hostRulesFromEnv);

describe('workers/global/config/parse/index', () => {
  describe('.parseConfigs(env, defaultArgv)', () => {
    let configParser: typeof import('./index.ts');
    let defaultArgv: string[];
    let defaultEnv: NodeJS.ProcessEnv;

    beforeEach(async () => {
      configParser = await vi.importActual('./index.ts');
      defaultArgv = getArgv();
      defaultEnv = {
        RENOVATE_CONFIG_FILE: upath.resolve(
          import.meta.dirname,
          './__fixtures__/default.js',
        ),
      };
    });

    it('supports token in env', async () => {
      fileConfigParser.getConfig.mockResolvedValue({});
      const env: NodeJS.ProcessEnv = { ...defaultEnv, RENOVATE_TOKEN: 'abc' };
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig).toContainEntries([['token', 'abc']]);
    });

    it('supports token in CLI options', async () => {
      fileConfigParser.getConfig.mockResolvedValue({});
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
      fileConfigParser.getConfig.mockResolvedValue({});
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
      fileConfigParser.getConfig.mockResolvedValue({});
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
      fileConfigParser.getConfig.mockResolvedValueOnce({
        token: 'abcdefg',
        force: {
          schedule: ['* * * * 0.6'],
        },
      });
      const parsedConfig = await configParser.parseConfigs(
        defaultEnv,
        defaultArgv,
      );
      expect(parsedConfig).toContainEntries([
        ['token', 'abcdefg'],
        [
          'force',
          {
            schedule: ['* * * * 0.6'],
          },
        ],
      ]);
    });

    it('reads private key from file', async () => {
      fileConfigParser.getConfig.mockResolvedValue({});
      const privateKeyPath = upath.join(
        import.meta.dirname,
        '__fixtures__/private.pem',
      );
      const privateKeyPathOld = upath.join(
        import.meta.dirname,
        '__fixtures__/private.pem',
      );
      const env: NodeJS.ProcessEnv = {
        ...defaultEnv,
        RENOVATE_PRIVATE_KEY_PATH: privateKeyPath,
        RENOVATE_PRIVATE_KEY_PATH_OLD: privateKeyPathOld,
      };
      const expected = await readSystemFile(privateKeyPath, 'utf8');
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);

      expect(parsedConfig.privateKey).toBeUndefined();
      expect(decrypt.setPrivateKeys).toHaveBeenCalledExactlyOnceWith(
        expected,
        undefined,
      );
    });

    it('supports Bitbucket username/password', async () => {
      fileConfigParser.getConfig.mockResolvedValue({});
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
      fileConfigParser.getConfig.mockResolvedValue({});
      defaultArgv = defaultArgv.concat([
        '--endpoint=https://github.renovatebot.com/api/v3',
      ]);
      const parsed = await configParser.parseConfigs(defaultEnv, defaultArgv);
      expect(parsed.endpoint).toBe('https://github.renovatebot.com/api/v3/');
    });

    it('parses global manager config', async () => {
      fileConfigParser.getConfig.mockResolvedValue({});
      defaultArgv = defaultArgv.concat(['--detect-global-manager-config=true']);
      const parsed = await configParser.parseConfigs(defaultEnv, defaultArgv);
      expect(parsed.npmrc).toBeNull();
    });

    it('parses host rules from env', async () => {
      fileConfigParser.getConfig.mockResolvedValue({});
      defaultArgv = defaultArgv.concat(['--detect-host-rules-from-env=true']);
      hostRulesFromEnv.mockReturnValueOnce([{ matchHost: 'example.org' }]);
      const parsed = await configParser.parseConfigs(defaultEnv, defaultArgv);
      expect(parsed.hostRules).toContainEqual({ matchHost: 'example.org' });
    });

    it('env dryRun = true replaced to full', async () => {
      fileConfigParser.getConfig.mockResolvedValue({});
      const env: NodeJS.ProcessEnv = {
        ...defaultEnv,
        RENOVATE_DRY_RUN: 'true',
      };
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig).toContainEntries([['dryRun', 'full']]);
    });

    it('cli dryRun = true replaced to full', async () => {
      fileConfigParser.getConfig.mockResolvedValue({});
      defaultArgv = defaultArgv.concat(['--dry-run=true']);
      const parsed = await configParser.parseConfigs(defaultEnv, defaultArgv);
      expect(parsed).toContainEntries([['dryRun', 'full']]);
    });

    it('resolves global presets', async () => {
      fileConfigParser.getConfig.mockResolvedValue({
        globalExtends: ['http://example.com/config.json', ':pinVersions'],
        dryRun: 'extract',
      });
      // The remote preset defined in globalExtends of the config file
      httpMock
        .scope('http://example.com/')
        .get('/config.json')
        .reply(200, { repositories: ['g/r1', 'g/r2'], dryRun: 'full' });

      const parsedConfig = await configParser.parseConfigs(
        defaultEnv,
        defaultArgv,
      );

      // Remote preset in globalExtends should be resolved
      expect(parsedConfig).toContainEntries([
        ['repositories', ['g/r1', 'g/r2']],
      ]);
      // :pinVersion in globalExtends should be resolved
      expect(parsedConfig).toContainEntries([['rangeStrategy', 'pin']]);
      // `globalExtends` should be an empty array after merging
      expect(parsedConfig).toContainEntries([['globalExtends', []]]);
      // `dryRun` from globalExtends should be overwritten with value defined in config file
      expect(parsedConfig).toContainEntries([['dryRun', 'extract']]);
    });

    it('throws exception if global presets cannot be resolved', async () => {
      fileConfigParser.getConfig.mockResolvedValue({});
      httpMock
        .scope('http://example.com/')
        .get('/config.json')
        .reply(404, 'Not Found');

      await expect(
        configParser.resolveGlobalExtends([
          'http://example.com/config.json',
          ':pinVersions',
        ]),
      ).rejects.toThrow(CONFIG_PRESETS_INVALID);
    });

    it('cli dryRun replaced to full', async () => {
      fileConfigParser.getConfig.mockResolvedValue({});
      defaultArgv = defaultArgv.concat(['--dry-run']);
      const parsed = await configParser.parseConfigs(defaultEnv, defaultArgv);
      expect(parsed).toContainEntries([['dryRun', 'full']]);
    });

    it('env dryRun = false replaced to null', async () => {
      fileConfigParser.getConfig.mockResolvedValue({});
      const env: NodeJS.ProcessEnv = {
        ...defaultEnv,
        RENOVATE_DRY_RUN: 'false',
      };
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig).toContainEntries([['dryRun', null]]);
    });

    it('cli dryRun = false replaced to null', async () => {
      fileConfigParser.getConfig.mockResolvedValue({});
      defaultArgv = defaultArgv.concat(['--dry-run=false']);
      const parsed = await configParser.parseConfigs(defaultEnv, defaultArgv);
      expect(parsed).toContainEntries([['dryRun', null]]);
    });

    it('only initializes the file when the env var LOG_FILE is properly set', async () => {
      fileConfigParser.getConfig.mockResolvedValue({});
      const parsedConfig = await configParser.parseConfigs({}, defaultArgv);
      expect(parsedConfig).not.toContain([['logFile', 'someFile']]);
      expect(getParentDir).not.toHaveBeenCalled();
    });

    it('massage onboardingNoDeps when autodiscover is false', async () => {
      fileConfigParser.getConfig.mockResolvedValueOnce({
        onboardingNoDeps: 'auto',
        autodiscover: false,
      });
      const env: NodeJS.ProcessEnv = {};
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig).toContainEntries([['onboardingNoDeps', 'enabled']]);
    });

    // added to ensure fileConfigParser works properly
    it('does not massage onboardingNoDeps when autodiscover is true', async () => {
      fileConfigParser.getConfig.mockResolvedValueOnce({
        onboardingNoDeps: 'auto',
        autodiscover: true,
      });
      const env: NodeJS.ProcessEnv = {};
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig).toContainEntries([['onboardingNoDeps', 'auto']]);
    });

    it('apply secrets to global config', async () => {
      fileConfigParser.getConfig.mockResolvedValue({});
      const env: NodeJS.ProcessEnv = {
        ...defaultEnv,
        RENOVATE_SECRETS: '{"SECRET_TOKEN": "secret_token"}',
        RENOVATE_CUSTOM_ENV_VARIABLES:
          '{"TOKEN": "{{ secrets.SECRET_TOKEN }}"}',
      };
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig).toMatchObject({
        secrets: {
          SECRET_TOKEN: 'secret_token',
        },

        customEnvVariables: {
          TOKEN: 'secret_token',
        },
      });
    });

    it('overrides file config with additional file config', async () => {
      const additionalConfigPath = upath.join(
        import.meta.dirname,
        '__fixtures__/additional-config.js',
      );
      fileConfigParser.getConfig.mockResolvedValueOnce({
        labels: ['file-config'],
      });
      const env: NodeJS.ProcessEnv = {
        RENOVATE_ADDITIONAL_CONFIG_FILE: additionalConfigPath,
      };
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig.labels).toMatchObject(['additional-file-config']);
    });

    it('merges extends from file config with additional file config', async () => {
      const additionalConfigPath = upath.join(
        import.meta.dirname,
        '__fixtures__/additional-config.js',
      );
      fileConfigParser.getConfig.mockResolvedValueOnce({
        extends: [':pinDigests'],
      });
      const env: NodeJS.ProcessEnv = {
        RENOVATE_ADDITIONAL_CONFIG_FILE: additionalConfigPath,
      };
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig.extends).toMatchObject([
        ':pinDigests',
        'customManagers:azurePipelinesVersions',
      ]);
    });

    it('adds extends from fileConfig only', async () => {
      fileConfigParser.getConfig.mockResolvedValueOnce({
        extends: [':pinDigests'],
      });
      const parsedConfig = await configParser.parseConfigs(
        defaultEnv,
        defaultArgv,
      );
      expect(parsedConfig.extends).toMatchObject([':pinDigests']);
    });

    it('appends files from configFileNames to config filenames list', async () => {
      // Capture the length we add our custom filenames.
      const lengthBefore = getConfigFileNames().length;
      fileConfigParser.getConfig.mockResolvedValue({
        configFileNames: ['myrenovate.json', '.github/myrenovate.json'],
      });
      const parsedConfig = await configParser.parseConfigs(
        defaultEnv,
        defaultArgv,
      );
      expect(parsedConfig.configFileNames).toBeUndefined();
      expect(getConfigFileNames()[0]).toBe('myrenovate.json');
      expect(getConfigFileNames()[1]).toBe('.github/myrenovate.json');
      // Ensure we added exactly two filenames.
      expect(getConfigFileNames().length).toBe(lengthBefore + 2);
    });

    it('supports setting configFileNames through cli', async () => {
      fileConfigParser.getConfig.mockResolvedValue({});
      defaultArgv = defaultArgv.concat([
        '--config-file-names=myrenovate.json,.github/myrenovate.json',
      ]);
      const parsed = await configParser.parseConfigs(defaultEnv, defaultArgv);
      expect(parsed.configFileNames).toBeUndefined();
      expect(getConfigFileNames()[0]).toBe('myrenovate.json');
      expect(getConfigFileNames()[1]).toBe('.github/myrenovate.json');
    });

    it('supports setting configFileNames through env', async () => {
      fileConfigParser.getConfig.mockResolvedValue({});
      const env: NodeJS.ProcessEnv = {
        RENOVATE_CONFIG_FILE_NAMES:
          '["myrenovate.json", ".github/myrenovate.json"]',
      };
      const parsedConfig = await configParser.parseConfigs(env, defaultArgv);
      expect(parsedConfig.configFileNames).toBeUndefined();
      expect(getConfigFileNames()[0]).toBe('myrenovate.json');
      expect(getConfigFileNames()[1]).toBe('.github/myrenovate.json');
    });

    describe('when resolving `globalExtends`', () => {
      // an IP literal, as the HTTP mock bypasses DNS resolution, so a hostname would never be judged as internal
      const presetHost = 'http://127.0.0.1:18088';
      const presetUrl = `${presetHost}/preset.json`;

      it('warns about an internal preset host by default', async () => {
        fileConfigParser.getConfig.mockResolvedValue({
          globalExtends: [presetUrl],
        });
        httpMock
          .scope(presetHost)
          .get('/preset.json')
          .reply(200, { repositories: ['g/r1'] });

        const parsedConfig = await configParser.parseConfigs(
          defaultEnv,
          defaultArgv,
        );

        expect(parsedConfig.repositories).toEqual(['g/r1']);
        expect(logger.once.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            hostname: '127.0.0.1',
            hostType: 'preset',
          }),
          expect.stringContaining('internalHostAccess=block'),
        );
      });

      it('applies the administrator scoped `hostRules` grant', async () => {
        fileConfigParser.getConfig.mockResolvedValue({
          globalExtends: [presetUrl],
          hostRules: [{ matchHost: presetHost, allowInternal: true }],
        });
        httpMock
          .scope(presetHost)
          .get('/preset.json')
          .reply(200, { repositories: ['g/r1'] });

        const parsedConfig = await configParser.parseConfigs(
          defaultEnv,
          defaultArgv,
        );

        expect(parsedConfig.repositories).toEqual(['g/r1']);
        expect(logger.once.warn).not.toHaveBeenCalled();
        expect(logger.once.info).toHaveBeenCalledWith(
          'Internal host 127.0.0.1 permitted by configuration',
        );
      });

      it('refuses an internal preset host under `internalHostAccess=block` without a grant', async () => {
        fileConfigParser.getConfig.mockResolvedValue({
          globalExtends: [presetUrl],
          internalHostAccess: 'block',
        });

        await expect(
          configParser.parseConfigs(defaultEnv, defaultArgv),
        ).rejects.toThrow(CONFIG_PRESETS_INVALID);

        expect(logger.warn).toHaveBeenCalledWith(
          { url: presetUrl, hostType: 'preset' },
          'Blocked HTTP request to an internal host - a self-hosted administrator can permit it via `hostRules`, or with `internalHostAccess=allow`',
        );
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({ preset: presetUrl }),
          'Preset host is blocked by this Renovate instance',
        );
        expect(hostRules.getAll()).toEqual([]);
        expect(GlobalConfig.get()).toEqual({});
      });

      it('does not warn under `internalHostAccess=allow`', async () => {
        fileConfigParser.getConfig.mockResolvedValue({
          globalExtends: [presetUrl],
          internalHostAccess: 'allow',
        });
        httpMock
          .scope(presetHost)
          .get('/preset.json')
          .reply(200, { repositories: ['g/r1'] });

        const parsedConfig = await configParser.parseConfigs(
          defaultEnv,
          defaultArgv,
        );

        expect(parsedConfig.repositories).toEqual(['g/r1']);
        expect(logger.once.warn).not.toHaveBeenCalled();
      });

      it('permits a preset served from the platform `endpoint`', async () => {
        fileConfigParser.getConfig.mockResolvedValue({
          globalExtends: [presetUrl],
          endpoint: `${presetHost}/`,
          internalHostAccess: 'block',
        });
        httpMock
          .scope(presetHost)
          .get('/preset.json')
          .reply(200, { repositories: ['g/r1'] });

        const parsedConfig = await configParser.parseConfigs(
          defaultEnv,
          defaultArgv,
        );

        expect(parsedConfig.repositories).toEqual(['g/r1']);
        expect(logger.once.warn).not.toHaveBeenCalled();
      });

      it('authenticates with the administrator `hostRules`, with secrets applied', async () => {
        fileConfigParser.getConfig.mockResolvedValue({
          globalExtends: [presetUrl],
          hostRules: [
            {
              matchHost: presetHost,
              allowInternal: true,
              token: '{{ secrets.PRESET_TOKEN }}',
            },
          ],
          secrets: { PRESET_TOKEN: 'abc' },
        });
        httpMock
          .scope(presetHost, { reqheaders: { authorization: 'Bearer abc' } })
          .get('/preset.json')
          .reply(200, { repositories: ['g/r1'] });

        const parsedConfig = await configParser.parseConfigs(
          defaultEnv,
          defaultArgv,
        );

        expect(parsedConfig.repositories).toEqual(['g/r1']);
        expect(parsedConfig.hostRules).toEqual([
          { matchHost: presetHost, allowInternal: true, token: 'abc' },
        ]);
        // the administrator config is not rewritten in place, so it still holds the template until the secrets are applied to the whole config
        expect(logger.debug).toHaveBeenCalledWith(
          {
            config: expect.objectContaining({
              hostRules: [
                expect.objectContaining({
                  token: '{{ secrets.PRESET_TOKEN }}',
                }),
              ],
            }),
          },
          'Combined config',
        );
      });

      it('does not use `hostRules` whose secrets are not available yet', async () => {
        fileConfigParser.getConfig.mockResolvedValue({
          globalExtends: ['http://example.com/config.json'],
          hostRules: [
            {
              matchHost: 'http://example.com',
              token: '{{ secrets.FROM_PRESET }}',
            },
          ],
        });
        httpMock
          .scope('http://example.com', { badheaders: ['authorization'] })
          .get('/config.json')
          .reply(200, { secrets: { FROM_PRESET: 'x' } });

        const parsedConfig = await configParser.parseConfigs(
          defaultEnv,
          defaultArgv,
        );

        expect(parsedConfig.hostRules).toEqual([
          { matchHost: 'http://example.com', token: 'x' },
        ]);
        expect(logger.debug).toHaveBeenCalledWith(
          { err: expect.any(Error) },
          'Not applying hostRules to globalExtends, as their secrets or variables cannot be resolved yet',
        );
      });

      it('does not leave `hostRules` or `GlobalConfig` set afterwards', async () => {
        fileConfigParser.getConfig.mockResolvedValue({
          globalExtends: [presetUrl],
          hostRules: [{ matchHost: presetHost, allowInternal: true }],
          internalHostAccess: 'block',
        });
        httpMock
          .scope(presetHost)
          .get('/preset.json')
          .reply(200, { repositories: ['g/r1'] });

        await configParser.parseConfigs(defaultEnv, defaultArgv);

        expect(hostRules.getAll()).toEqual([]);
        expect(GlobalConfig.get()).toEqual({});
      });

      it('resolves `local>` presets against the administrator platform `endpoint`, with its `hostRules`', async () => {
        fileConfigParser.getConfig.mockResolvedValue({
          globalExtends: ['local>group/presets'],
          platform: 'gitlab',
          endpoint: 'https://gitlab.example.com/api/v4',
          hostRules: [
            { matchHost: 'gitlab.example.com', token: 'glpat-123456' },
          ],
        });
        httpMock
          .scope('https://gitlab.example.com', {
            reqheaders: { authorization: 'Bearer glpat-123456' },
          })
          .get(
            '/api/v4/projects/group%2Fpresets/repository/files/default.json?ref=HEAD',
          )
          .reply(200, {
            content: toBase64(JSON.stringify({ repositories: ['g/local'] })),
          });

        const parsedConfig = await configParser.parseConfigs(
          defaultEnv,
          defaultArgv,
        );

        expect(parsedConfig.repositories).toEqual(['g/local']);
      });

      it('does not let a `globalExtends` preset grant its own nested presets', async () => {
        fileConfigParser.getConfig.mockResolvedValue({
          globalExtends: ['http://example.com/config.json'],
          internalHostAccess: 'block',
        });
        httpMock
          .scope('http://example.com')
          .get('/config.json')
          .reply(200, {
            extends: [`${presetHost}/nested.json`],
            hostRules: [{ matchHost: presetHost, allowInternal: true }],
          });

        await expect(
          configParser.parseConfigs(defaultEnv, defaultArgv),
        ).rejects.toThrow(CONFIG_PRESETS_INVALID);
      });
    });

    // TODO #41551
    describe('when `repositories` is being overridden', () => {
      it('warns when CLI config overrides repositories from file config', async () => {
        fileConfigParser.getConfig.mockResolvedValue({
          repositories: ['org/repo1', 'org/repo2'],
        });
        defaultArgv = defaultArgv.concat(['org/repo3']);
        await configParser.parseConfigs(defaultEnv, defaultArgv);
        expect(logger.warn).toHaveBeenCalledWith(
          'CLI config is overridding the `repositories` config previously set',
        );
      });

      it('warns when CLI config overrides repositories from env config', async () => {
        fileConfigParser.getConfig.mockResolvedValue({});
        const env: NodeJS.ProcessEnv = {
          ...defaultEnv,
          RENOVATE_REPOSITORIES: '["org/repo1"]',
        };
        defaultArgv = defaultArgv.concat(['org/repo3']);
        await configParser.parseConfigs(env, defaultArgv);
        expect(logger.warn).toHaveBeenCalledWith(
          'CLI config is overridding the `repositories` config previously set',
        );
      });

      it('does not warn when CLI config sets repositories without override', async () => {
        fileConfigParser.getConfig.mockResolvedValue({});
        defaultArgv = defaultArgv.concat(['org/repo1']);
        await configParser.parseConfigs(defaultEnv, defaultArgv);
        expect(logger.warn).not.toHaveBeenCalledWith(
          'CLI config is overridding the `repositories` config previously set',
        );
      });

      it('does not warn when CLI config has no repositories', async () => {
        fileConfigParser.getConfig.mockResolvedValue({
          repositories: ['org/repo1'],
        });
        await configParser.parseConfigs(defaultEnv, defaultArgv);
        expect(logger.warn).not.toHaveBeenCalledWith(
          'CLI config is overridding the `repositories` config previously set',
        );
      });

      it('does not warn when CLI config has same repositories as file config', async () => {
        fileConfigParser.getConfig.mockResolvedValue({
          repositories: ['org/repo1'],
        });
        defaultArgv = defaultArgv.concat(['org/repo1']);
        await configParser.parseConfigs(defaultEnv, defaultArgv);
        expect(logger.warn).not.toHaveBeenCalledWith(
          'CLI config is overridding the `repositories` config previously set',
        );
      });

      it('warns when CLI overrides repositories with repo-specific configuration', async () => {
        fileConfigParser.getConfig.mockResolvedValue({
          repositories: [
            {
              repository: 'org/simple-repo',
              repositoryCache: 'disabled',
            },
          ],
        });
        defaultArgv = defaultArgv.concat(['org/simple-repo']);
        await configParser.parseConfigs(defaultEnv, defaultArgv);
        expect(logger.warn).toHaveBeenCalledWith(
          'CLI config is overridding the `repositories` config previously set',
        );
      });

      it('does not warn when both values are the same', async () => {
        fileConfigParser.getConfig.mockResolvedValue({
          repositories: ['org/simple-repo'],
        });
        defaultArgv = defaultArgv.concat(['org/simple-repo']);
        await configParser.parseConfigs(defaultEnv, defaultArgv);
        expect(logger.warn).not.toHaveBeenCalledWith(
          'CLI config is overridding the `repositories` config previously set',
        );
      });

      // TODO
      it('warns when both values are effectively the same', async () => {
        fileConfigParser.getConfig.mockResolvedValue({
          repositories: [
            {
              repository: 'org/simple-repo',
            },
          ],
        });
        defaultArgv = defaultArgv.concat(['org/simple-repo']);
        await configParser.parseConfigs(defaultEnv, defaultArgv);
        expect(logger.warn).toHaveBeenCalledWith(
          'CLI config is overridding the `repositories` config previously set',
        );
      });
    });
  });
});
