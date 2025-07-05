import { GlobalConfig } from '../../../config/global';
import { type AllConfig } from '../../../config/types';
import type { Pr } from '../../../modules/platform';
import * as _cache from '../../../util/cache/repository';
import type { LongCommitSha } from '../../../util/git/types';
import type { BranchConfig } from '../../types';
import * as _inherited from '../init/inherited';
import * as _merge from '../init/merge';
import * as _process from '../process';
import * as _prComment from './comment';
import * as _utils from './utils';
import * as _validate from './validate';
import { checkReconfigureBranch } from '.';
import { git, logger, partial, platform, scm } from '~test/util';
import type { RenovateConfig } from '~test/util';

vi.mock('./validate');
vi.mock('./utils');
vi.mock('../../../util/git');
vi.mock('../process');
vi.mock('./comment');
vi.mock('../init/inherited');
vi.mock('../init/merge');
vi.mock('../../../util/cache/repository');

const validate = vi.mocked(_validate);
const utils = vi.mocked(_utils);
const process = vi.mocked(_process);
const prComment = vi.mocked(_prComment);
const inherited = vi.mocked(_inherited);
const merge = vi.mocked(_merge);
const cache = vi.mocked(_cache);

describe('workers/repository/reconfigure/index', () => {
  const config = partial<RenovateConfig>({
    branchPrefix: 'prefix/',
    baseBranch: 'base',
    statusCheckNames: partial<RenovateConfig['statusCheckNames']>({
      configValidation: 'config-validation',
    }),
  });
  const repoConfig: AllConfig = {};

  beforeEach(() => {
    GlobalConfig.reset();
    scm.branchExists.mockResolvedValue(true);
    git.getBranchCommit.mockReturnValue('sha1' as LongCommitSha);
    validate.validateReconfigureBranch.mockResolvedValue(true);
    platform.findPr.mockResolvedValue(partial<Pr>({ number: 1 }));
    utils.getReconfigureConfig.mockResolvedValue({
      ok: true,
      configFileName: 'renovate.json',
      config: { labels: ['label'] },
    });
    utils.getReconfigureBranchName.mockReturnValue('prefix/reconfigure');
    process.extractDependencies.mockResolvedValue({
      branches: [partial<BranchConfig>()],
      branchList: ['some-branch'],
      packageFiles: {},
    });
    merge.mergeRenovateConfig.mockResolvedValue(config);
    inherited.mergeInheritedConfig.mockResolvedValue(config);
    cache.getCache.mockReturnValue({});
  });

  it('no effect when running with platform=local', async () => {
    GlobalConfig.set({ platform: 'local' });
    await checkReconfigureBranch(config, repoConfig);
    expect(logger.logger.debug).toHaveBeenCalledWith(
      'Not attempting to reconfigure when running with local platform',
    );
  });

  it('no effect on repo with no reconfigure branch', async () => {
    scm.branchExists.mockResolvedValueOnce(false);
    await checkReconfigureBranch(config, repoConfig);
    expect(logger.logger.debug).toHaveBeenCalledWith(
      'No reconfigure branch found',
    );
  });

  it('skips if reconfigure branch unchanged', async () => {
    cache.getCache.mockReturnValue({
      reconfigureBranchCache: {
        reconfigureBranchSha: 'sha1',
        isConfigValid: true,
        extractResult: {
          branches: [partial<BranchConfig>()],
          branchList: ['some-branch'],
          packageFiles: {},
        },
      },
    });
    await expect(checkReconfigureBranch(config, repoConfig)).toResolve();
    expect(validate.validateReconfigureBranch).not.toHaveBeenCalledWith();
  });

  it('skips if error while finding reconfigure config', async () => {
    utils.getReconfigureConfig.mockResolvedValue({
      ok: false,
      configFileName: 'renovate.json',
      errMessage: 'error',
    });
    await expect(checkReconfigureBranch(config, repoConfig)).toResolve();
    expect(validate.validateReconfigureBranch).not.toHaveBeenCalledWith();
  });

  it('skips if reconfigure config is invalid', async () => {
    validate.validateReconfigureBranch.mockResolvedValue(false);
    await expect(checkReconfigureBranch(config, repoConfig)).toResolve();
    expect(logger.logger.debug).toHaveBeenCalledWith(
      'Found errors in reconfigure config. Skipping dependencies extraction',
    );
  });

  it('validates reconfigure branch and skips extraction if no reconfigure pr', async () => {
    platform.findPr.mockResolvedValue(null);
    await expect(checkReconfigureBranch(config, repoConfig)).toResolve();
    expect(logger.logger.debug).toHaveBeenCalledWith(
      'No reconfigure pr found. Skipping dependencies extraction',
    );
  });

  it('extracts deps and adds comment when branch and reconfigure pr both exist', async () => {
    cache.getCache.mockReturnValue({
      reconfigureBranchCache: {
        reconfigureBranchSha: 'sha1',
        isConfigValid: true,
      },
    });
    await expect(checkReconfigureBranch(config, repoConfig)).toResolve();
    expect(prComment.ensureReconfigurePrComment).toHaveBeenCalled();
  });

  it('skips pr comment if error during deps extraction', async () => {
    process.extractDependencies.mockRejectedValue(new Error());
    await expect(checkReconfigureBranch(config, repoConfig)).toResolve();
    expect(prComment.ensureReconfigurePrComment).not.toHaveBeenCalled();
  });
});
