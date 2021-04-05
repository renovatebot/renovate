const re = new RegExp(`### Release Notes.*### Configuration`, 'ms');

export function smartTruncate(input: string, len: number): string {
  if (input.length < len) {
    return input;
  }
  const releaseNotesMatch = re.exec(input);
  if (releaseNotesMatch) {
    const divider = `</details>\n\n---\n\n### Configuration`;
    const [releaseNotes] = releaseNotesMatch;
    const nonReleaseNotesLength =
      input.length - releaseNotes.length - divider.length;
    const availableLength = len - nonReleaseNotesLength;
    if (availableLength <= 0) {
      return input.substring(0, len);
    }
    return input.replace(
      releaseNotes,
      releaseNotes.slice(0, availableLength) + divider
    );
  }
  return input.substring(0, len);
}
