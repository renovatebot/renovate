import { RenovateConfig } from '../../../config';
import { logger } from '../../../logger';
import { platform } from '../../../platform';

export async function checkBaseBranch(
  config: RenovateConfig
): Promise<RenovateConfig> {
  logger.debug('checkBaseBranch()');
  logger.debug(`config.repoIsOnboarded=${config.repoIsOnboarded}`);
  let error = [];
  let baseBranchSha: string;
  if (config.baseBranch) {
    // Read content and target PRs here
    if (await platform.branchExists(config.baseBranch)) {
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
  }
  return { ...config, errors: config.errors.concat(error), baseBranchSha };
}
