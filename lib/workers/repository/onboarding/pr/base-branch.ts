import type { RenovateConfig } from '../../../../config/types';

export function getBaseBranchDesc(config: RenovateConfig): string {
  // Describe base branch only if it's configured
  if (!config.baseBranchPatterns?.length) {
    return '';
  }
  if (config.baseBranchPatterns.length > 1) {
    return `You have configured Renovate to use the following baseBranchPatterns: ${config.baseBranchPatterns
      .map((branch) => `\`${branch}\``)
      .join(', ')}.`;
  }
  return `You have configured Renovate to use branch \`${config.baseBranchPatterns[0]}\` as base branch.\n\n`;
}
