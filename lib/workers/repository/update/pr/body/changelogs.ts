import { unemojify } from '../../../../../util/emoji.ts';
import { sanitizeMarkdown } from '../../../../../util/markdown.ts';
import { regEx } from '../../../../../util/regex.ts';
import * as template from '../../../../../util/template/index.ts';
import type { BranchConfig } from '../../../../types.ts';
import releaseNotesHbs from '../changelog/hbs-template.ts';

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
