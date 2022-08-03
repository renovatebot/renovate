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

  const countReleaseNodesByRepoName: Record<string, number> = {};

  for (const upgrade of config.upgrades) {
    if (upgrade.hasReleaseNotes && upgrade.repoName) {
      countReleaseNodesByRepoName[upgrade.repoName] =
        (countReleaseNodesByRepoName[upgrade.repoName] || 0) + 1;
    }
  }

  for (const upgrade of config.upgrades) {
    if (upgrade.hasReleaseNotes && upgrade.repoName) {
      // TODO: types (#7154)
      upgrade.releaseNotesSummaryTitle = `${upgrade.repoName}${
        countReleaseNodesByRepoName[upgrade.repoName] > 1
          ? ` (${upgrade.depName!})`
          : ''
      }`;
    }
  }

  releaseNotes +=
    '\n\n---\n\n' + template.compile(releaseNotesHbs, config, false) + '\n\n';
  releaseNotes = releaseNotes.replace(regEx(/### \[`vv/g), '### [`v');
  releaseNotes = sanitizeMarkdown(releaseNotes);
  releaseNotes = unemojify(releaseNotes);

  return releaseNotes;
}
