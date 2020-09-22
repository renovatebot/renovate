import { sanitizeMarkdown } from '../../../util/markdown';
import * as template from '../../../util/template';
import { BranchConfig } from '../../common';
import releaseNotesHbs from '../changelog/hbs-template';

export function getChangelogs(config: BranchConfig): string {
  let releaseNotes = '';
  // istanbul ignore if
  if (!config.hasReleaseNotes) {
    return releaseNotes;
  }
  releaseNotes +=
    '\n\n---\n\n' + template.compile(releaseNotesHbs, config, false) + '\n\n';
  releaseNotes = releaseNotes.replace(/### \[`vv/g, '### [`v');
  releaseNotes = sanitizeMarkdown(releaseNotes);
  return releaseNotes;
}
