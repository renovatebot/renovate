import { logger } from '../../../logger/index.ts';
import { emojify } from '../../../util/emoji.ts';
import { regEx } from '../../../util/regex.ts';

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

  const note = emojify(
    `> :information_source: **Note**\n> \n> This PR body was truncated due to platform limits.\n\n`,
  );
  const truncationNotice = emojify(
    `\n\n> :scissors: **Note**\n> \n> PR body was truncated to here.\n`,
  );
  const truncatedInput = note + input;

  const reMatch = re.exec(truncatedInput);
  if (!reMatch?.groups) {
    if (truncationNotice.length >= len) {
      return truncatedInput.substring(0, len);
    }
    return (
      truncatedInput.substring(0, len - truncationNotice.length) +
      truncationNotice
    );
  }

  const divider = `\n\n</details>\n\n---\n\n### Configuration`;
  const preNotes = reMatch.groups.preNotes;
  const releaseNotes = reMatch.groups.releaseNotes;
  const postNotes = reMatch.groups.postNotes;

  const availableLength =
    len -
    (preNotes.length +
      postNotes.length +
      divider.length +
      truncationNotice.length);

  if (availableLength <= 0) {
    if (truncationNotice.length >= len) {
      return truncatedInput.substring(0, len);
    }
    return (
      truncatedInput.substring(0, len - truncationNotice.length) +
      truncationNotice
    );
  } else {
    return (
      preNotes +
      releaseNotes.slice(0, availableLength) +
      truncationNotice +
      divider +
      postNotes
    );
  }
}
