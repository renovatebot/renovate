import { mock } from 'jest-mock-extended';
import {
  RenovateConfig,
  fs,
  git,
  mocked,
  platform,
  scm,
} from '../../../../test/util';
import { logger } from '../../../logger';
import type { Pr } from '../../../modules/platform/types';
import * as _cache from '../../../util/cache/repository';
import * as _merge from '../init/merge';
import { validateReconfigureBranch } from '.';

jest.mock('../../../util/cache/repository');
jest.mock('../../../util/fs');
jest.mock('../../../util/git');
jest.mock('../init/merge');

const cache = mocked(_cache);
const merge = mocked(_merge);

describe('workers/repository/reconfigure/index', () => {
  const config: RenovateConfig = {
    branchPrefix: 'prefix/',
    baseBranch: 'base',
  };

  beforeEach(() => {
    config.repository = 'some/repo';
    merge.detectConfigFile.mockResolvedValue('renovate.json');
    scm.branchExists.mockResolvedValue(true);
    cache.getCache.mockReturnValue({});
    git.getBranchCommit.mockReturnValue('sha');
    fs.readLocalFile.mockResolvedValue(null);
    platform.getBranchPr.mockResolvedValue(null);
    platform.getBranchStatusCheck.mockResolvedValue(null);
  });

  it('no effect on repo with no reconfigure branch', async () => {
    scm.branchExists.mockResolvedValueOnce(false);
    await validateReconfigureBranch(config);
    expect(logger.debug).toHaveBeenCalledWith('No reconfigure branch found');
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
    platform.getBranchPr.mockResolvedValueOnce(mock<Pr>({ number: 1 }));
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
      'Skipping validation check as status check already exists',
    );
  });

  it('handles non-default config file', async () => {
    merge.detectConfigFile.mockResolvedValue('.renovaterc');
    fs.readLocalFile.mockResolvedValueOnce(`
        {
            "enabledManagers": ["npm",]
        }
        `);
    platform.getBranchPr.mockResolvedValueOnce(mock<Pr>({ number: 1 }));
    await validateReconfigureBranch(config);
    expect(platform.setBranchStatus).toHaveBeenCalledWith({
      branchName: 'prefix/reconfigure',
      context: 'renovate/config-validation',
      description: 'Validation Successful',
      state: 'green',
    });
  });
});
