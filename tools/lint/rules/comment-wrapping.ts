import type { Comment } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

/**
 * Enforces greedy wrapping of line comments at the print width (80 columns,
 * matching Prettier's `printWidth` — Prettier itself never re-wraps comment
 * text, so this is not covered by formatting):
 *
 * - a comment line must not be broken while the first word of the
 *   continuation line would still have fit within the print width, and
 * - a comment line extending past the print width must be broken at a word
 *   boundary when possible.
 *
 * Continuation lines are detected heuristically so that deliberately
 * separate comment lines are never merged: the previous line must end
 * mid-sentence (in a word-like character) and the next line must start with
 * a lowercase word that does not look like a statement keyword. Directive
 * comments (`eslint-…`, `biome-ignore`, `@ts-…`, coverage-ignore hints, …),
 * trailing comments after code, and list items are exempt. The length check
 * additionally skips lines containing URLs and lines that are mostly code
 * (example snippets), since breaking those at word boundaries harms
 * readability.
 *
 * The fixer re-wraps the whole detected comment paragraph greedily at the
 * print width.
 */
const maxLength = 80;

const commentPrefix = '// ';

/**
 * Directive and tooling comments that must not be re-wrapped. Matched
 * against the comment text with the `//` marker removed.
 */
const directiveRegex =
  /^[/!]?\s*(?:eslint|oxlint|biome-ignore|prettier-ignore|@ts-|v8 ignore|istanbul ignore|<reference|#region|#endregion|noinspection)/;

/**
 * Words that typically start a (commented-out) statement rather than
 * continue a sentence. A line starting with one of these is never treated
 * as a continuation, so commented-out code is not merged into prose.
 */
const statementKeywords = new Set([
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'delete',
  'else',
  'export',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'let',
  'return',
  'switch',
  'throw',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'yield',
]);

/** A line ending in a word-like character continues in the next line. */
const midSentenceEndRegex = /[A-Za-z0-9`'"’]$/;

/** A lowercase word followed by a space or the end of the line. */
const continuationWordRegex = /^([a-z][A-Za-z0-9'’-]*)(?=[ \t]|$)/;

/** A plain word, optionally with trailing punctuation — i.e. prose, not code. */
const plainWordRegex = /^[A-Za-z0-9][A-Za-z0-9'’-]*[.,;:!?]*$/;

/**
 * Splits comment text into wrappable words. An inline code span (backticks)
 * counts as a single unbreakable word, so wrapping never splits it apart.
 */
function splitWords(content: string): string[] {
  return content.match(/`[^`]+`[.,;:!?]*|\S+/g) ?? [];
}

/**
 * `true` when a strict majority of the words are plain prose words.
 * Code-example comments (object literals, calls, quoted snippets) fail this
 * and are exempt from the length check.
 */
function isMostlyProse(content: string): boolean {
  const words = splitWords(content);
  const plain = words.filter((word) => plainWordRegex.test(word));
  return plain.length * 2 > words.length;
}

interface CommentLine {
  /** Offset of the `//` marker in the source text. */
  start: number;
  /** Offset just past the end of the comment. */
  end: number;
  loc: NonNullable<Comment['loc']>;
  /** Leading whitespace of the physical line. */
  indent: string;
  /** Length of the physical line. */
  lineLength: number;
  /** Comment text without the `//` marker, trimmed. */
  content: string;
}

function firstContinuationWord(content: string): string | null {
  const match = continuationWordRegex.exec(content);
  if (!match || statementKeywords.has(match[1])) {
    return null;
  }
  return match[1];
}

/** `true` when `next` looks like the continuation of the sentence in `prev`. */
function continues(prev: CommentLine, next: CommentLine): boolean {
  return (
    next.loc.start.line === prev.loc.start.line + 1 &&
    next.indent === prev.indent &&
    prev.content !== '' &&
    next.content !== '' &&
    midSentenceEndRegex.test(prev.content) &&
    firstContinuationWord(next.content) !== null
  );
}

/** Greedily wraps `words` into comment lines of at most `maxLength` columns. */
function wrapWords(words: string[], indent: string): string {
  const width = indent.length + commentPrefix.length;
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current === '') {
      current = word;
    } else if (width + current.length + 1 + word.length <= maxLength) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines.map((line) => `${commentPrefix}${line}`).join(`\n${indent}`);
}

export default defineRule({
  meta: {
    type: 'layout',
    fixable: 'code',
    messages: {
      prematureBreak:
        'Comment is wrapped before the {{maxLength}}-column print width; the next word still fits on this line. Wrap comments greedily at {{maxLength}} columns.',
      exceedsPrintWidth:
        'Comment line exceeds the {{maxLength}}-column print width; break it at a word boundary.',
    },
  },
  createOnce(context) {
    return {
      Program() {
        const sourceLines = context.sourceCode.lines;
        const comments: CommentLine[] = [];
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type !== 'Line' || !comment.loc) {
            continue;
          }
          const line = sourceLines[comment.loc.start.line - 1];
          const indent = line.slice(0, comment.loc.start.column);
          // only own-line comments; trailing comments belong to their code line
          if (indent.trim() !== '') {
            continue;
          }
          const content = comment.value.trim();
          if (directiveRegex.test(content)) {
            continue;
          }
          comments.push({
            start: comment.start,
            end: comment.end,
            loc: comment.loc,
            indent,
            lineLength: line.length,
            content,
          });
        }

        // group consecutive continuation lines into paragraphs
        let index = 0;
        while (index < comments.length) {
          const paragraph = [comments[index]];
          while (
            index + 1 < comments.length &&
            continues(comments[index], comments[index + 1])
          ) {
            paragraph.push(comments[index + 1]);
            index += 1;
          }
          index += 1;

          let messageId: 'prematureBreak' | 'exceedsPrintWidth' | null = null;
          let reportAt = paragraph[0];
          for (let i = 0; i < paragraph.length; i++) {
            const current = paragraph[i];
            const next = paragraph[i + 1];
            if (
              next &&
              current.lineLength +
                1 +
                firstContinuationWord(next.content)!.length <=
                maxLength
            ) {
              messageId = 'prematureBreak';
              reportAt = current;
              break;
            }
            const words = splitWords(current.content);
            if (
              current.lineLength > maxLength &&
              words.length > 1 &&
              current.indent.length + commentPrefix.length + words[0].length <=
                maxLength &&
              !current.content.includes('://') &&
              isMostlyProse(current.content)
            ) {
              messageId = 'exceedsPrintWidth';
              reportAt = current;
              break;
            }
          }
          if (!messageId) {
            continue;
          }

          const first = paragraph[0];
          const last = paragraph.at(-1)!;
          const words = paragraph.flatMap((line) => splitWords(line.content));
          context.report({
            loc: reportAt.loc,
            messageId,
            data: { maxLength: `${maxLength}` },
            fix(fixer) {
              return fixer.replaceTextRange(
                [first.start, last.end],
                wrapWords(words, first.indent),
              );
            },
          });
        }
      },
    };
  },
});
