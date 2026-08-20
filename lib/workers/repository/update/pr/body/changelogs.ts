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

  releaseNotes += `\n\n---\n\n${template.compile(releaseNotesHbs, config, false)}\n\n`;
  releaseNotes = releaseNotes.replace(regEx(/### \[`vv/g), '### [`v');
  releaseNotes = sanitizeMarkdown(releaseNotes);
  releaseNotes = unemojify(releaseNotes);

  return releaseNotes;
}

export const changelogsCommentTopic = 'Release Notes';

/**
 * Used in place of the release notes when they are posted as a PR comment, so
 * that platforms which seed the squash commit message from the PR body don't
 * put the whole changelog into the repository history.
 */
export function getChangelogsCommentNotice(config: BranchConfig): string {
  if (!config.hasReleaseNotes) {
    return '';
  }

  return '\n\n---\n\nRelease notes for this update are in a comment on this PR.\n\n';
}
