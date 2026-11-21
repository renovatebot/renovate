import type { Scalar } from 'yaml';
import { regEx } from '../../../util/regex.ts';
import { isLongCommitSha } from '../../../util/schema-utils/git.ts';
import type {
  CommentRefMatch,
  RefDigestOptions,
  RefDigestProps,
} from './types.ts';

const pinTokenRe = regEx(
  /^(?<prefix>\s*(?:(?:renovate\s*:\s*)?(?:pin\s+|tag\s*=\s*)?)?(?<version>(?:[\w-]*[-/])?v?\d+(?:\.\d+(?:\.\d+)?)?(?:-[a-zA-Z0-9.-]+)?))(?:\s|$)/,
);

const bareTokenRe = regEx(/^(?<prefix>\s*(?<ref>[^#\s]\S*))(?:\s+#.*)?\s*$/);

/**
 * Extracts a version tag or branch reference from an inline YAML comment body
 * (the substring after `#`).
 */
export function parseRefComment(commentBody: string): CommentRefMatch | null {
  const versionMatch = pinTokenRe.exec(commentBody);
  if (versionMatch?.groups) {
    return {
      ref: versionMatch.groups.version,
      matchedString: versionMatch.groups.prefix,
    };
  }

  const bareMatch = bareTokenRe.exec(commentBody);
  if (bareMatch?.groups) {
    return {
      ref: bareMatch.groups.ref,
      matchedString: bareMatch.groups.prefix,
    };
  }

  return null;
}

/**
 * Returns the quote character for inline-pinnable YAML scalars, or `null` for
 * block scalars that cannot safely hold an inline trailing comment.
 */
export function getScalarQuote(scalar: Scalar): string | null {
  switch (scalar.type) {
    case 'QUOTE_DOUBLE':
      return '"';
    case 'QUOTE_SINGLE':
      return "'";
    case 'PLAIN':
      return '';
    default:
      return null;
  }
}

/**
 * Builds digest-aware dependency extraction fields (`currentValue`,
 * `currentDigest`, `replaceString`, `autoReplaceStringTemplate`, `pinDigests`,
 * or `skipReason`) for a YAML scalar holding a Git ref or commit SHA.
 */
export function buildRefDigestProps({
  content,
  keyStart,
  valueNode,
  valueRange,
  ref,
  valuePrefix = '',
  isFlow,
}: RefDigestOptions): RefDigestProps {
  const quote = getScalarQuote(valueNode);
  const [valueStart, valueEnd, nodeEnd] = valueRange;
  const keyPrefix = content.slice(keyStart, valueStart);

  if (isLongCommitSha(ref)) {
    if (!isFlow && quote !== null && valueNode.comment) {
      const commentMatch = parseRefComment(valueNode.comment);
      if (commentMatch) {
        const tail = content.slice(valueEnd, nodeEnd);
        const hashOffset = tail.indexOf('#');
        const commentWs = tail.slice(0, hashOffset);
        const replaceEnd =
          valueEnd + hashOffset + 1 + commentMatch.matchedString.length;

        return {
          currentValue: commentMatch.ref,
          currentDigest: ref,
          replaceString: content.slice(keyStart, replaceEnd),
          autoReplaceStringTemplate: `${keyPrefix}${quote}${valuePrefix}{{#if newDigest}}{{newDigest}}${quote}{{#if newValue}}${commentWs}# {{newValue}}{{/if}}{{else}}{{newValue}}${quote}{{/if}}`,
        };
      }
    }

    return {
      currentDigest: ref,
      skipReason: 'unversioned-reference',
    };
  }

  if (isFlow || quote === null) {
    return {
      currentValue: ref,
      pinDigests: false,
    };
  }

  return {
    currentValue: ref,
    replaceString: content.slice(keyStart, valueEnd),
    autoReplaceStringTemplate: `${keyPrefix}${quote}${valuePrefix}{{#if newDigest}}{{newDigest}}${quote}{{#if newValue}} # {{newValue}}{{/if}}{{else}}{{newValue}}${quote}{{/if}}`,
  };
}
