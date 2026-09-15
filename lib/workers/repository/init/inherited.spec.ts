import { codeBlock } from 'common-tags';
import { hostRules, platform } from '~test/util.ts';
import {
  getConfigFileNames,
  setUserConfigFileNames,
} from '../../../config/app-strings.ts';
import * as decrypt from '../../../config/decrypt.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { InheritConfig } from '../../../config/inherit.ts';
import * as presets_ from '../../../config/presets/index.ts';
import type { RenovateConfig } from '../../../config/types.ts';
import * as validation from '../../../config/validation.ts';
import {
  CONFIG_INHERIT_NOT_FOUND,
  CONFIG_INHERIT_PARSE_ERROR,
  CONFIG_VALIDATION,
} from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { mergeInheritedConfig } from './inherited.ts';

vi.mock('../../../config/presets/index.ts');

const presets = vi.mocked(presets_);

describe('workers/repository/init/inherited', () => {
  let config: RenovateConfig;

  beforeEach(() => {
    config = {
      repository: 'test/repo',
      inheritConfig: true,
      inheritConfigRepoName: 'inherit/repo',
      inheritConfigFileName: 'config.json',
      inheritConfigStrict: false,
    };
    hostRules.clear();
    InheritConfig.reset();
    GlobalConfig.reset();
  });

  it('should return the same config if repository or inheritConfig is not defined', async () => {
    config.repository = undefined;
    const result = await mergeInheritedConfig(config);
    expect(result).toEqual(config);
  });

  it('should return the same config if inheritConfigRepoName or inheritConfigFileName is not a string', async () => {
    config.inheritConfigRepoName = undefined;
    const result = await mergeInheritedConfig(config);
    expect(result).toEqual(config);
  });

  it('should throw an error if getting the raw file fails and inheritConfigStrict is true', async () => {
    config.inheritConfigStrict = true;
    platform.getRawFile.mockRejectedValue(new Error('File not found'));
    await expect(mergeInheritedConfig(config)).rejects.toThrow(
      CONFIG_INHERIT_NOT_FOUND,
    );
  });

  it('should return the same config if getting the raw file fails and inheritConfigStrict is false', async () => {
    platform.getRawFile.mockRejectedValue(new Error('File not found'));
    const result = await mergeInheritedConfig(config);
    expect(result).toEqual(config);
  });

  it('should throw an error if parsing the inherited config fails', async () => {
    platform.getRawFile.mockResolvedValue('invalid json');
    await expect(mergeInheritedConfig(config)).rejects.toThrow(
      CONFIG_INHERIT_PARSE_ERROR,
    );
  });

  it('should throw an error if config includes an invalid option', async () => {
    platform.getRawFile.mockResolvedValue('{"something": "invalid"}');

    // the detail names the inherited config, which the repository's owners may be unable to see, let alone fix
    await expect(mergeInheritedConfig(config)).rejects.toMatchObject({
      message: CONFIG_VALIDATION,
      validationSource: 'Inherited config (`config.json` in `inherit/repo`)',
      validationError: 'The inherited config contains some invalid settings',
      validationMessage: 'Invalid configuration option: something',
    });
  });

  it('should throw an error if config includes an invalid value', async () => {
    platform.getRawFile.mockResolvedValue('{"onboarding": "invalid"}');
    await expect(mergeInheritedConfig(config)).rejects.toThrow(
      CONFIG_VALIDATION,
    );
  });

  it('should warn if validateConfig returns warnings', async () => {
    platform.getRawFile.mockResolvedValue('{"binarySource": "docker"}');
    const res = await mergeInheritedConfig(config);
    expect(res).not.toContainKey('binarySource');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should merge inherited config', async () => {
    platform.getRawFile.mockResolvedValue(
      '{"onboarding":false,"labels":["test"]}',
    );
    const res = await mergeInheritedConfig(config);
    expect(res.labels).toEqual(['test']);
    expect(InheritConfig.get('onboarding')).toBeFalse();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should set hostRules from inherited config', async () => {
    platform.getRawFile.mockResolvedValue(
      codeBlock`
        {
                "hostRules": [
                  {
                    "matchHost": "some-host-url",
                    "token": "some-token"
                  }
                ]
              }
      `,
    );
    const res = await mergeInheritedConfig(config);
    expect(hostRules.getAll()).toMatchObject([
      {
        matchHost: 'some-host-url',
        token: 'some-token',
      },
    ]);
    expect(res.hostRules).toBeUndefined();
  });

  it('should decrypt encrypted values from inherited config', async () => {
    platform.getRawFile.mockResolvedValue(
      codeBlock`
        {
                "hostRules": [
                  {
                    "matchHost": "some-host-url",
                    "encrypted": {
                      "token": "some-secret-token"
                    }
                  }
                ]
              }
      `,
    );

    vi.spyOn(decrypt, 'decryptConfig').mockResolvedValueOnce({
      hostRules: [
        {
          matchHost: 'some-host-url',
          token: 'some-secret-token',
        },
      ],
    });

    const res = await mergeInheritedConfig({
      ...config,
    });
    expect(hostRules.getAll()).toMatchObject([
      {
        matchHost: 'some-host-url',
        token: 'some-secret-token',
      },
    ]);
    expect(res.hostRules).toBeUndefined();
  });

  it('should apply secrets to inherited config', async () => {
    platform.getRawFile.mockResolvedValue(
      codeBlock`
        {
                "hostRules": [
                  {
                    "matchHost": "some-host-url",
                    "token": "{{ secrets.SECRET_TOKEN }}"
                  }
                ]
              }
      `,
    );
    const res = await mergeInheritedConfig({
      ...config,
      secrets: { SECRET_TOKEN: 'some-secret-token' },
    });
    expect(hostRules.getAll()).toMatchObject([
      {
        matchHost: 'some-host-url',
        token: 'some-secret-token',
      },
    ]);
    expect(res.hostRules).toBeUndefined();
  });

  describe('hostRules trust tier', () => {
    const credentialedRule = codeBlock`
      {
        "hostRules": [
          {
            "matchHost": "https://internal.example.com/",
            "token": "some-token"
          }
        ]
      }
    `;

    const grantingRule = codeBlock`
      {
        "hostRules": [
          {
            "matchHost": "https://internal.example.com/",
            "allowInternal": true
          }
        ]
      }
    `;

    it('registers inherited hostRules as untrusted by default', async () => {
      platform.getRawFile.mockResolvedValue(credentialedRule);

      await mergeInheritedConfig(config);

      expect(hostRules.getAll()).toEqual([
        {
          matchHost: 'https://internal.example.com/',
          resolvedHost: 'internal.example.com',
          token: 'some-token',
          trustTier: 'untrusted',
        },
      ]);
      expect(
        hostRules.find({ url: 'https://internal.example.com/api' }),
      ).toEqual({ token: 'some-token' });
    });

    it('refuses allowInternal in inherited config, saying how to permit it', async () => {
      platform.getRawFile.mockResolvedValue(grantingRule);

      await expect(mergeInheritedConfig(config)).rejects.toMatchObject({
        message: CONFIG_VALIDATION,
        validationSource: 'Inherited config (`config.json` in `inherit/repo`)',
        validationError: 'The inherited config contains some invalid settings',
        validationMessage:
          'hostRules `allowInternal` is not allowed in inherited config, as this Renovate instance has not set `inheritConfigTrusted=true`. The administrator can either set it, or move the rule to their global config or a `repositories[]` entry.',
      });
    });

    it('registers inherited hostRules in the inherit tier when trusted', async () => {
      GlobalConfig.set({ inheritConfigTrusted: true });
      platform.getRawFile.mockResolvedValue(credentialedRule);

      await mergeInheritedConfig(config);

      expect(hostRules.getAll()).toEqual([
        {
          matchHost: 'https://internal.example.com/',
          resolvedHost: 'internal.example.com',
          token: 'some-token',
          trustTier: 'inherit',
        },
      ]);
      // the credentialed rule now implicitly permits the internal host it names
      expect(
        hostRules.find({ url: 'https://internal.example.com/api' }),
      ).toEqual({
        token: 'some-token',
        internalHostGrant: { implicit: true },
      });
    });

    it('accepts allowInternal in inherited config when trusted', async () => {
      GlobalConfig.set({ inheritConfigTrusted: true });
      platform.getRawFile.mockResolvedValue(grantingRule);

      await mergeInheritedConfig(config);

      expect(
        hostRules.find({ url: 'https://internal.example.com/api' })
          .internalHostGrant,
      ).toEqual({ explicit: true, scoped: true, implicit: true });
    });

    it('registers hostRules from inherited presets in the inherit tier when trusted', async () => {
      GlobalConfig.set({ inheritConfigTrusted: true });
      platform.getRawFile.mockResolvedValue(
        '{"extends":["local>org/renovate-config"]}',
      );
      presets.resolveConfigPresets.mockResolvedValue({
        config: {
          hostRules: [
            { matchHost: 'https://internal.example.com/', allowInternal: true },
          ],
        },
        visitedPresets: {
          merged: [],
          unmerged: [],
        },
      });

      await mergeInheritedConfig(config);

      expect(
        hostRules.find({ url: 'https://internal.example.com/api' })
          .internalHostGrant,
      ).toEqual({ explicit: true, scoped: true, implicit: true });
    });
  });

  it('should resolve presets found in inherited config', async () => {
    platform.getRawFile.mockResolvedValue(
      '{"onboarding":false,"labels":["test"],"extends":[":automergeAll"]}',
    );
    presets.resolveConfigPresets.mockResolvedValue({
      config: {
        onboarding: false,
        labels: ['test'],
        automerge: true,
      },
      visitedPresets: {
        merged: [],
        unmerged: [],
      },
    });
    const res = await mergeInheritedConfig(config);
    expect(res.labels).toEqual(['test']);
    expect(InheritConfig.get('onboarding')).toBeFalse();
    expect(logger.warn).not.toHaveBeenCalled();

    expect(logger.debug).toHaveBeenCalledWith(
      'Resolving presets found in inherited config',
    );
  });

  it('should warn if presets fails validation with warnings', async () => {
    platform.getRawFile.mockResolvedValue(
      '{"onboarding":false,"labels":["test"],"extends":[":automergeAll"]}',
    );
    vi.spyOn(validation, 'validateConfig')
      .mockResolvedValueOnce({
        warnings: [],
        errors: [],
      })
      .mockResolvedValueOnce({
        warnings: [
          {
            message: 'some warning',
            topic: 'Configuration Error',
          },
        ],
        errors: [],
      });
    presets.resolveConfigPresets.mockResolvedValue({
      config: {
        onboarding: false,
        labels: ['test'],
        automerge: true,
      },
      visitedPresets: {
        merged: [],
        unmerged: [],
      },
    });
    const res = await mergeInheritedConfig(config);
    expect(res).not.toContainKey('binarySource');

    expect(logger.warn).toHaveBeenCalledWith(
      {
        warnings: [
          {
            message: 'some warning',
            topic: 'Configuration Error',
          },
        ],
      },
      'Found warnings in presets inside the inherited configuration.',
    );
  });

  it('should throw error if presets fails validation with errors', async () => {
    platform.getRawFile.mockResolvedValue(
      '{"labels":["test"],"extends":[":automergeAll"]}',
    );
    vi.spyOn(validation, 'validateConfig')
      .mockResolvedValueOnce({
        warnings: [],
        errors: [],
      })
      .mockResolvedValueOnce({
        warnings: [],
        errors: [
          {
            message: 'some error',
            topic: 'Configuration Error',
          },
        ],
      });
    presets.resolveConfigPresets.mockResolvedValue({
      config: {
        labels: ['test'],
        automerge: true,
      },
      visitedPresets: {
        merged: [],
        unmerged: [],
      },
    });
    await expect(mergeInheritedConfig(config)).rejects.toMatchObject({
      message: CONFIG_VALIDATION,
      validationSource: 'Inherited config (`config.json` in `inherit/repo`)',
      validationError: 'The inherited config contains some invalid settings',
      validationMessage: 'some error',
    });

    expect(logger.warn).toHaveBeenCalledWith(
      {
        errors: [
          {
            message: 'some error',
            topic: 'Configuration Error',
          },
        ],
      },
      'Found errors in presets inside the inherited configuration.',
    );
  });

  it('should remove global config from presets found in inherited config', async () => {
    platform.getRawFile.mockResolvedValue(
      '{"labels":["test"],"extends":[":automergeAll"]}',
    );
    vi.spyOn(validation, 'validateConfig').mockResolvedValue({
      warnings: [],
      errors: [],
    });
    presets.resolveConfigPresets.mockResolvedValue({
      config: {
        labels: ['test'],
        automerge: true,
        binarySource: 'docker', // global config option: should not be here
      },
      visitedPresets: {
        merged: [],
        unmerged: [],
      },
    });
    const res = await mergeInheritedConfig(config);
    expect(res.labels).toEqual(['test']);
    expect(logger.warn).not.toHaveBeenCalled();

    expect(logger.debug).toHaveBeenCalledWith(
      {
        inheritedConfig: {
          labels: ['test'],
          automerge: true,
          binarySource: 'docker',
        },
        filteredConfig: {
          labels: ['test'],
          automerge: true,
        },
      },
      'Removed global config from inherited config presets.',
    );
  });

  it('overwrites configFileNames set by admin config', async () => {
    config.inheritConfigFileName = 'some-other-file.json';
    // imitate setting of configFileNames by admin config
    setUserConfigFileNames(['some-file.json']);
    platform.getRawFile.mockResolvedValue(
      '{"onboarding":false,"labels":["test"],"configFileNames":["some-other-file.json"]}',
    );
    const res = await mergeInheritedConfig(config);
    expect(res.labels).toEqual(['test']);
    expect(InheritConfig.get('onboarding')).toBeFalse();
    expect(getConfigFileNames()[0]).toBe('some-other-file.json');
  });

  it('does not modify configFileNames set by admin config if configFileNames is not present in inherited config', async () => {
    config.inheritConfigFileName = 'some-other-file.json';
    // imitate setting of configFileNames by admin config
    setUserConfigFileNames(['some-file.json']);
    platform.getRawFile.mockResolvedValue(
      '{"onboarding":false,"labels":["test"]}',
    );
    const res = await mergeInheritedConfig(config);
    expect(res.labels).toEqual(['test']);
    expect(InheritConfig.get('onboarding')).toBeFalse();
    expect(getConfigFileNames()[0]).toBe('some-file.json');
  });
});
