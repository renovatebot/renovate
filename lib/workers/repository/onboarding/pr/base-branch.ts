import { RenovateConfig } from '../../../../config';

export function getBaseBranchDesc(config: RenovateConfig): string {
  // Describe base branch only if it's configured
  return config.baseBranch
    ? `You have configured Renovate to use branch \`${config.baseBranch}\` as base branch.\n\n`
    : '';
}
