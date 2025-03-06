import is from '@sindresorhus/is';
import JSON5 from 'json5';
import { GlobalConfig } from '../../../config/global';
import type { AllConfig, RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { scm } from '../../../modules/platform/scm';
import { getCache } from '../../../util/cache/repository';
import { readLocalFile } from '../../../util/fs';
import { getBranchCommit } from '../../../util/git';
import { mergeInheritedConfig } from '../init/inherited';
import { detectConfigFile, mergeRenovateConfig } from '../init/merge';
import { extractDependencies } from '../process';
import type { ExtractResult } from '../process/extract-update';
import { ensureReconfigurePrComment } from './pr-comment';
import {
  deleteReconfigureBranchCache,
  setReconfigureBranchCache,
} from './reconfigure-cache';
import { getReconfigureBranchName, setBranchStatus } from './utils';
import { validateReconfigureBranch } from './validate';

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

  // this is something the user initiates, so skip if no branch exists
  if (!branchExists) {
    logger.debug('No reconfigure branch found');
    deleteReconfigureBranchCache(); // in order to remove cache when the branch has been deleted
    return;
  }

  // look for config file
  // 1. check reconfigure branch cache and use the configFileName if it exists
  // 2. checkout reconfigure branch and look for the config file, don't assume default configFileName
  const branchSha = getBranchCommit(reconfigureBranch)!;
  const cache = getCache();
  const reconfigureCache = cache.reconfigureBranchCache;
  // only use valid cached information
  if (
    reconfigureCache?.reconfigureBranchSha === branchSha &&
    reconfigureCache?.extractResult
  ) {
    logger.debug('Skipping validation check as branch sha is unchanged');
    return;
  }

  const {
    config: reconfigureConfig,
    errMessage,
    configFileName,
  } = await getReconfigureConfig(reconfigureBranch);

  if (!reconfigureConfig) {
    await setBranchStatus(reconfigureBranch, errMessage, 'red', context);
    setReconfigureBranchCache(branchSha, false);
    await scm.checkoutBranch(config.defaultBranch!);
    return;
  }

  const isValidConfig = await validateReconfigureBranch(
    config,
    reconfigureConfig,
    configFileName!,
  );

  if (!isValidConfig) {
    await scm.checkoutBranch(config.defaultBranch!);
    return;
  }

  let extractResult: ExtractResult;
  let newConfig = GlobalConfig.set(repoConfig); // file config with only non global options
  newConfig.baseBranch = config.defaultBranch;
  newConfig.repoIsOnboarded = true;
  newConfig.errors = [];
  newConfig.warnings = [];

  try {
    newConfig = await mergeInheritedConfig(newConfig);
    newConfig = await mergeRenovateConfig(newConfig, reconfigureBranch);
    await scm.checkoutBranch(config.defaultBranch!);
    extractResult = await extractDependencies(newConfig, false);
    logger.debug(
      { branchList: extractResult.branchList },
      'Reconfigure extraction',
    );
  } catch (err) {
    logger.debug(
      { err },
      'Error while extracting dependencies using the reconfigure config',
    );
    setReconfigureBranchCache(branchSha, true);
    await scm.checkoutBranch(config.defaultBranch!); // being cautious
    return;
  }

  if (extractResult) {
    // take the extract result and
    // add a comment to the reconfigure pr (if recon pr is not existing, create it and add the comment)
    await ensureReconfigurePrComment(
      newConfig,
      extractResult.packageFiles,
      extractResult.branches,
      reconfigureBranch,
    );
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

async function getReconfigureConfig(branchName: string): Promise<{
  config: RenovateConfig | null;
  errMessage: string;
  configFileName?: string;
}> {
  let errMessage = '';

  await scm.checkoutBranch(branchName);
  const configFileName = await detectConfigFile();

  if (!is.nonEmptyString(configFileName)) {
    logger.warn('No config file found in reconfigure branch');
    errMessage = 'Validation Failed - No config file found';
    return { config: null, errMessage };
  }

  let configFileRaw: string | null = null;
  try {
    configFileRaw = await readLocalFile(configFileName, 'utf8');
  } catch (err) {
    logger.debug({ err }, 'Error while reading config file');
  }

  if (!is.nonEmptyString(configFileRaw)) {
    logger.warn('Empty or invalid config file');
    errMessage = 'Validation Failed - Empty/Invalid config file';
    return { config: null, errMessage, configFileName };
  }

  let configFileParsed: any;
  try {
    configFileParsed = JSON5.parse(configFileRaw);
    // no need to confirm renovate field in package.json we already do it in `detectConfigFile()`
    if (configFileName === 'package.json') {
      configFileParsed = configFileParsed.renovate;
    }
  } catch (err) {
    logger.debug({ err }, 'Error while parsing config file');
    errMessage = 'Validation Failed - Unparsable config file';
    return { config: null, errMessage, configFileName };
  }

  return { config: configFileParsed, errMessage, configFileName };
}
