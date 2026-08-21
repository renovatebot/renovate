import { unemojify } from '../../../../../util/emoji.ts';
import { sanitizeMarkdown } from '../../../../../util/markdown.ts';
import { regEx } from '../../../../../util/regex.ts';
import * as template from '../../../../../util/template/index.ts';
import type { BranchConfig } from '../../../../types.ts';
import releaseNotesHbs from '../changelog/hbs-template.ts';

function renderChangelogs(config: BranchConfig): string {
  for (const upgrade of config.upgrades) {
    if (upgrade.hasReleaseNotes && upgrade.repoName) {
      upgrade.releaseNotesSummaryTitle = `${
        upgrade.repoName
      } (${upgrade.depName!})`;
    }
  }

  let releaseNotes = template.compile(releaseNotesHbs, config, false);
  releaseNotes = releaseNotes.replace(regEx(/### \[`vv/g), '### [`v');
  releaseNotes = sanitizeMarkdown(releaseNotes);
  releaseNotes = unemojify(releaseNotes);

  return releaseNotes;
}

export function getChangelogs(config: BranchConfig): string {
  if (!config.hasReleaseNotes) {
    return '';
  }

  return `\n\n---\n\n${renderChangelogs(config)}\n\n`;
}

export const changelogsCommentTopic = 'Release Notes';

/**
 * The release notes as they are posted in a PR comment.
 * The heading is dropped, because the comment topic already provides one.
 */
export function getChangelogsCommentContent(config: BranchConfig): string {
  if (!config.hasReleaseNotes) {
    return '';
  }

  return renderChangelogs(config).replace(regEx(/^### Release Notes\n+/), '');
}

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
