import { platform } from '../../../platform';
import { emojify } from '../../../util/emoji';
import { PrBodyConfig } from './common';

export async function getPrConfigDescription(
  config: PrBodyConfig
): Promise<string> {
  let prBody = `\n\n---\n\n### Renovate configuration\n\n`;
  prBody += emojify(`:date: **Schedule**: `);
  if (
    config.schedule &&
    (config.schedule as never) !== 'at any time' &&
    config.schedule[0] !== 'at any time'
  ) {
    prBody += `"${config.schedule}"`;
    if (config.timezone) {
      prBody += ` in timezone ${config.timezone}.`;
    } else {
      prBody += ` (UTC).`;
    }
  } else {
    prBody += 'At any time (no schedule defined).';
  }

  prBody += '\n\n';
  prBody += emojify(':vertical_traffic_light: **Automerge**: ');
  if (config.automerge) {
    const branchStatus = await platform.getBranchStatus(
      config.branchName,
      config.requiredStatusChecks
    );
    // istanbul ignore if
    if (branchStatus === 'failed') {
      prBody += 'Disabled due to failing status checks.';
    } else {
      prBody += 'Enabled.';
    }
  } else {
    prBody +=
      'Disabled by config. Please merge this manually once you are satisfied.';
  }
  prBody += '\n\n';
  prBody += emojify(':recycle: **Rebasing**: ');
  if (config.rebaseStalePrs) {
    prBody += 'Whenever PR is stale';
  } else {
    prBody += 'Whenever PR becomes conflicted';
  }
  if (config.platform === 'github') {
    prBody += `, or if you modify the PR title to begin with "\`rebase!\`".\n\n`;
  } else {
    prBody += '.\n\n';
  }
  if (config.recreateClosed) {
    prBody += emojify(
      `:ghost: **Immortal**: This PR will be recreated if closed unmerged. Get [config help](${config.productLinks.help}) if that's undesired.\n\n`
    );
  } else {
    prBody += emojify(
      `:no_bell: **Ignore**: Close this PR and you won't be reminded about ${
        config.upgrades.length === 1 ? 'this update' : 'these updates'
      } again.\n\n`
    );
  }
  return prBody;
}
