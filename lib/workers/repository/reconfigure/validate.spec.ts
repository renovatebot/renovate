import { mock } from 'vitest-mock-extended';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import type { Pr } from '../../../modules/platform/types';
import * as _cache from '../../../util/cache/repository';
import type { LongCommitSha } from '../../../util/git/types';
import * as _merge from '../init/merge';
import { validateReconfigureBranch } from './validate';
import { fs, git, partial, platform, scm } from '~test/util';
import type { RenovateConfig } from '~test/util';

vi.mock('../../../util/cache/repository');
vi.mock('../../../util/fs');
vi.mock('../init/merge');

const cache = vi.mocked(_cache);
const merge = vi.mocked(_merge);

describe('workers/repository/reconfigure/validate', () => {
  const config: RenovateConfig = {
    branchPrefix: 'prefix/',
    baseBranch: 'base',
    statusCheckNames: partial<RenovateConfig['statusCheckNames']>({
      configValidation: 'renovate/config-validation',
    }),
  };

  beforeEach(() => {
    config.repository = 'some/repo';
    merge.detectConfigFile.mockResolvedValue('renovate.json');
    scm.branchExists.mockResolvedValue(true);
    cache.getCache.mockReturnValue({});
    git.getBranchCommit.mockReturnValue('sha' as LongCommitSha);
    fs.readLocalFile.mockResolvedValue(null);
    platform.getBranchStatusCheck.mockResolvedValue(null);
    GlobalConfig.reset();
  });

  it('logs error if config file search fails', async () => {
    const err = new Error();
    merge.detectConfigFile.mockRejectedValueOnce(err as never);
    await validateReconfigureBranch(config);
    expect(logger.error).toHaveBeenCalledWith(
      { err },
      'Error while searching for config file in reconfigure branch',
    );
  });

  it('throws error if config file not found in reconfigure branch', async () => {
    merge.detectConfigFile.mockResolvedValue(null);
    await validateReconfigureBranch(config);
    expect(logger.warn).toHaveBeenCalledWith(
      'No config file found in reconfigure branch',
    );
  });

  it('logs error if config file is unreadable', async () => {
    const err = new Error();
    fs.readLocalFile.mockRejectedValueOnce(err as never);
    await validateReconfigureBranch(config);
    expect(logger.error).toHaveBeenCalledWith(
      { err },
      'Error while reading config file',
    );
  });

  it('throws error if config file is empty', async () => {
    await validateReconfigureBranch(config);
    expect(logger.warn).toHaveBeenCalledWith('Empty or invalid config file');
  });

  it('throws error if config file content is invalid', async () => {
    fs.readLocalFile.mockResolvedValueOnce(`
        {
            "name":
        }
        `);
    await validateReconfigureBranch(config);
    expect(logger.error).toHaveBeenCalledWith(
      { err: expect.any(Object) },
      'Error while parsing config file',
    );
    expect(platform.setBranchStatus).toHaveBeenCalledWith({
      branchName: 'prefix/reconfigure',
      context: 'renovate/config-validation',
      description: 'Validation Failed - Unparsable config file',
      state: 'red',
    });
  });

  it('handles failed validation', async () => {
    fs.readLocalFile.mockResolvedValueOnce(`
        {
            "enabledManagers": ["docker"]
        }
        `);
    await validateReconfigureBranch(config);
    expect(logger.debug).toHaveBeenCalledWith(
      { errors: expect.any(String) },
      'Validation Errors',
    );
    expect(platform.setBranchStatus).toHaveBeenCalledWith({
      branchName: 'prefix/reconfigure',
      context: 'renovate/config-validation',
      description: 'Validation Failed',
      state: 'red',
    });
  });

  it('adds comment if reconfigure PR exists', async () => {
    fs.readLocalFile.mockResolvedValueOnce(`
        {
            "enabledManagers": ["docker"]
        }
        `);
    platform.findPr.mockResolvedValueOnce(mock<Pr>({ number: 1 }));
    await validateReconfigureBranch(config);
    expect(logger.debug).toHaveBeenCalledWith(
      { errors: expect.any(String) },
      'Validation Errors',
    );
    expect(platform.setBranchStatus).toHaveBeenCalled();
    expect(platform.ensureComment).toHaveBeenCalled();
  });

  it('handles successful validation', async () => {
    const pJson = `
    {
       "renovate": {
        "enabledManagers": ["npm"]
       }
    }
    `;
    merge.detectConfigFile.mockResolvedValue('package.json');
    fs.readLocalFile.mockResolvedValueOnce(pJson).mockResolvedValueOnce(pJson);
    await validateReconfigureBranch(config);
    expect(platform.setBranchStatus).toHaveBeenCalledWith({
      branchName: 'prefix/reconfigure',
      context: 'renovate/config-validation',
      description: 'Validation Successful',
      state: 'green',
    });
  });

  it('skips adding status check if statusCheckNames.configValidation is null', async () => {
    cache.getCache.mockReturnValueOnce({
      reconfigureBranchCache: {
        reconfigureBranchSha: 'new-sha',
        isConfigValid: false,
      },
    });

    await validateReconfigureBranch({
      ...config,
      statusCheckNames: partial<RenovateConfig['statusCheckNames']>({
        configValidation: null,
      }),
    });
    expect(logger.debug).toHaveBeenCalledWith(
      'Status check is null or an empty string, skipping status check addition.',
    );
    expect(platform.setBranchStatus).not.toHaveBeenCalled();
  });

  it('skips adding status check if statusCheckNames.configValidation is empty string', async () => {
    cache.getCache.mockReturnValueOnce({
      reconfigureBranchCache: {
        reconfigureBranchSha: 'new-sha',
        isConfigValid: false,
      },
    });

    await validateReconfigureBranch({
      ...config,
      statusCheckNames: partial<RenovateConfig['statusCheckNames']>({
        configValidation: '',
      }),
    });
    expect(logger.debug).toHaveBeenCalledWith(
      'Status check is null or an empty string, skipping status check addition.',
    );
    expect(platform.setBranchStatus).not.toHaveBeenCalled();
  });

  it('skips validation if cache is valid', async () => {
    cache.getCache.mockReturnValueOnce({
      reconfigureBranchCache: {
        reconfigureBranchSha: 'sha',
        isConfigValid: false,
      },
    });
    await validateReconfigureBranch(config);
    expect(logger.debug).toHaveBeenCalledWith(
      'Skipping validation check as branch sha is unchanged',
    );
  });

  it('skips validation if status check present', async () => {
    cache.getCache.mockReturnValueOnce({
      reconfigureBranchCache: {
        reconfigureBranchSha: 'new_sha',
        isConfigValid: false,
      },
    });
    platform.getBranchStatusCheck.mockResolvedValueOnce('green');
    await validateReconfigureBranch(config);
    expect(logger.debug).toHaveBeenCalledWith(
      'Skipping validation check because status check already exists.',
    );
  });

  it('handles non-default config file', async () => {
    merge.detectConfigFile.mockResolvedValue('.renovaterc');
    fs.readLocalFile.mockResolvedValueOnce(`
        {
            "enabledManagers": ["npm",]
        }
        `);
    await validateReconfigureBranch(config);
    expect(platform.setBranchStatus).toHaveBeenCalledWith({
      branchName: 'prefix/reconfigure',
      context: 'renovate/config-validation',
      description: 'Validation Successful',
      state: 'green',
    });
  });

  it('handles array fields which accept strings', async () => {
    fs.readLocalFile.mockResolvedValueOnce(`
        {
          "packageRules": [
            {
              "description": "test",
              "matchPackageNames": ["pkg"],
              "enabled": false
            }
          ]
        }
        `);
    await validateReconfigureBranch(config);
    expect(platform.setBranchStatus).toHaveBeenCalledWith({
      branchName: 'prefix/reconfigure',
      context: 'renovate/config-validation',
      description: 'Validation Successful',
      state: 'green',
    });
  });
});
