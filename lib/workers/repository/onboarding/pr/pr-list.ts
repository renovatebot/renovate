import * as util from 'util';
import type { RenovateConfig } from '../../../../config/types';
import { gt } from '../../../../i18n';
import { logger } from '../../../../logger';
import { emojify } from '../../../../util/emoji';
import { regEx } from '../../../../util/regex';
import type { BranchConfig } from '../../../types';

export function getPrList(
  config: RenovateConfig,
  branches: BranchConfig[]
): string {
  logger.debug('getPrList()');
  logger.trace({ config });
  let prDesc = `\n### ${gt.gettext('What to Expect')}\n\n`;
  if (!branches.length) {
    return `${prDesc}${gt.gettext(
      'It looks like your repository dependencies are already up-to-date and no Pull Requests will be necessary right away.'
    )}\n`;
  }
  prDesc +=
    util.format(
      gt.ngettext(
        'With your current configuration, Renovate will create %d Pull Request',
        'With your current configuration, Renovate will create %d Pull Requests',
        branches.length
      ),
      branches.length
    ) + ':\n\n';

  for (const branch of branches) {
    const prTitleRe = regEx(/@([a-z]+\/[a-z]+)/);
    // TODO #7154
    prDesc += `<details>\n<summary>${branch.prTitle!.replace(
      prTitleRe,
      '@&#8203;$1'
    )}</summary>\n\n`;
    if (branch.schedule?.length) {
      prDesc += `  - ${gt.pgettext(
        'onboarding/pr/pr-list',
        'Schedule'
      )}: ${JSON.stringify(branch.schedule)}\n`;
    }
    prDesc += `  - ${gt.pgettext('onboarding/pr/pr-list', 'Branch name')}: \`${
      branch.branchName
    }\`\n`;
    prDesc += branch.baseBranch
      ? `  - ${gt.pgettext('onboarding/pr/pr-list', 'Merge into')}: \`${
          branch.baseBranch
        }\`\n`
      : '';
    const seen: string[] = [];
    for (const upgrade of branch.upgrades) {
      let text = '';
      if (upgrade.updateType === 'lockFileMaintenance') {
        text += `  - ${gt.gettext(
          'Regenerate lock files to use latest dependency versions'
        )}`;
      } else {
        if (upgrade.updateType === 'pin') {
          text += `  - ${gt.pgettext('onboarding/pr/pr-list', 'Pin')} `;
        } else {
          text += `  - ${gt.pgettext('onboarding/pr/pr-list', 'Upgrade')} `;
        }
        if (upgrade.sourceUrl) {
          // TODO: types (#7154)
          text += `[${upgrade.depName!}](${upgrade.sourceUrl})`;
        } else {
          text += upgrade.depName!.replace(prTitleRe, '@&#8203;$1');
        }
        // TODO: types (#7154)
        text += upgrade.isLockfileUpdate
          ? ` ${gt.pgettext(
              'onboarding/pr/pr-list',
              'to'
            )} \`${upgrade.newVersion!}\``
          : ` ${gt.pgettext('onboarding/pr/pr-list', 'to')} \`${
              upgrade.newDigest ?? upgrade.newValue!
            }\``;
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
  // TODO: type (#7154)
  const prHourlyLimit = config.prHourlyLimit!;
  if (
    prHourlyLimit > 0 &&
    prHourlyLimit < 5 &&
    prHourlyLimit < branches.length
  ) {
    prDesc += emojify(
      `<br />\n\n:children_crossing: ${util.format(
        gt.gettext(
          "Branch creation will be limited to maximum %d per hour, so it doesn't swamp any CI resources or spam the project. See docs for `prhourlylimit` for details."
        ),
        prHourlyLimit
      )}\n\n`
    );
  }
  return prDesc;
}
