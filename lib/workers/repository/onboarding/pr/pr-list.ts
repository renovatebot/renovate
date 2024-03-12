import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { emojify } from '../../../../util/emoji';
import { regEx } from '../../../../util/regex';
import type { BranchConfig } from '../../../types';

export function getPrList(
  config: RenovateConfig,
  branches: BranchConfig[],
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
    const prTitleRe = regEx(/@([a-z]+\/[a-z]+)/);
    // TODO #22198
    prDesc += `<details>\n<summary>${branch.prTitle!.replace(
      prTitleRe,
      '@&#8203;$1',
    )}</summary>\n\n`;
    if (branch.schedule?.length) {
      prDesc += `  - Schedule: ${JSON.stringify(branch.schedule)}\n`;
    }
    prDesc += `  - Branch name: \`${branch.branchName}\`\n`;
    prDesc += branch.baseBranch
      ? `  - Merge into: \`${branch.baseBranch}\`\n`
      : '';
    const seen: string[] = [];
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
          // TODO: types (#22198)
          text += `[${upgrade.depName!}](${upgrade.sourceUrl})`;
        } else {
          text += upgrade.depName!.replace(prTitleRe, '@&#8203;$1');
        }
        // TODO: types (#22198)
        text += upgrade.isLockfileUpdate
          ? ` to \`${upgrade.newVersion!}\``
          : ` to \`${upgrade.newDigest ?? upgrade.newValue!}\``;
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
  // TODO: type (#22198)
  const prHourlyLimit = config.prHourlyLimit!;
  if (
    prHourlyLimit > 0 &&
    prHourlyLimit < 5 &&
    prHourlyLimit < branches.length
  ) {
    prDesc += emojify(
      `<br />\n\n:children_crossing: Branch creation will be limited to maximum ${prHourlyLimit} per hour, so it doesn't swamp any CI resources or overwhelm the project. See docs for \`prhourlylimit\` for details.\n\n`,
    );
  }
  return prDesc;
}
