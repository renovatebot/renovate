import { emojify } from '../../../../util/emoji';
import { logger } from '../../../../logger';
import { RenovateConfig } from '../../../../config';
import { Upgrade } from '../../../../manager/common';

export interface BranchConfig {
  upgrades: Upgrade[];
  baseBranch?: string;
  branchName: string;
  schedule?: string[];
  prTitle: string;
}

export function getPrList(
  config: RenovateConfig,
  branches: BranchConfig[]
): string {
  logger.debug('getPrList()');
  logger.trace({ config });
  let prDesc = `\n### What to Expect\n\n`;
  if (!branches.length) {
    return `${prDesc}It looks like your repository dependencies are already up-to-date and no Pull Requests will be necessary right away.\n`;
  }
  prDesc += `With your current configuration, Renovate will create ${branches.length} Pull Request`;
  prDesc += branches.length > 1 ? `s:\n\n` : `:\n\n`;

  for (const branch of branches) {
    const prTitleRe = /@([a-z]+\/[a-z]+)/;
    prDesc += `<details>\n<summary>${branch.prTitle.replace(
      prTitleRe,
      '@&#8203;$1'
    )}</summary>\n\n`;
    if (branch.schedule && branch.schedule.length) {
      prDesc += `  - Schedule: ${JSON.stringify(branch.schedule)}\n`;
    }
    prDesc += `  - Branch name: \`${branch.branchName}\`\n`;
    prDesc += branch.baseBranch
      ? `  - Merge into: \`${branch.baseBranch}\`\n`
      : '';
    const seen = [];
    for (const upgrade of branch.upgrades) {
      let text = '';
      if (upgrade.updateType === 'lockFileMaintenance') {
        text += '  - Regenerate lock files to use latest dependency versions';
      } else {
        if (upgrade.updateType === 'pin') {
          text += '  - Pin ';
        } else {
          text += '  - Upgrade ';
        }
        if (upgrade.sourceUrl) {
          text += `[${upgrade.depName}](${upgrade.sourceUrl})`;
        } else {
          text += upgrade.depName.replace(prTitleRe, '@&#8203;$1');
        }
        text += upgrade.isLockfileUpdate
          ? ` to \`${upgrade.toVersion}\``
          : ` to \`${upgrade.newDigest || upgrade.newValue}\``;
        text += '\n';
      }
      if (!seen.includes(text)) {
        prDesc += text;
        seen.push(text);
      }
    }
    prDesc += '\n\n';
    prDesc += '</details>\n\n';
  }
  if (
    config.prHourlyLimit > 0 &&
    config.prHourlyLimit < 5 &&
    config.prHourlyLimit < branches.length
  ) {
    prDesc += emojify(
      `<br />\n\n:children_crossing: Branch creation will be limited to maximum ${config.prHourlyLimit} per hour, so it doesn't swamp any CI resources or spam the project. See docs for \`prhourlylimit\` for details.\n\n`
    );
  }
  return prDesc;
}
