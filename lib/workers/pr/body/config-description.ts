import { platform } from '../../../platform';
import { BranchStatus } from '../../../types';
import { emojify } from '../../../util/emoji';
import type { BranchConfig } from '../../types';

export async function getPrConfigDescription(
  config: BranchConfig
): Promise<string> {
  let prBody = `\n\n---\n\n### Configuration\n\n`;
  prBody += emojify(`:date: **Schedule**: `);
  if (
    config.schedule &&
    (config.schedule as never) !== 'at any time' &&
    config.schedule[0] !== 'at any time'
  ) {
    prBody += `"${String(config.schedule)}"`;
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
    if (branchStatus === BranchStatus.red) {
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
  if (config.rebaseWhen === 'behind-base-branch') {
    prBody += 'Whenever PR is behind base branch';
  } else if (config.rebaseWhen === 'never') {
    prBody += 'Never';
  } else {
    prBody += 'Whenever PR becomes conflicted';
  }
  prBody += `, or you tick the rebase/retry checkbox.\n\n`;
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
