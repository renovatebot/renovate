import { GlobalConfig } from '../../../config/global.ts';
import { type AllConfig } from '../../../config/types.ts';
import type { Pr } from '../../../modules/platform/index.ts';
import * as _cache from '../../../util/cache/repository/index.ts';
import type { LongCommitSha } from '../../../util/git/types.ts';
import type { BranchConfig } from '../../types.ts';
import * as _inherited from '../init/inherited.ts';
import * as _merge from '../init/merge.ts';
import * as _process from '../process/index.ts';
import * as _prComment from './comment.ts';
import { checkReconfigureBranch } from './index.ts';
import * as _utils from './utils.ts';
import * as _validate from './validate.ts';
import { git, logger, partial, platform, scm } from '~test/util.ts';
import type { RenovateConfig } from '~test/util.ts';

vi.mock('./validate.ts');
vi.mock('./utils.ts');
vi.mock('../../../util/git/index.ts');
vi.mock('../process/index.ts');
vi.mock('./comment.ts');
vi.mock('../init/inherited.ts');
vi.mock('../init/merge.ts');
vi.mock('../../../util/cache/repository/index.ts');

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
      { reconfigureBranch: 'prefix/reconfigure' },
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
    expect(
      validate.validateReconfigureBranch,
    ).not.toHaveBeenCalledExactlyOnceWith();
  });

  it('skips if error while finding reconfigure config', async () => {
    utils.getReconfigureConfig.mockResolvedValue({
      ok: false,
      configFileName: 'renovate.json',
      errMessage: 'error',
    });
    await expect(checkReconfigureBranch(config, repoConfig)).toResolve();
    expect(
      validate.validateReconfigureBranch,
    ).not.toHaveBeenCalledExactlyOnceWith();
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
