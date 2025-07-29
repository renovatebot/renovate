import { CronPattern } from 'croner';
import cronstrue from 'cronstrue';
import { emojify } from '../../../../../util/emoji';
import { capitalize } from '../../../../../util/string';
import type { BranchConfig } from '../../../../types';

export function getPrConfigDescription(config: BranchConfig): string {
  let prBody = `\n\n---\n\n### Configuration\n\n`;
  prBody += emojify(`:date: **Schedule**: `);
  prBody +=
    'Branch creation - ' + scheduleToString(config.schedule, config.timezone);
  prBody +=
    ', Automerge - ' +
    scheduleToString(config.automergeSchedule, config.timezone) +
    '.';

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
  let scheduleString = '';
  if (schedule && schedule[0] !== 'at any time') {
    scheduleString =
      getReadableCronSchedule(schedule) ?? `"${String(schedule)}"`;
    if (timezone) {
      scheduleString += ` in timezone ${timezone}`;
    } else {
      scheduleString += ` (UTC)`;
    }
  } else {
    scheduleString += 'At any time (no schedule defined)';
  }
  return scheduleString;
}

/**
 * Return human-readable cron schedule summary if the schedule is a valid cron
 * else return null
 */
function getReadableCronSchedule(scheduleText: string[]): string | null {
  // assuming if one schedule is cron the others in the array will be cron too
  try {
    new CronPattern(scheduleText[0]); // validate cron
    return scheduleText
      .map(
        (cron) =>
          capitalize(
            cronstrue
              .toString(cron, {
                throwExceptionOnParseError: false,
              })
              .replace('Every minute, ', ''),
          ) + ` ( ${cron} )`,
      )
      .join(', ');
  } catch {
    return null;
  }
}
