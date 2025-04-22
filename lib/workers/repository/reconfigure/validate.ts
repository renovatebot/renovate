import is from '@sindresorhus/is';
import { massageConfig } from '../../../config/massage';
import type { RenovateConfig } from '../../../config/types';
import { validateConfig } from '../../../config/validation';
import { logger } from '../../../logger';
import type { Pr } from '../../../modules/platform';
import { platform } from '../../../modules/platform';
import { ensureComment } from '../../../modules/platform/comment';
import { getBranchCommit } from '../../../util/git';
import { regEx } from '../../../util/regex';
import { setReconfigureBranchCache } from './reconfigure-cache';
import { getReconfigureBranchName, setBranchStatus } from './utils';

export async function validateReconfigureBranch(
  config: RenovateConfig,
  reconfigureConfig: RenovateConfig,
  configFileName: string,
  reconfigurePr: Pr | null,
): Promise<boolean> {
  logger.debug('validateReconfigureBranch()');

  const context = config.statusCheckNames?.configValidation;
  const branchName = getReconfigureBranchName(config.branchPrefix!);
  const branchSha = getBranchCommit(branchName)!;

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
      return validationStatus === 'green';
    }
  } else {
    logger.debug(
      'Status check is null or an empty string, skipping status check addition.',
    );
  }

  // perform validation and provide a passing or failing check based on result
  const massagedConfig = massageConfig(reconfigureConfig);
  const validationResult = await validateConfig('repo', massagedConfig);

  // failing check
  if (validationResult.errors.length > 0) {
    logger.debug(
      { errors: validationResult.errors.map((err) => err.message).join(', ') },
      'Validation Errors',
    );

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
    return false;
  }

  // passing check
  await setBranchStatus(branchName, 'Validation Successful', 'green', context);
  return true;
}
