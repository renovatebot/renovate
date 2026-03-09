import { mock } from 'vitest-mock-extended';
import type { RenovateConfig } from '~test/util.ts';
import { git, partial, platform } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import type { Pr } from '../../../modules/platform/types.ts';
import type { LongCommitSha } from '../../../util/git/types.ts';
import { validateReconfigureBranch } from './validate.ts';

vi.mock('../../../util/git/index.ts');
vi.mock('../init/merge.ts');

describe('workers/repository/reconfigure/validate', () => {
  const config: RenovateConfig = {
    branchPrefix: 'prefix/',
    baseBranch: 'base',
    defaultBranch: 'base',
    statusCheckNames: partial<RenovateConfig['statusCheckNames']>({
      configValidation: 'renovate/config-validation',
    }),
  };

  const reconfigureConfig = {
    labels: ['foo'],
  };
  const configFileName = 'renovate.json';

  beforeEach(() => {
    config.repository = 'some/repo';
    git.getBranchCommit.mockReturnValue('sha' as LongCommitSha);
    platform.getBranchStatusCheck.mockResolvedValue(null);
    GlobalConfig.reset();
  });

  it('handles failed validation', async () => {
    await validateReconfigureBranch(
      config,
      { ...reconfigureConfig, enabledManagers: ['docker'] },
      configFileName,
      null,
    );

    expect(logger.debug).toHaveBeenCalledWith(
      { errors: expect.any(String) },
      'Validation Errors',
    );
    expect(platform.setBranchStatus).toHaveBeenCalledExactlyOnceWith({
      branchName: 'prefix/reconfigure',
      context: 'renovate/config-validation',
      description: 'Validation Failed',
      state: 'red',
    });
  });

  it('adds comment if reconfigure PR exists', async () => {
    await validateReconfigureBranch(
      config,
      { ...reconfigureConfig, enabledManagers: ['docker'] },
      configFileName,
      mock<Pr>({ number: 1 }),
    );

    expect(logger.debug).toHaveBeenCalledWith(
      { errors: expect.any(String) },
      'Validation Errors',
    );
    expect(platform.setBranchStatus).toHaveBeenCalled();
    expect(platform.ensureComment).toHaveBeenCalled();
  });

  it('handles successful validation', async () => {
    await validateReconfigureBranch(
      config,
      reconfigureConfig,
      configFileName,
      null,
    );
    expect(platform.setBranchStatus).toHaveBeenCalledExactlyOnceWith({
      branchName: 'prefix/reconfigure',
      context: 'renovate/config-validation',
      description: 'Validation Successful',
      state: 'green',
    });
  });

  it('skips adding status check if statusCheckNames.configValidation is null', async () => {
    await validateReconfigureBranch(
      {
        ...config,
        statusCheckNames: partial<RenovateConfig['statusCheckNames']>({
          configValidation: null,
        }),
      },
      reconfigureConfig,
      configFileName,
      null,
    );

    expect(logger.debug).toHaveBeenCalledWith(
      'Status check is null or an empty string, skipping status check addition.',
    );
    expect(platform.setBranchStatus).not.toHaveBeenCalled();
  });

  it('skips adding status check if statusCheckNames.configValidation is empty string', async () => {
    await validateReconfigureBranch(
      {
        ...config,
        statusCheckNames: partial<RenovateConfig['statusCheckNames']>({
          configValidation: '',
        }),
      },
      reconfigureConfig,
      configFileName,
      null,
    );

    expect(logger.debug).toHaveBeenCalledWith(
      'Status check is null or an empty string, skipping status check addition.',
    );
    expect(platform.setBranchStatus).not.toHaveBeenCalled();
  });

  it('skips validation if status check present', async () => {
    platform.getBranchStatusCheck.mockResolvedValueOnce('green');
    await validateReconfigureBranch(
      config,
      reconfigureConfig,
      configFileName,
      null,
    );

    expect(logger.debug).toHaveBeenCalledWith(
      'Skipping validation check because status check already exists.',
    );
  });

  it('handles non-default config file', async () => {
    await validateReconfigureBranch(
      config,
      { ...reconfigureConfig, enabledManagers: ['npm'] },
      configFileName,
      null,
    );
    expect(platform.setBranchStatus).toHaveBeenCalledExactlyOnceWith({
      branchName: 'prefix/reconfigure',
      context: 'renovate/config-validation',
      description: 'Validation Successful',
      state: 'green',
    });
  });

  it('migrates config before validating', async () => {
    await validateReconfigureBranch(
      config,
      { ...reconfigureConfig, baseBranches: ['main'] },
      configFileName,
      null,
    );
    expect(platform.setBranchStatus).toHaveBeenCalledExactlyOnceWith({
      branchName: 'prefix/reconfigure',
      context: 'renovate/config-validation',
      description: 'Validation Successful',
      state: 'green',
    });
  });

  it('handles array fields which accept strings', async () => {
    await validateReconfigureBranch(
      config,
      {
        ...reconfigureConfig,
        packageRules: [
          {
            description: 'test',
            matchPackageNames: ['pkg'],
            enabled: false,
          },
        ],
      },
      configFileName,
      null,
    );
    expect(platform.setBranchStatus).toHaveBeenCalledExactlyOnceWith({
      branchName: 'prefix/reconfigure',
      context: 'renovate/config-validation',
      description: 'Validation Successful',
      state: 'green',
    });
  });
});
