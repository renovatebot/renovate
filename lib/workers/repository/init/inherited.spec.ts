import { hostRules, mocked, platform } from '../../../../test/util';
import * as presets_ from '../../../config/presets';
import type { RenovateConfig } from '../../../config/types';
import * as validation from '../../../config/validation';
import {
  CONFIG_INHERIT_NOT_FOUND,
  CONFIG_INHERIT_PARSE_ERROR,
  CONFIG_VALIDATION,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { mergeInheritedConfig } from './inherited';

jest.mock('../../../config/presets');

const presets = mocked(presets_);

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
    await expect(mergeInheritedConfig(config)).rejects.toThrow(
      CONFIG_VALIDATION,
    );
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
    expect(res.binarySource).toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should merge inherited config', async () => {
    platform.getRawFile.mockResolvedValue(
      '{"onboarding":false,"labels":["test"]}',
    );
    const res = await mergeInheritedConfig(config);
    expect(res.labels).toEqual(['test']);
    expect(res.onboarding).toBeFalse();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('should set hostRules from inherited config', async () => {
    platform.getRawFile.mockResolvedValue(
      `{
        "hostRules": [
          {
            "matchHost": "some-host-url",
            "token": "some-token"
          }
        ]
      }`,
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

  it('should apply secrets to inherited config', async () => {
    platform.getRawFile.mockResolvedValue(
      `{
        "hostRules": [
          {
            "matchHost": "some-host-url",
            "token": "{{ secrets.SECRET_TOKEN }}"
          }
        ]
      }`,
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

  it('should resolve presets found in inherited config', async () => {
    platform.getRawFile.mockResolvedValue(
      '{"onboarding":false,"labels":["test"],"extends":[":automergeAll"]}',
    );
    presets.resolveConfigPresets.mockResolvedValue({
      onboarding: false,
      labels: ['test'],
      automerge: true,
    });
    const res = await mergeInheritedConfig(config);
    expect(res.labels).toEqual(['test']);
    expect(res.onboarding).toBeFalse();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      'Resolving presets found in inherited config',
    );
  });

  it('should warn if presets fails validation with warnings', async () => {
    platform.getRawFile.mockResolvedValue(
      '{"onboarding":false,"labels":["test"],"extends":[":automergeAll"]}',
    );
    jest
      .spyOn(validation, 'validateConfig')
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
      onboarding: false,
      labels: ['test'],
      automerge: true,
    });
    const res = await mergeInheritedConfig(config);
    expect(res.binarySource).toBeUndefined();
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
    jest
      .spyOn(validation, 'validateConfig')
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
      labels: ['test'],
      automerge: true,
    });
    await expect(mergeInheritedConfig(config)).rejects.toThrow(
      CONFIG_VALIDATION,
    );
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
    jest.spyOn(validation, 'validateConfig').mockResolvedValue({
      warnings: [],
      errors: [],
    });
    presets.resolveConfigPresets.mockResolvedValue({
      labels: ['test'],
      automerge: true,
      binarySource: 'docker', // global config option: should not be here
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
});
