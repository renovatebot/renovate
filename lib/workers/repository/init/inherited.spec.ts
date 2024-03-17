import type { RenovateConfig } from '../../../config/types';
import {
  CONFIG_INHERIT_NOT_FOUND,
  CONFIG_INHERIT_PARSE_ERROR,
  CONFIG_VALIDATION,
} from '../../../constants/error-messages';
import { platform } from '../../../modules/platform';
import { mergeInheritedConfig } from './inherited';

jest.mock('../../../modules/platform');

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

    (platform.getRawFile as jest.Mock).mockClear();
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
    (platform.getRawFile as jest.Mock).mockRejectedValue(
      new Error('File not found'),
    );
    await expect(mergeInheritedConfig(config)).rejects.toThrow(
      CONFIG_INHERIT_NOT_FOUND,
    );
  });

  it('should return the same config if getting the raw file fails and inheritConfigStrict is false', async () => {
    (platform.getRawFile as jest.Mock).mockRejectedValue(
      new Error('File not found'),
    );
    const result = await mergeInheritedConfig(config);
    expect(result).toEqual(config);
  });

  it('should throw an error if parsing the inherited config fails', async () => {
    (platform.getRawFile as jest.Mock).mockResolvedValue('invalid json');
    await expect(mergeInheritedConfig(config)).rejects.toThrow(
      CONFIG_INHERIT_PARSE_ERROR,
    );
  });
});
