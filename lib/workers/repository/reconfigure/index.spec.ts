import {
  RenovateConfig,
  mocked,
  platform,
  scm,
  git,
  fs,
} from '../../../../test/util';
import { logger } from '../../../logger';
import * as _cache from '../../../util/cache/repository';
import * as _reconfigureCache from './reconfigure-cache';
import { validateReconfigureBranch } from '.';
import type { Pr } from '../../../modules/platform/types';
import { mock } from 'jest-mock-extended';

jest.mock('../../../util/cache/repository');
jest.mock('../../../util/fs');
jest.mock('../../../util/git');
jest.mock('./reconfigure-cache');

const cache = mocked(_cache);

describe('workers/repository/reconfigure/index', () => {
  let config: RenovateConfig = {
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

  //   it('throws if there is an error while finding config file ', async () => {
  //     detectConfigFile.mockResolvedValueOnce(new Error('some error') as never);
  //     await validateReconfigureBranch(config);
  //     expect(logger.error).toHaveBeenCalledWith(
  //       { err: 'some error' },
  //       'Error while searching for config file in reconfigure branch'
  //     );
  //   });

  it('throws error if config file not found', async () => {
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

  // handles .json5
  // handles package.json

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
    scm.getFileList.mockResolvedValueOnce(['renovate.json']);
    fs.readLocalFile.mockResolvedValueOnce(`
        {
            "enabledManagers": ["npm"]
        }
        `);
    platform.getBranchPr.mockResolvedValueOnce(mock<Pr>({ number: 1 }));
    await validateReconfigureBranch(config);
    expect(platform.setBranchStatus).toHaveBeenCalledWith({
      branchName: 'prefix/reconfigure',
      context: 'renovate/config-validation',
      description: 'Validation Successfull',
      state: 'green',
    });
  });

  it('skips validation if cache is valid', async () => {
    cache.getCache.mockReturnValueOnce({
      reconfigureBranchCache: {
        reconfigureBranchSha: 'sha',
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
      description: 'Validation Successfull',
      state: 'green',
    });
  });
});
