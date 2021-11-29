import type { RenovateConfig } from '../../../../config/types';

export function getBaseBranchDesc(config: RenovateConfig): string {
  // Describe base branch only if it's configured
  if (!config.baseBranches?.length) {
    return '';
  }
  if (config.baseBranches.length > 1) {
    return `You have configured Renovate to use the following baseBranches: ${config.baseBranches
      .map((branch) => `\`${branch}\``)
      .join(', ')}.`;
  }
  return `You have configured Renovate to use branch \`${config.baseBranches[0]}\` as base branch.\n\n`;
}
