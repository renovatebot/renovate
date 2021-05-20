import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { emojify } from '../../../util/emoji';
import * as template from '../../../util/template';
import type { BranchConfig } from '../../types';

export function getPrNotes(config: BranchConfig): string {
  const notes = [];
  for (const upgrade of config.upgrades) {
    if (is.nonEmptyArray(upgrade.prBodyNotes)) {
      for (const note of upgrade.prBodyNotes) {
        try {
          const res = template.compile(note, upgrade).trim();
          if (res?.length) {
            notes.push(res);
          }
        } catch (err) {
          logger.warn({ note }, 'Error compiling upgrade note');
        }
      }
    }
  }
  const uniqueNotes = [...new Set(notes)];
  return uniqueNotes.join('\n\n') + '\n\n';
}

export function getPrExtraNotes(config: BranchConfig): string {
  let res = '';
  if (config.upgrades.some((upgrade) => upgrade.gitRef)) {
    res += emojify(
      ':abcd: If you wish to disable git hash updates, add `":disableDigestUpdates"` to the extends array in your config.\n\n'
    );
  }

  if (config.updateType === 'lockFileMaintenance') {
    res += emojify(
      ':wrench: This Pull Request updates lock files to use the latest dependency versions.\n\n'
    );
  }

  if (config.isPin) {
    res += emojify(
      `:pushpin: **Important**: Renovate will wait until you have merged this Pin PR before creating any *upgrade* PRs for the affected packages. Add the preset \`:preserveSemverRanges\` to your config if you instead don't wish to pin dependencies.\n\n`
    );
  }

  return res;
}
