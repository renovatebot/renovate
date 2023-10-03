import JSON5 from 'json5';
import upath from 'upath';
import type { RenovateConfig } from '../../../config/types';
import { validateConfig } from '../../../config/validation';
import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
import { scm } from '../../../modules/platform/scm';
import { getCache } from '../../../util/cache/repository';
import { readLocalFile } from '../../../util/fs';
import { getBranchCommit } from '../../../util/git';
import { detectConfigFile } from '../init/merge';
import {
  deleteReconfigureBranchCache,
  setReconfigureBranchCache,
} from './reconfigure-cache';
import { ensureComment } from '../../../modules/platform/comment';
import { regEx } from '../../../util/regex';
import is from '@sindresorhus/is';

export async function validateReconfigureBranch(
  config: RenovateConfig
): Promise<void> {
  logger.debug('validateReconfigureBranch()');
  const context = `renovate/config-validation`;

  const branchName = `${config.branchPrefix}reconfigure`;
  const branchExists = await scm.branchExists(branchName);

  // this is something, the user initiates so skip if no branch exists
  if (!branchExists) {
    logger.debug('No reconfigure branch found');
    deleteReconfigureBranchCache(); // inorder to remove cache when the branch deleted
    return;
  }

  // look for config file
  // 1. check reconfigure branch cache and use the conifgFileName if it exists
  // 2. checkout reconfigure branch and look for the config file, don't assume default config fileName
  const branchSha = getBranchCommit(branchName);
  const cache = getCache();
  let configFileName: string | null = null;
  const reconfigureCache = cache.reconfigureBranchCache;

  // only use cached information if it is valid
  if (reconfigureCache?.reconfigureBranchSha === branchSha) {
    logger.debug('Cache is valid. Skipping validation check');
    return;
  }

  try {
    await scm.checkoutBranch(branchName);
    configFileName = await detectConfigFile();
  } catch (err) {
    /*istanbul ignore next - should never happen*/
    logger.error(
      { err },
      'Error while searching for config file in reconfigure branch'
    );
    return;
  }

  if (!is.nonEmptyString(configFileName)) {
    logger.warn('No config file found in reconfigure branch');
    await platform.setBranchStatus({
      branchName,
      context,
      description: 'Validation Failed - No config file found',
      state: 'red',
    });
    await scm.checkoutBranch(config.baseBranch!);
    return;
  }

  let configFileRaw: string | null = null;
  try {
    configFileRaw = await readLocalFile(configFileName, 'utf8');
  } catch (err) {
    /*istanbul ignore next - should never happen*/
    logger.error('Error while reading config file');
  }

  if (!is.nonEmptyString(configFileRaw)) {
    logger.warn('Empty or invalid config file');
    await platform.setBranchStatus({
      branchName,
      context,
      description: 'Validation Failed - Empty/Invalid config file',
      state: 'red',
    });
    setReconfigureBranchCache(branchSha!, configFileName, false);
    await scm.checkoutBranch(config.baseBranch!);
    return;
  }

  // eslint-disable-next-line
  console.log('configFileRaw', configFileRaw);
  let configFileParsed: any;
  try {
    const fileType = upath.extname(configFileName);
    // eslint-disable-next-line
    console.log('fileType', fileType);
    if (fileType === '.json') {
      configFileParsed = JSON.parse(configFileRaw!);
      // eslint-disable-next-line
      console.log('configFileParsed', configFileParsed);
      // no need to confirm renovate field in package.json we already do it in `detectConfigFile()`
      if (configFileName === 'package.json') {
        configFileParsed = configFileParsed.renovate;
      }
    } else {
      configFileParsed = JSON5.parse(configFileRaw!);
    }
  } catch (err) {
    logger.error({ err }, 'Error while reading config file');
    await scm.checkoutBranch(config.baseBranch!);
    return;
  }

  // perform validation and provide a passing or failing check run based on result
  const validationResult = await validateConfig(configFileParsed);

  // failing check
  if (validationResult.errors.length > 0) {
    // add code to post a PR comment after checking pr exists

    const branchPr = await platform.getBranchPr(branchName, config.baseBranch);
    if (branchPr) {
      let body = `There is an error with this repository's Renovate configuration that needs to be fixed.\n\n`;
      body += `Location: \`${configFileName}\`\n`;
      body += `Message: \`${validationResult.errors
        .map((e) => e.message)
        .join(', ')
        .replace(regEx(/`/g), "'")}\`\n`;

      await ensureComment({
        number: branchPr.number,
        topic: 'Action Required: Fix Renovate Configuration',
        content: body,
      });
    }
    // log the erros in all cases too
    logger.debug(
      { errors: validationResult.errors.join(', ') },
      'Validation Errors'
    );
    await platform.setBranchStatus({
      branchName,
      context,
      description: 'Validation Failed',
      state: 'red',
    });
    setReconfigureBranchCache(branchSha!, configFileName, false);
    await scm.checkoutBranch(config.baseBranch!);
    return;
  }

  // passing check
  await platform.setBranchStatus({
    branchName,
    context,
    description: 'Validation Successfull',
    state: 'green',
  });
  setReconfigureBranchCache(branchSha!, configFileName, true);

  await scm.checkoutBranch(config.baseBranch!);
}
