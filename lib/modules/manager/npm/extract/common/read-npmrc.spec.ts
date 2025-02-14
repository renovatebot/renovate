import { GlobalConfig } from '../../../../../config/global';
import { readLocalFile } from '../../../../../util/fs';
import { readNpmrc } from './read-npmrc';

jest.mock('../../../../../util/fs');
jest.mock('../../../../../config/global');

describe('modules/manager/npm/extract/common/read-npmrc', () => {
  const packageFile = 'package.json';
  const config = {
    npmrc: 'config',
    npmrcMerge: true,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return formatted .npmrc content when both repo and config .npmrc are present', async () => {
    (readLocalFile as jest.Mock).mockResolvedValue('repo');
    (GlobalConfig.get as jest.Mock).mockReturnValue(false);
    const result = await readNpmrc(packageFile, config);
    expect(result).toBe('repo\nconfig\n');
  });

  it('should return config .npmrc content when repo .npmrc is not present', async () => {
    (readLocalFile as jest.Mock).mockResolvedValue(undefined);
    (GlobalConfig.get as jest.Mock).mockReturnValue(false);
    const result = await readNpmrc(packageFile, config);
    expect(result).toBe('config\n');
  });

  it('should return repo .npmrc content when config .npmrc is not present', async () => {
    const configWithoutNpmrc = { npmrcMerge: true };
    (readLocalFile as jest.Mock).mockResolvedValue('repo');
    (GlobalConfig.get as jest.Mock).mockReturnValue(false);
    const result = await readNpmrc(packageFile, configWithoutNpmrc);
    expect(result).toBe('repo\n');
  });

  it('should strip package-lock setting from .npmrc', async () => {
    (readLocalFile as jest.Mock).mockResolvedValue('package-lock=false\nrepo');
    (GlobalConfig.get as jest.Mock).mockReturnValue(false);
    const result = await readNpmrc(packageFile, config);
    expect(result).toBe('repo\nconfig\n');
  });

  it('should strip lines with variables when exposeAllEnv is false', async () => {
    (readLocalFile as jest.Mock).mockResolvedValue('repo\n_auth=${NPM_TOKEN}');
    (GlobalConfig.get as jest.Mock).mockReturnValue(false);
    const result = await readNpmrc(packageFile, config);
    expect(result).toBe('repo\nconfig\n');
  });
});
