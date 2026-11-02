import { logger } from '../../../logger/index.ts';
import { emojify } from '../../../util/emoji.ts';
import { regEx } from '../../../util/regex.ts';

const re = regEx(
  `(?<preNotes>.*### Release Notes)(?<releaseNotes>.*)### Configuration(?<postNotes>.*)`,
  's',
);

const sectionTruncationNotice = emojify(
  `\n\n> :exclamation: **Important**\n> \n> :scissors: Section was truncated to here.\n`,
);
const detailsOpenRegex = regEx(/<details[\s>]/g);
const detailsCloseRegex = regEx(/<\/details>/g);
const codeFenceRegex = regEx(/^```/gm);
const commentOpenRegex = regEx(/<!--/g);
const commentCloseRegex = regEx(/--!?>/g);

const sectionRemovedNotice = emojify(
  `\n\n> :scissors: Section removed due to length limit.\n`,
);

let smartTruncateEnabled = true;
let longestUntruncatedInput = 0;

/**
 * Runs `fn` with `smartTruncate()` turned off, e.g. to measure the length of a massaged body.
 */
export function withoutSmartTruncate<T>(fn: () => T): T {
  smartTruncateEnabled = false;
  try {
    return fn();
  } finally {
    smartTruncateEnabled = true;
  }
}

/**
 * Returns the length `smartTruncate()` will see for `body`: the longer of the body and the longest input `smartTruncate()` receives while `massage` runs, which can be longer than the massaged body, e.g. by GitHub link conversion. Returns the length of the body without massaging it when it is shorter than half of `maxLength`.
 */
export function getBodyLength(
  body: string,
  massage: (body: string) => string,
  maxLength: number,
): number {
  if (body.length * 2 < maxLength) {
    return body.length;
  }
  longestUntruncatedInput = 0;
  withoutSmartTruncate(() => massage(body));
  return Math.max(body.length, longestUntruncatedInput);
}

function cutAtBlock(text: string, length: number): string {
  const head = text.substring(0, length);
  const block = head.lastIndexOf('\n\n');
  if (block > head.length / 2) {
    return head.substring(0, block);
  }
  const line = head.lastIndexOf('\n');
  return line > 0 ? head.substring(0, line) : head;
}

function closeOpenBlocks(head: string): string {
  const unclosedComments =
    (head.match(commentOpenRegex)?.length ?? 0) -
    (head.match(commentCloseRegex)?.length ?? 0);
  const comment = unclosedComments > 0 ? ' -->' : '';
  const fence =
    (head.match(codeFenceRegex)?.length ?? 0) % 2 === 1 ? '\n```' : '';
  const unclosedDetails =
    (head.match(detailsOpenRegex)?.length ?? 0) -
    (head.match(detailsCloseRegex)?.length ?? 0);
  return `${comment}${fence}${'\n\n</details>'.repeat(Math.max(unclosedDetails, 0))}`;
}

/**
 * Returns `text` cut to at most `max` characters at a block boundary, or else a line boundary, with the code fence and `<details>` blocks of the cut closed and a truncation notice appended. A section which leaves no room for the cut is replaced by a short removal notice, or by nothing if that does not fit either.
 */
export function truncateSection(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  const room = max - sectionTruncationNotice.length;
  const hasRoom = room >= sectionRemovedNotice.length;
  if (!hasRoom) {
    return sectionRemovedNotice.length <= max ? sectionRemovedNotice : '';
  }

  let length = room;
  for (;;) {
    const head = cutAtBlock(text, length);
    const closing = closeOpenBlocks(head);
    if (head.length + closing.length <= room) {
      return `${head}${closing}${sectionTruncationNotice}`;
    }
    length = Math.min(head.length, room - closing.length) - 1;
  }
}

function shareBudget(
  primary: string,
  secondary: string,
  budget: number,
): [string, string] {
  const reserve = secondary ? sectionRemovedNotice.length : 0;
  const first = truncateSection(primary, budget - reserve);
  return [first, truncateSection(secondary, budget - first.length)];
}

/**
 * Cuts the `primary` and `secondary` sections, the `secondary` one first, until `measure()` of the sections is below `maxLength`. The other sections are kept and `measure()` should include them.
 */
export function fitSections<K extends string, T extends Record<K, string>>(
  sections: T,
  [primary, secondary]: readonly [K, K],
  measure: (sections: T) => number,
  maxLength: number,
): T {
  const tooLong = measure(sections) >= maxLength;
  if (!tooLong) {
    return sections;
  }

  const limit = maxLength - 1;
  let budget = limit - measure({ ...sections, [primary]: '', [secondary]: '' });
  for (;;) {
    const [first, second] = shareBudget(
      sections[primary],
      sections[secondary],
      budget,
    );
    const fitted = { ...sections, [primary]: first, [secondary]: second };
    const excess = measure(fitted) - limit;
    const stillTooLong = excess > 0;
    // the budget shrinks by at least one each round and ends the loop at zero
    if (!stillTooLong || budget <= 0) {
      return fitted;
    }
    budget -= excess;
  }
}

export function smartTruncate(input: string, len: number): string {
  if (!smartTruncateEnabled) {
    longestUntruncatedInput = Math.max(longestUntruncatedInput, input.length);
    return input;
  }
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
  }
  return (
    preNotes +
    releaseNotes.slice(0, availableLength) +
    truncationNotice +
    divider +
    postNotes
  );
}
