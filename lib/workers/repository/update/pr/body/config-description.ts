import { _, ngettext, pgettext } from '../../../../../i18n';
import { emojify } from '../../../../../util/emoji';
import type { BranchConfig } from '../../../../types';
import * as util from 'util';


export function getPrConfigDescription(config: BranchConfig): string {
  let prBody = `\n\n---\n\n### Configuration\n\n`;
  prBody += emojify(`:date: **Schedule**: `);
  prBody +=
    `${pgettext('worker/repository/update/pr/body', 'Branch creation')} - ` +
    scheduleToString(config.schedule, config.timezone);
  prBody +=
    `, ${pgettext('worker/repository/update/pr/body', 'Automerge')} - ` +
    scheduleToString(config.automergeSchedule, config.timezone) +
    '.';

  prBody += '\n\n';
  prBody += emojify(
    `:vertical_traffic_light: **${pgettext(
      'worker/repository/update/pr/body',
      'Automerge'
    )}**: `
  );
  if (config.automerge) {
    prBody += 'Enabled.';
  } else {
    prBody += _(
      'Disabled by config. Please merge this manually once you are satisfied.'
    );
  }
  prBody += '\n\n';
  prBody += emojify(
    `:recycle: **${pgettext(
      'worker/repository/update/pr/body',
      'Rebasing'
    )}**: `
  );
  if (config.rebaseWhen === 'behind-base-branch') {
    prBody += _('Whenever PR is behind base branch');
  } else if (config.rebaseWhen === 'never' || config.stopUpdating) {
    prBody += pgettext('worker/repository/update/pr/body', 'Never');
  } else {
    prBody += _('Whenever PR becomes conflicted');
  }
  prBody += `, ${_('or you tick the rebase/retry checkbox.')}\n\n`;
  if (config.recreateClosed) {
    prBody += emojify(
      // TODO: types (#7154)
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `:ghost: **Immortal**: This PR will be recreated if closed unmerged. Get [config help](${config.productLinks?.help}) if that's undesired.\n\n`
    );
  } else {
    prBody += emojify(
      util.format(
        `:no_bell: **Ignore**: ${ngettext(
          "Close this PR and you won't be reminded about this update again.",
          "Close this PR and you won't be reminded about these updates again.",
          config.upgrades.length
        )}\n\n`
      )
    );
  }
  return prBody;
}

function scheduleToString(
  schedule: string[] | undefined,
  timezone: string | undefined
): string {
  let scheduleString = '';
  if (schedule && schedule[0] !== 'at any time') {
    scheduleString += `"${String(schedule)}"`;
    if (timezone) {
      scheduleString += util.format(_(' in timezone %s'), timezone);
    } else {
      scheduleString += ` (UTC)`;
    }
  } else {
    scheduleString += _('At any time (no schedule defined)');
  }
  return scheduleString;
}
