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

interface RebaseCheckboxHints {
  /** Replaces the `you tick the rebase/retry checkbox` phrase of the PR body's config description. */
  tick?: string;
  /** Replaces the `checking the rebase/retry box above` phrase of the "cannot rebase" comment. */
  checking?: string;
}

/**
 * Wording for platforms which rebase once the PR is renamed to start with `rebase!`. It is the
 * default because most platforms lacking markdown checkboxes use it.
 */
export const renamePrRebaseHints = {
  tick: 'PR is renamed to start with "rebase!"',
  checking: 'renaming the PR to start with "rebase!"',
} as const satisfies RebaseCheckboxHints;

/**
 * Reword the rebase/retry checkbox hints for platforms which do not render markdown checkboxes.
 */
export function replaceRebaseCheckboxHints(
  body: string,
  hints: RebaseCheckboxHints = renamePrRebaseHints,
): string {
  let result = body;
  if (hints.tick) {
    result = result.replace('you tick the rebase/retry checkbox', hints.tick);
  }
  if (hints.checking) {
    result = result.replace(
      'checking the rebase/retry box above',
      hints.checking,
    );
  }
  return result;
}

const rebaseCheckSectionRegex = regEx(
  `\n---\n\n.*?<!-- rebase-check -->.*?(\n|$)`,
);

/**
 * Remove the trailing rebase/retry checkbox section, including the horizontal rule above it.
 */
export function stripRebaseCheckSection(body: string): string {
  return body.replace(rebaseCheckSectionRegex, '');
}

/**
 * Flatten `<details>`/`<summary>` blocks for platforms whose markdown does not render inline HTML.
 */
export function flattenDetailsSummary(body: string): string {
  return body
    .replace(regEx(/<\/?summary>/g), '**')
    .replace(regEx(/<\/?details>/g), '');
}

/**
 * Replace the hidden HTML comments Renovate embeds in PR bodies. The default drops them entirely;
 * pass a replacement such as `[//]: # ($&)` to keep them in a syntax the platform tolerates.
 */
export function replaceRenovateHiddenComments(
  body: string,
  replacement = '',
): string {
  return body.replace(
    regEx(/<!--renovate-(?:debug|config-hash):.*?-->/g),
    replacement,
  );
}

interface RelativeLinkTargets {
  /** Path replacing `../issues/`, for example `issues/`. */
  issues?: string;
  /** Path replacing `../pull/`, for example `pulls/`. */
  pulls?: string;
}

/**
 * Rewrite the repository-relative issue and pull request links Renovate generates so that they
 * resolve on the target platform.
 */
export function rewriteRelativeLinks(
  body: string,
  targets: RelativeLinkTargets,
): string {
  let result = body;
  if (targets.issues) {
    result = result.replace(
      regEx(/\]\(\.\.\/issues\//g),
      `](${targets.issues}`,
    );
  }
  if (targets.pulls) {
    result = result.replace(regEx(/\]\(\.\.\/pull\//g), `](${targets.pulls}`);
  }
  return result;
}
