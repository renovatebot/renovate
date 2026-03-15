import { isNonEmptyArray, isNonEmptyString } from '@sindresorhus/is';
import { massageConfig } from '../../../config/massage.ts';
import { migrateAndValidate } from '../../../config/migrate-validate.ts';
import type { RenovateConfig } from '../../../config/types.ts';
import { logger } from '../../../logger/index.ts';
import { ensureComment } from '../../../modules/platform/comment.ts';
import type { Pr } from '../../../modules/platform/index.ts';
import { platform } from '../../../modules/platform/index.ts';
import { getBranchCommit } from '../../../util/git/index.ts';
import { regEx } from '../../../util/regex.ts';
import { setReconfigureBranchCache } from './reconfigure-cache.ts';
import { getReconfigureBranchName, setBranchStatus } from './utils.ts';

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
    if (isNonEmptyString(validationStatus)) {
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
  const res = await migrateAndValidate({}, massagedConfig);

  // failing check
  if (isNonEmptyArray(res.errors)) {
    logger.debug(
      { errors: res.errors.map((err) => err.message).join(', ') },
      'Validation Errors',
    );

    // add comment to reconfigure PR if it exists
    if (reconfigurePr) {
      let body = `There is an error with this repository's Renovate configuration that needs to be fixed.\n\n`;
      body += `Location: \`${configFileName}\`\n`;
      body += `Message: \`${res.errors
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
