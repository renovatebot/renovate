import { RenovateConfig, ValidationMessage } from '../../../config';
import { logger } from '../../../logger';
import { platform } from '../../../platform';
import { branchExists } from '../../../util/git';

export async function checkBaseBranch(
  config: RenovateConfig
): Promise<RenovateConfig> {
  logger.debug('checkBaseBranch()');
  logger.debug(`config.repoIsOnboarded=${config.repoIsOnboarded}`);
  let error: ValidationMessage[] = [];
  let baseBranchSha: string;
  // Read content and target PRs here
  if (await branchExists(config.baseBranch)) {
    baseBranchSha = await platform.setBaseBranch(config.baseBranch);
  } else {
    // Warn and ignore setting (use default branch)
    const message = `The configured baseBranch "${config.baseBranch}" is not present. Ignoring`;
    error = [
      {
        depName: 'baseBranch',
        message,
      },
    ];
    logger.warn(message);
  }
  return { ...config, errors: config.errors.concat(error), baseBranchSha };
}
