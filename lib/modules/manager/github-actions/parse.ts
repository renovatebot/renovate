import is from '@sindresorhus/is';
import { regEx } from '../../../util/regex.ts';

function splitFirstFrom(
  str: string,
  sep: string,
  start: number,
): [string, string] | null {
  const idx = str.indexOf(sep, start);
  if (idx === -1) {
    return null;
  }
  return [str.slice(0, idx), str.slice(idx + sep.length)];
}

function splitFirst(str: string, sep: string): [string, string] | null {
  return splitFirstFrom(str, sep, 0);
}

interface QuotedValue {
  value: string;
  quote: string;
}

export function parseQuote(input: string): QuotedValue {
  const trimmed = input.trim();
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];

  if (
    trimmed.length >= 2 &&
    first === last &&
    (first === '"' || first === "'")
  ) {
    return { value: trimmed.slice(1, -1), quote: first };
  }

  return { value: trimmed, quote: '' };
}

/**
 * Docker container:
 * - `docker://image:tag`
 * - `docker://image@digest`
 * - `docker://image:tag@digest`
 */
export interface DockerReference {
  kind: 'docker';
  image: string;
  tag?: string;
  digest?: string;
  originalRef: string;
}

/**
 * Local file or directory:
 * - `./path/to/action`
 * - `./.github/workflows/main.yml`
 */
export interface LocalReference {
  kind: 'local';
  path: string;
}

/**
 * Repository:
 * - `owner/repo[/path]@ref`
 * - `https://host/owner/repo[/path]@ref`
 */
export interface RepositoryReference {
  kind: 'repository';

  hostname: string;
  isExplicitHostname: boolean;

  owner: string;
  repo: string;
  path?: string;

  ref: string;
}

export type ActionReference =
  | DockerReference
  | LocalReference
  | RepositoryReference;

export interface ParsedUsesLine {
  /** The whitespace before "uses:" */
  indentation: string;

  /** The `uses:` (and optional `-`) part */
  usesPrefix: string;

  /** The raw value part, potentially quoted (e.g. `actions/checkout@v2`) */
  replaceString: string;

  /** Whitespace between value and `#` */
  commentPrecedingWhitespace: string;

  /** The full comment including `#` */
  commentString: string;

  actionRef: ActionReference | null;
  commentData: CommentData;

  /** The quote char used (' or " or empty) */
  quote: string;
}

