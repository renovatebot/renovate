import { logger } from '../../../logger/index.ts';
import { emojify } from '../../../util/emoji.ts';
import { regEx } from '../../../util/regex.ts';

const re = regEx(
  `(?<preNotes>.*### Release Notes)(?<releaseNotes>.*)### Configuration(?<postNotes>.*)`,
  's',
);

// where the end of a PR body which truncation keeps can start, most specific first
const tailStarts = [
  // the Configuration section of update PRs, followed by the controls
  '\n\n---\n\n### Configuration\n',
  // the controls of onboarding PRs
  '\n\n---\n\n - [ ] <!-- rebase-check -->',
];
const hiddenCommentRegex = regEx(
  /\n<!--renovate-(?:debug|config-hash):[^>]*-->\n?$/,
);
const detailsOpenRegex = regEx(/<details[\s>]/g);
const detailsCloseRegex = regEx(/<\/details>/g);

/**
 * Returns the end of a PR body which truncation keeps: the Configuration section or the controls with everything after them, or else the trailing `renovate-debug` or `renovate-config-hash` comment.
 */
function getTail(body: string): string {
  for (const tailStart of tailStarts) {
    const start = body.lastIndexOf(tailStart);
    if (start !== -1) {
      return body.slice(start);
    }
  }
  return hiddenCommentRegex.exec(body)?.[0] ?? '';
}

/**
 * Returns the first `length` characters of `body`, closing the `<details>` blocks the cut leaves open (e.g. of vulnerability advisories).
 */
function cutHead(body: string, length: number): string {
  let head = body.substring(0, length);
  for (;;) {
    const unclosed =
      (head.match(detailsOpenRegex)?.length ?? 0) -
      (head.match(detailsCloseRegex)?.length ?? 0);
    const closing = '\n\n</details>'.repeat(Math.max(unclosed, 0));
    if (head.length + closing.length <= length) {
      return head + closing;
    }
    head = head.substring(0, length - closing.length);
  }
}

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
    `\n\n> :exclamation: **Important**\n> \n> :scissors: PR body was truncated to here.\n`,
  );
  const truncatedInput = note + input;

  // cut the release notes first, if everything else fits
  const reMatch = re.exec(truncatedInput);
  if (reMatch?.groups) {
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

    if (availableLength > 0) {
      return (
        preNotes +
        releaseNotes.slice(0, availableLength) +
        truncationNotice +
        divider +
        postNotes
      );
    }
  }

  // otherwise cut what comes before the tail, e.g. long vulnerability advisories, so the Configuration section, the controls and the `renovate-debug` comment survive
  const tail = getTail(truncatedInput);
  const headLength = len - truncationNotice.length - tail.length;
  if (headLength > 0) {
    return cutHead(truncatedInput, headLength) + truncationNotice + tail;
  }

  if (truncationNotice.length >= len) {
    return truncatedInput.substring(0, len);
  }
  return (
    truncatedInput.substring(0, len - truncationNotice.length) +
    truncationNotice
  );
}
