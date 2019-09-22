import { appName } from '../../config/app-strings';

// istanbul ignore next
export function smartTruncate(input: string, len = 60000): string {
  if (input.length < len) {
    return input;
  }
  const releaseNotesMatch = input.match(
    new RegExp(`### Release Notes.*### ${appName} configuration`, 'ms')
  );
  // istanbul ignore if
  if (releaseNotesMatch) {
    const divider = `</details>\n\n---\n\n### ${appName} configuration`;
    const [releaseNotes] = releaseNotesMatch;
    const nonReleaseNotesLength =
      input.length - releaseNotes.length - divider.length;
    const availableLength = len - nonReleaseNotesLength;
    return input.replace(
      releaseNotes,
      releaseNotes.slice(0, availableLength) + divider
    );
  }
  return input.substring(0, len);
}
