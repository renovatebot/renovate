const re = new RegExp(`(.*### Release Notes)(.*)### Configuration(.*)`, 'ms');

export function smartTruncate(input: string, len: number): string {
  if (input.length < len) {
    return input;
  }

  const reMatch = re.exec(input);
  if (!reMatch) {
    return input.substring(0, len);
  }
  const divider = `\n\n</details>\n\n---\n\n### Configuration`;
  const preNotes = reMatch[1];
  const releaseNotes = reMatch[2];
  const postNotes = reMatch[3];
  const availableLength =
    len - (preNotes.length + postNotes.length + divider.length);

  if (availableLength <= 0) {
    return input.substring(0, len);
  } else {
    return (
      preNotes + releaseNotes.slice(0, availableLength) + divider + postNotes
    );
  }
}
