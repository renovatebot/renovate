import is from '@sindresorhus/is';
import JSON5 from 'json5';
import { massageConfig } from '../../../config/massage';
import type { RenovateConfig } from '../../../config/types';
import { validateConfig } from '../../../config/validation';
import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
import { ensureComment } from '../../../modules/platform/comment';
import { scm } from '../../../modules/platform/scm';
import { getCache } from '../../../util/cache/repository';
import { readLocalFile } from '../../../util/fs';
import { getBranchCommit } from '../../../util/git';
import { regEx } from '../../../util/regex';
import { detectConfigFile } from '../init/merge';
import { setReconfigureBranchCache } from './reconfigure-cache';
import { getReconfigureBranchName, setBranchStatus } from './utils';

export async function validateReconfigureBranch(
  config: RenovateConfig,
): Promise<void> {
  logger.debug('validateReconfigureBranch()');

  const context = config.statusCheckNames?.configValidation;
  const branchName = getReconfigureBranchName(config.branchPrefix!);

  // look for config file
  // 1. check reconfigure branch cache and use the configFileName if it exists
  // 2. checkout reconfigure branch and look for the config file, don't assume default configFileName
  const branchSha = getBranchCommit(branchName)!;
  const cache = getCache();
  let configFileName: string | null = null;
  const reconfigureCache = cache.reconfigureBranchCache;
  // only use valid cached information
  if (reconfigureCache?.reconfigureBranchSha === branchSha) {
    logger.debug('Skipping validation check as branch sha is unchanged');
    return;
  }

  if (context) {
    const validationStatus = await platform.getBranchStatusCheck(
      branchName,
      context,
    );

    // if old status check is present skip validation
    if (is.nonEmptyString(validationStatus)) {
      logger.debug(
        'Skipping validation check because status check already exists.',
      );
      return;
    }
  } else {
    logger.debug(
      'Status check is null or an empty string, skipping status check addition.',
    );
  }

  try {
    await scm.checkoutBranch(branchName);
    configFileName = await detectConfigFile();
  } catch (err) {
    logger.error(
      { err },
      'Error while searching for config file in reconfigure branch',
    );
  }

  if (!is.nonEmptyString(configFileName)) {
    logger.warn('No config file found in reconfigure branch');
    await setBranchStatus(
      branchName,
      'Validation Failed - No config file found',
      'red',
      context,
    );
    setReconfigureBranchCache(branchSha, false);
    await scm.checkoutBranch(config.defaultBranch!);
    return;
  }

  let configFileRaw: string | null = null;
  try {
    configFileRaw = await readLocalFile(configFileName, 'utf8');
  } catch (err) {
    logger.error({ err }, 'Error while reading config file');
  }

  if (!is.nonEmptyString(configFileRaw)) {
    logger.warn('Empty or invalid config file');
    await setBranchStatus(
      branchName,
      'Validation Failed - Empty/Invalid config file',
      'red',
      context,
    );
    setReconfigureBranchCache(branchSha, false);
    await scm.checkoutBranch(config.baseBranch!);
    return;
  }

  let configFileParsed: any;
  try {
    configFileParsed = JSON5.parse(configFileRaw);
    // no need to confirm renovate field in package.json we already do it in `detectConfigFile()`
    if (configFileName === 'package.json') {
      configFileParsed = configFileParsed.renovate;
    }
  } catch (err) {
    logger.error({ err }, 'Error while parsing config file');
    await setBranchStatus(
      branchName,
      'Validation Failed - Unparsable config file',
      'red',
      context,
    );
    setReconfigureBranchCache(branchSha, false);
    await scm.checkoutBranch(config.baseBranch!);
    return;
  }

  // perform validation and provide a passing or failing check based on result
  const massagedConfig = massageConfig(configFileParsed);
  const validationResult = await validateConfig('repo', massagedConfig);

  // failing check
  if (validationResult.errors.length > 0) {
    logger.debug(
      { errors: validationResult.errors.map((err) => err.message).join(', ') },
      'Validation Errors',
    );

    const reconfigurePr = await platform.findPr({
      branchName,
      state: 'open',
      includeOtherAuthors: true,
      targetBranch: config.defaultBranch,
    });

    // add comment to reconfigure PR if it exists
    if (reconfigurePr) {
      let body = `There is an error with this repository's Renovate configuration that needs to be fixed.\n\n`;
      body += `Location: \`${configFileName}\`\n`;
      body += `Message: \`${validationResult.errors
        .map((e) => e.message)
        .join(', ')
        .replace(regEx(/`/g), "'")}\`\n`;

      await ensureComment({
        number: reconfigurePr.number,
        topic: 'Action Required: Fix Renovate Configuration',
        content: body,
      });
    }

    await setBranchStatus(branchName, 'Validation Failed', 'red', context);
    setReconfigureBranchCache(branchSha, false);
    await scm.checkoutBranch(config.baseBranch!);
    return;
  }

  // passing check
  await setBranchStatus(branchName, 'Validation Successful', 'green', context);

  setReconfigureBranchCache(branchSha, true);
  await scm.checkoutBranch(config.baseBranch!);
  return;
}
