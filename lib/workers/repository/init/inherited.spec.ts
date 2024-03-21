import type { RenovateConfig } from '../../../config/types';
import {
  CONFIG_INHERIT_NOT_FOUND,
  CONFIG_INHERIT_PARSE_ERROR,
  CONFIG_VALIDATION,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { platform } from '../../../../test/util';
import { mergeInheritedConfig } from './inherited';


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

    platform.getRawFile.mockClear();
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
    platform.getRawFile.mockRejectedValue(
      new Error('File not found'),
    );
    await expect(mergeInheritedConfig(config)).rejects.toThrow(
      CONFIG_INHERIT_NOT_FOUND,
    );
  });

  it('should return the same config if getting the raw file fails and inheritConfigStrict is false', async () => {
    platform.getRawFile.mockRejectedValue(
      new Error('File not found'),
    );
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
    platform.getRawFile.mockResolvedValue(
      '{"something": "invalid"}',
    );
    await expect(mergeInheritedConfig(config)).rejects.toThrow(
      CONFIG_VALIDATION,
    );
  });

  it('should throw an error if config includes an invalid value', async () => {
    platform.getRawFile.mockResolvedValue(
      '{"onboarding": "invalid"}',
    );
    await expect(mergeInheritedConfig(config)).rejects.toThrow(
      CONFIG_VALIDATION,
    );
  });

  it('should warn if validateConfig returns warnings', async () => {
    platform.getRawFile.mockResolvedValue(
      '{"binarySource": "docker"}',
    );
    const res = await mergeInheritedConfig(config);
    expect(res.binarySource).toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });
});
