import { emojify } from '../../../../../util/emoji.ts';
import { getReadableCronSchedule } from '../../../../../util/schedule.ts';
import type { BranchConfig } from '../../../../types.ts';

export function getPrConfigDescription(config: BranchConfig): string {
  let prBody = `\n\n---\n\n### Configuration\n\n`;
  prBody += emojify(`:date: **Schedule**: `);

  if (config.timezone) {
    prBody += `(in timezone ${config.timezone})`;
  } else {
    prBody += `(UTC)`;
  }
  prBody += '\n\n'; // to ensure that Markdown renderers will note that the Schedule is a different element to the list

  prBody +=
    '- Branch creation\n' +
    scheduleToString(config.schedule, config.timezone) +
    '\n';
  prBody +=
    '- Automerge\n' +
    scheduleToString(config.automergeSchedule, config.timezone) +
    '\n';

  prBody += '\n\n';
  prBody += emojify(':vertical_traffic_light: **Automerge**: ');
  if (config.automerge) {
    prBody += 'Enabled.';
  } else if (config.automergedPreviously) {
    prBody += 'Disabled because a matching PR was automerged previously.';
  } else {
    prBody +=
      'Disabled by config. Please merge this manually once you are satisfied.';
  }
  prBody += '\n\n';
  prBody += emojify(':recycle: **Rebasing**: ');
  if (config.rebaseWhen === 'behind-base-branch') {
    prBody += 'Whenever PR is behind base branch';
  } else if (config.rebaseWhen === 'never' || config.stopUpdating) {
    prBody += 'Never';
  } else {
    prBody += 'Whenever PR becomes conflicted';
  }
  prBody += `, or you tick the rebase/retry checkbox.\n\n`;
  if (config.recreateClosed) {
    prBody += emojify(
      `:ghost: **Immortal**: This PR will be recreated if closed unmerged. Get [config help](${config.productLinks?.help}) if that's undesired.\n\n`,
    );
  } else {
    prBody += emojify(
      `:no_bell: **Ignore**: Close this PR and you won't be reminded about ${
        config.upgrades.length === 1 ? 'this update' : 'these updates'
      } again.\n\n`,
    );
  }
  return prBody;
}

function scheduleToString(
  schedule: string[] | undefined,
  timezone: string | undefined,
): string {
  const scheduleLines = [];
  if (schedule && schedule[0] !== 'at any time') {
    const r = getReadableCronSchedule(schedule);
    if (r) {
      scheduleLines.push(...r);
    } else {
      scheduleLines.push(`"${String(schedule)}"`);
    }
  } else {
    scheduleLines.push('At any time (no schedule defined)');
  }
  return '  - ' + scheduleLines.join('\n  - ');
}