const shaRe = regEx(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
const shaShortRe = regEx(/^[a-f0-9]{6,7}$/);

export function isSha(str: string): boolean {
  return shaRe.test(str);
}

export function isShortSha(str: string): boolean {
  return shaShortRe.test(str);
}

const DOCKER_PREFIX = 'docker://';

function parseDockerReference(input: string): DockerReference | null {
  const originalRef = input.slice(DOCKER_PREFIX.length);
  if (!originalRef) {
    return null;
  }

  const digestParts = splitFirst(originalRef, '@');
  if (digestParts) {
    const [image, digest] = digestParts;
    return { kind: 'docker', image, digest, originalRef };
  }

  // Find tag: look for first colon after last slash (to avoid matching port in registry)
  const lastSlashIndex = originalRef.lastIndexOf('/');
  const searchStart = lastSlashIndex === -1 ? 0 : lastSlashIndex + 1;
  const tagParts = splitFirstFrom(originalRef, ':', searchStart);

  if (tagParts) {
    const [image, tag] = tagParts;
    return { kind: 'docker', image, tag, originalRef };
  }

  return { kind: 'docker', image: originalRef, originalRef };
}

const repositoryActionRegex = regEx(
  /^(?:https:\/\/(?<hostname>[^/]+)\/)?(?<owner>[^/]+)\/(?<repo>[^/]+)(?:\/(?<path>.+?))?@(?<ref>.+)$/,
);

function parseRepositoryReference(input: string): RepositoryReference | null {
  const match = repositoryActionRegex.exec(input);
  if (!match?.groups) {
    return null;
  }

  const { owner, repo, path, ref } = match.groups;

  let { hostname } = match.groups;
  let isExplicitHostname = true;
  if (is.undefined(hostname)) {
    hostname = 'github.com';
    isExplicitHostname = false;
  }

  return {
    kind: 'repository',
    hostname,
    isExplicitHostname,
    owner,
    repo,
    path,
    ref,
  };
}

export function parseActionReference(uses: string): ActionReference | null {
  if (!uses) {
    return null;
  }

  if (uses.startsWith(DOCKER_PREFIX)) {
    return parseDockerReference(uses);
  }

  if (uses.startsWith('./') || uses.startsWith('../')) {
    return { kind: 'local', path: uses };
  }

  return parseRepositoryReference(uses);
}

export interface CommentData {
  pinnedVersion?: string;
  ratchetExclude?: boolean;
  matchedString?: string;
  index?: number;
}

// Matches version strings with optional prefixes, e.g.:
// - "@v1.2.3", "v1.2.3", "1.2.3"
// - "renovate: pin @v1.2.3", "tag=v1.2.3"
// - "ratchet:owner/repo@v1.2.3"
// - "stable/v1.2.3", "stable-v1.2.3"
const pinnedVersionRe = regEx(
  /^\s*(?:(?:renovate\s*:\s*)?(?:pin\s+|tag\s*=\s*)?|(?:ratchet:[\w-]+\/[.\w-]+))?@?(?<version>([\w-]*[-/])?v?\d+(?:\.\d+(?:\.\d+)?)?)/,
);

export function parseComment(commentBody: string): CommentData {
  const trimmed = commentBody.trim();
  if (trimmed === 'ratchet:exclude') {
    return { ratchetExclude: true };
  }

  // We use commentBody (with leading spaces) to get the correct index relative to the comment start
  const match = pinnedVersionRe.exec(commentBody);
  if (match?.groups?.version) {
    return {
      pinnedVersion: match.groups.version,
      matchedString: match[0],
      index: match.index,
    };
  }

  return {};
}

const usesLineRegex = regEx(
  /^(?<prefix>\s+(?:-\s+)?uses\s*:\s*)(?<remainder>.+)$/,
);

/**
 * Parses a GitHub Actions `uses:` line into its components.
 *
 * Expected line format:
 * ```
 * <indentation>[- ]uses: [quote]<action-reference>[quote][ # <comment>]
 * ```
 *
 * Examples:
 * - `      uses: actions/checkout@v4`
 * - `      - uses: "owner/repo@abc123" # v1.0.0`
 * - `      uses: docker://alpine:3.18`
 *
 * @returns Parsed components or `null` if the line doesn't match `uses:` pattern
 */
export function parseUsesLine(line: string): ParsedUsesLine | null {
  const match = usesLineRegex.exec(line);
  if (!match?.groups) {
    return null;
  }

  const { prefix, remainder } = match.groups;

  if (remainder.startsWith('#')) {
    return null;
  }

  const indentation = prefix.slice(0, prefix.indexOf('uses'));

  // We look for ' #' to determine where the comment starts.
  // This is a safe heuristic for valid "uses" values which cannot contain spaces.
  const commentIndex = remainder.indexOf(' #');

  // No comment case
  if (commentIndex === -1) {
    const { value, quote } = parseQuote(remainder);
    return {
      indentation,
      usesPrefix: prefix,
      replaceString: remainder.trim(),
      commentPrecedingWhitespace: '',
      commentString: '',
      actionRef: parseActionReference(value),
      commentData: {},
      quote,
    };
  }

  // Has comment: split value and comment
  const rawValuePart = remainder.slice(0, commentIndex);
  const commentPart = remainder.slice(commentIndex + 1); // starts at #

  // Calculate whitespace between value and #
  const partBeforeHash = remainder.slice(0, commentIndex + 1);
  const commentPrecedingWhitespace = partBeforeHash.slice(
    partBeforeHash.trimEnd().length,
  );

  const { value, quote } = parseQuote(rawValuePart);
  // commentPart always starts with '#' since we found ' #' and sliced after the space
  const cleanCommentBody = commentPart.slice(1);

  return {
    indentation,
    usesPrefix: prefix,
    replaceString: rawValuePart.trim(),
    commentPrecedingWhitespace,
    commentString: commentPart,
    actionRef: parseActionReference(value),
    commentData: parseComment(cleanCommentBody),
    quote,
  };
}
