import { GlobalConfig } from '../../../config/global.ts';
import { applySecretsAndVariablesToConfig } from '../../../config/secrets.ts';
import type { AllConfig, RenovateConfig } from '../../../config/types.ts';
import { logger } from '../../../logger/index.ts';
import { platform } from '../../../modules/platform/index.ts';
import { scm } from '../../../modules/platform/scm.ts';
import { getCache } from '../../../util/cache/repository/index.ts';
import { getBranchCommit } from '../../../util/git/index.ts';
import { mergeInheritedConfig } from '../init/inherited.ts';
import { mergeRenovateConfig } from '../init/merge.ts';
import type { ExtractResult } from '../process/extract-update.ts';
import { extractDependencies } from '../process/index.ts';
import { ensureReconfigurePrComment } from './comment.ts';
import {
  deleteReconfigureBranchCache,
  setReconfigureBranchCache,
} from './reconfigure-cache.ts';
import {
  getReconfigureBranchName,
  getReconfigureConfig,
  setBranchStatus,
} from './utils.ts';
import { validateReconfigureBranch } from './validate.ts';

export async function checkReconfigureBranch(
  config: RenovateConfig,
  repoConfig: AllConfig,
): Promise<void> {
  logger.debug('checkReconfigureBranch()');
  if (GlobalConfig.get('platform') === 'local') {
    logger.debug(
      'Not attempting to reconfigure when running with local platform',
    );
    return;
  }

  const context = config.statusCheckNames?.configValidation;
  const reconfigureBranch = getReconfigureBranchName(config.branchPrefix!);
  const branchExists = await scm.branchExists(reconfigureBranch);

  // this is something the user initiates, skip if no branch exists
  if (!branchExists) {
    logger.debug({ reconfigureBranch }, 'No reconfigure branch found');
    deleteReconfigureBranchCache(); // in order to remove cache when the branch has been deleted
    return;
  }

  const existingPr = await platform.findPr({
    branchName: reconfigureBranch,
    state: 'open',
    includeOtherAuthors: true,
    targetBranch: config.defaultBranch,
  });
  const branchSha = getBranchCommit(reconfigureBranch)!;
  const cache = getCache();
  const reconfigureCache = cache.reconfigureBranchCache;

  // only use valid cached information
  if (reconfigureCache?.reconfigureBranchSha === branchSha) {
    if (!existingPr || reconfigureCache.extractResult) {
      logger.debug('Skipping validation check as branch sha is unchanged');
      return;
    }
  }

  const result = await getReconfigureConfig(reconfigureBranch);

  if (!result.ok) {
    await setBranchStatus(reconfigureBranch, result.errMessage, 'red', context);
    setReconfigureBranchCache(branchSha, false);
    await scm.checkoutBranch(config.defaultBranch!);
    return;
  }

  const isValidConfig = await validateReconfigureBranch(
    config,
    result.config,
    result.configFileName,
    existingPr,
  );

  if (!isValidConfig) {
    logger.debug(
      'Found errors in reconfigure config. Skipping dependencies extraction',
    );
    await scm.checkoutBranch(config.defaultBranch!);
    return;
  }

  if (!existingPr) {
    logger.debug('No reconfigure pr found. Skipping dependencies extraction');
    await scm.checkoutBranch(config.defaultBranch!);
    return;
  }

  let extractResult: ExtractResult | undefined;
  // Recompute config similar to repo config processing
  // Get non-global config from file config
  // Merge it with inherited and static repo config
  // Finally, merge the reconfigure config
  let newConfig = GlobalConfig.set(
    applySecretsAndVariablesToConfig({
      config: repoConfig,
    }),
  );
  newConfig.baseBranch = config.defaultBranch;
  newConfig.repoIsOnboarded = true;
  newConfig.errors = [];
  newConfig.warnings = [];

  try {
    newConfig = await mergeInheritedConfig(newConfig);
    newConfig = await mergeRenovateConfig(newConfig, reconfigureBranch);
    await scm.checkoutBranch(config.defaultBranch!);
    extractResult = await extractDependencies(newConfig, false);
  } catch (err) {
    logger.debug(
      { err },
      'Error while extracting dependencies using the reconfigure config',
    );
    setReconfigureBranchCache(branchSha, true);
    await scm.checkoutBranch(config.defaultBranch!); // being cautious
    return;
  }

  let commentEnsured = false;
  if (extractResult) {
    commentEnsured = await ensureReconfigurePrComment(
      newConfig,
      extractResult.packageFiles,
      extractResult.branches,
      reconfigureBranch,
      existingPr,
    );
  }

  // if comment is not added or updated
  // do not store extractResult in cache so that we re-process the reconfigure branch on next run and do not skip
  // istanbul ignore if: should rarely happen
  if (!commentEnsured) {
    extractResult = undefined;
  }
  await setBranchStatus(
    reconfigureBranch,
    'Validation Successful',
    'green',
    context,
  );
  setReconfigureBranchCache(branchSha, true, extractResult);
  await scm.checkoutBranch(config.defaultBranch!); //being cautious
}
