import handlebars from 'handlebars';
import releaseNotesHbs from '../changelog/hbs-template';
import { PrBodyConfig } from './common';

export function getChangelogs(config: PrBodyConfig): string {
  let releaseNotes = '';
  // istanbul ignore if
  if (!config.hasReleaseNotes) {
    return releaseNotes;
  }
  releaseNotes +=
    '\n\n---\n\n' + handlebars.compile(releaseNotesHbs)(config) + '\n\n';
  releaseNotes = releaseNotes.replace(/### \[`vv/g, '### [`v');
  // Generic replacements/link-breakers

  // Put a zero width space after every # followed by a digit
  releaseNotes = releaseNotes.replace(/#(\d)/gi, '#&#8203;$1');
  // Put a zero width space after every @ symbol to prevent unintended hyperlinking
  releaseNotes = releaseNotes.replace(/@/g, '@&#8203;');
  releaseNotes = releaseNotes.replace(/(`\[?@)&#8203;/g, '$1');
  releaseNotes = releaseNotes.replace(/([a-z]@)&#8203;/gi, '$1');
  releaseNotes = releaseNotes.replace(/\/compare\/@&#8203;/g, '/compare/@');
  releaseNotes = releaseNotes.replace(
    /(\(https:\/\/[^)]*?)\.\.\.@&#8203;/g,
    '$1...@'
  );
  releaseNotes = releaseNotes.replace(
    /([\s(])#(\d+)([)\s]?)/g,
    '$1#&#8203;$2$3'
  );
  // convert escaped backticks back to `
  const backTickRe = /&#x60;([^/]*?)&#x60;/g;
  releaseNotes = releaseNotes.replace(backTickRe, '`$1`');
  releaseNotes = releaseNotes.replace(/`#&#8203;(\d+)`/g, '`#$1`');
  return releaseNotes;
}
