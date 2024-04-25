import { regEx } from '../../../util/regex';

const re = regEx(
  `(?<preNotes>.*### Release Notes)(?<releaseNotes>.*)### Configuration(?<postNotes>.*)`,
  's',
);

export function smartTruncate(input: string, len: number): string {
  if (input.length < len) {
    return input;
  }

  const reMatch = re.exec(input);
  if (!reMatch?.groups) {
    return input.substring(0, len);
  }

  const divider = `\n\n</details>\n\n---\n\n### Configuration`;
  const preNotes = reMatch.groups.preNotes;
  const releaseNotes = reMatch.groups.releaseNotes;
  const postNotes = reMatch.groups.postNotes;

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
