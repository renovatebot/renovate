import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';

const re = regEx(
  `(?<preNotes>.*### Release Notes)(?<releaseNotes>.*)### Configuration(?<postNotes>.*)`,
  's',
);

export function smartTruncate(input: string, len: number): string {
  if (input.length < len) {
    return input;
  }
  logger.debug(
    `Truncating PR body due to platform limitation of ${len} characters`,
  );

  const note = `> **Note:** This PR body was truncated due to platform limits.\n\n`;
  const truncatedInput = note + input;

  const reMatch = re.exec(truncatedInput);
  if (!reMatch?.groups) {
    return truncatedInput.substring(0, len);
  }

  const divider = `\n\n</details>\n\n---\n\n### Configuration`;
  const preNotes = reMatch.groups.preNotes;
  const releaseNotes = reMatch.groups.releaseNotes;
  const postNotes = reMatch.groups.postNotes;

  const availableLength =
    len - (preNotes.length + postNotes.length + divider.length);

  if (availableLength <= 0) {
    return truncatedInput.substring(0, len);
  } else {
    return (
      preNotes + releaseNotes.slice(0, availableLength) + divider + postNotes
    );
  }
}
