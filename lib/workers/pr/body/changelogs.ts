import { unemojify } from '../../../util/emoji';
import { sanitizeMarkdown } from '../../../util/markdown';
import * as template from '../../../util/template';
import type { BranchConfig } from '../../types';
import releaseNotesHbs from '../changelog/hbs-template';

export function getChangelogs(config: BranchConfig): string {
  let releaseNotes = '';
  /* c8 ignore next 3 */
  if (!config.hasReleaseNotes) {
    return releaseNotes;
  }
  releaseNotes +=
    '\n\n---\n\n' + template.compile(releaseNotesHbs, config, false) + '\n\n';
  releaseNotes = releaseNotes.replace(/### \[`vv/g, '### [`v');
  releaseNotes = sanitizeMarkdown(releaseNotes);
  releaseNotes = unemojify(releaseNotes);

  return releaseNotes;
}
