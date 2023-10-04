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
import { validateReconfigureBranch } from '.';

jest.mock('../../../util/cache/repository');
jest.mock('../../../util/fs');
jest.mock('../../../util/git');

const cache = mocked(_cache);

describe('workers/repository/reconfigure/index', () => {
  const config: RenovateConfig = {
    branchPrefix: 'prefix/',
    baseBranch: 'base',
  };

  beforeEach(() => {
    config.repository = 'some/repo';
    scm.getFileList.mockResolvedValue([]);
    scm.branchExists.mockResolvedValue(true);
    cache.getCache.mockReturnValue({});
    git.getBranchCommit.mockReturnValue('sha');
    fs.readLocalFile.mockResolvedValue(null);
    platform.getBranchPr.mockResolvedValue(null);
  });

  it('no effect on repo with no reconfigure branch', async () => {
    scm.branchExists.mockResolvedValueOnce(false);
    await validateReconfigureBranch(config);
    expect(logger.debug).toHaveBeenCalledWith('No reconfigure branch found');
  });

  it('throws error if config file not found in reconfigure branch', async () => {
    await validateReconfigureBranch(config);
    expect(logger.warn).toHaveBeenCalledWith(
      'No config file found in reconfigure branch'
    );
  });

  it('throws error if config file is empty', async () => {
    scm.getFileList.mockResolvedValueOnce(['renovate.json']);
    await validateReconfigureBranch(config);
    expect(logger.warn).toHaveBeenCalledWith('Empty or invalid config file');
  });

  it('throws error config file content is invalid', async () => {
    scm.getFileList.mockResolvedValueOnce(['renovate.json']);
    fs.readLocalFile.mockResolvedValueOnce(`
        {
            "name":
        }
        `);
    await validateReconfigureBranch(config);
    expect(logger.error).toHaveBeenCalledWith(
      { err: expect.any(Object) },
      'Error while reading config file'
    );
  });

  it('handles failed validation', async () => {
    scm.getFileList.mockResolvedValueOnce(['renovate.json']);
    fs.readLocalFile.mockResolvedValueOnce(`
        {
            "enabledManagers": ["docker"]
        }
        `);
    await validateReconfigureBranch(config);
    expect(logger.debug).toHaveBeenCalledWith(
      { errors: expect.any(String) },
      'Validation Errors'
    );
    expect(platform.setBranchStatus).toHaveBeenCalledWith({
      branchName: 'prefix/reconfigure',
      context: 'renovate/config-validation',
      description: 'Validation Failed',
      state: 'red',
    });
  });

  it('adds comment if reconfigure PR exists', async () => {
    scm.getFileList.mockResolvedValueOnce(['renovate.json']);
    fs.readLocalFile.mockResolvedValueOnce(`
        {
            "enabledManagers": ["docker"]
        }
        `);
    platform.getBranchPr.mockResolvedValueOnce(mock<Pr>({ number: 1 }));
    await validateReconfigureBranch(config);
    expect(logger.debug).toHaveBeenCalledWith(
      { errors: expect.any(String) },
      'Validation Errors'
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
    scm.getFileList.mockResolvedValueOnce(['package.json']);
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
      'Cache is valid. Skipping validation check'
    );
  });

  it('handles non-default config file', async () => {
    scm.getFileList.mockResolvedValueOnce(['.renovaterc']);
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
