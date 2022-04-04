const re = new RegExp(
  `(?<preNotes>.*### Release Notes)(?<releaseNotes>.*)### Configuration(?<postNotes>.*)`,
  'ms'
);

export function smartTruncate(input: string, len: number): string {
  if (input.length < len) {
    return input;
  }

  const reMatch = re.exec(input);
  if (!reMatch) {
    return input.substring(0, len);
  }

  const divider = `\n\n</details>\n\n---\n\n### Configuration`;
  const preNotes = reMatch.groups?.preNotes;
  const releaseNotes = reMatch.groups?.releaseNotes;
  const postNotes = reMatch.groups?.postNotes;
  if (!preNotes || !releaseNotes || !postNotes) {
    return input;
  }

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
