import { unemojify } from '../../../../../util/emoji';
import { sanitizeMarkdown } from '../../../../../util/markdown';
import { regEx } from '../../../../../util/regex';
import * as template from '../../../../../util/template';
import type { BranchConfig } from '../../../../types';
import releaseNotesHbs from '../changelog/hbs-template';

export function getChangelogs(config: BranchConfig): string {
  let releaseNotes = '';
  if (!config.hasReleaseNotes) {
    return releaseNotes;
  }

  for (const upgrade of config.upgrades) {
    if (upgrade.hasReleaseNotes && upgrade.repoName) {
      upgrade.releaseNotesSummaryTitle = `${
        upgrade.repoName
      } (${upgrade.depName!})`;
    }
  }

  releaseNotes +=
    '\n\n---\n\n' + template.compile(releaseNotesHbs, config, false) + '\n\n';
  releaseNotes = releaseNotes.replace(regEx(/### \[`vv/g), '### [`v');
  releaseNotes = sanitizeMarkdown(releaseNotes);
  releaseNotes = unemojify(releaseNotes);

  return releaseNotes;
}
