import { regEx } from '../../../util/regex';

const buildDependsRegex = regEx(
  /(?<buildDependsFieldName>build-depends[ \t]*:)/i,
);
const commentRegex = regEx(/^[ \t]*--/);
function isNonASCII(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 127) {
      return true;
    }
  }
  return false;
}

export function countPackageNameLength(input: string): number | null {
  if (input.length < 1 || isNonASCII(input)) {
    return null;
  }
  if (!regEx(/^[A-Za-z0-9]/).test(input[0])) {
    // Must start with letter or number
    return null;
  }
  let idx = 1;
  while (idx < input.length) {
    if (regEx(/[A-Za-z0-9-]/).test(input[idx])) {
      idx++;
    } else {
      break;
    }
  }
  if (!regEx(/[A-Za-z]/).test(input.slice(0, idx))) {
    // Must contain a letter
    return null;
  }
  if (idx - 1 < input.length && input[idx - 1] === '-') {
    // Can't end in a hyphen
    return null;
  }
  return idx;
}

export interface CabalDependency {
  packageName: string;
  currentValue: string;
  replaceString: string;
}

/**
 * Find extents of field contents
 *
 * @param {number} indent -
 *    Indention level maintained within the block.
 *    Any indention lower than this means it's outside the field.
 *    Lines with this level or more are included in the field.
 * @returns {number}
 *    Index just after the end of the block.
 *    Note that it may be after the end of the string.
 */
export function findExtents(indent: number, content: string): number {
  let blockIdx = 0;
  let mode: 'finding-newline' | 'finding-indention' = 'finding-newline';
  for (;;) {
    if (mode === 'finding-newline') {
      while (content[blockIdx++] !== '\n') {
        if (blockIdx >= content.length) {
          break;
        }
      }
      if (blockIdx >= content.length) {
        return content.length;
      }
      mode = 'finding-indention';
    } else {
      let thisIndent = 0;
      for (;;) {
        if ([' ', '\t'].includes(content[blockIdx])) {
          thisIndent += 1;
          blockIdx++;
          if (blockIdx >= content.length) {
            return content.length;
          }
          continue;
        }
        mode = 'finding-newline';
        blockIdx++;
        break;
      }
      if (thisIndent < indent) {
        if (content.slice(blockIdx - 1, blockIdx + 1) === '--') {
          // not enough indention, but the line is a comment, so include it
          mode = 'finding-newline';
          continue;
        }
        // go back to before the newline
        for (;;) {
          if (content[blockIdx--] === '\n') {
            break;
          }
        }
        return blockIdx + 1;
      }
      mode = 'finding-newline';
    }
  }
}

/**
 * Find indention level of build-depends
 *
 * @param {number} match -
 *   Search starts at this index, and proceeds backwards.
 * @returns {number}
 *   Number of indention levels found before 'match'.
 */
export function countPrecedingIndentation(
  content: string,
  match: number,
): number {
  let whitespaceIdx = match - 1;
  let indent = 0;
  while (whitespaceIdx >= 0 && [' ', '\t'].includes(content[whitespaceIdx])) {
    indent += 1;
    whitespaceIdx--;
  }
  return indent;
}

/**
 * Find one 'build-depends' field name usage and its field value
 *
 * @returns {{buildDependsContent: string, lengthProcessed: number}}
 *   buildDependsContent:
 *     the contents of the field, excluding the field name and the colon,
 *     and any comments within
 *
 *   lengthProcessed:
 *     points to after the end of the field. Note that the field does _not_
 *     necessarily start at `content.length - lengthProcessed`.
 *
 *   Returns null if no 'build-depends' field is found.
 */
export function findDepends(
  content: string,
): { buildDependsContent: string; lengthProcessed: number } | null {
  const matchObj = buildDependsRegex.exec(content);
  if (!matchObj?.groups) {
    return null;
  }
  const indent = countPrecedingIndentation(content, matchObj.index);
  const ourIdx: number =
    matchObj.index + matchObj.groups.buildDependsFieldName.length;
  const extentLength: number = findExtents(indent + 1, content.slice(ourIdx));
  const extent = content.slice(ourIdx, ourIdx + extentLength);
  const lines = [];
  // Windows-style line breaks are fine because
  // carriage returns are before the line feed.
  for (const maybeCommentLine of extent.split('\n')) {
    if (!commentRegex.test(maybeCommentLine)) {
      lines.push(maybeCommentLine);
    }
  }
  return {
    buildDependsContent: lines.join('\n'),
    lengthProcessed: ourIdx + extentLength,
  };
}

/**
 * Split a cabal single dependency into its constituent parts.
 * The first part is the package name, an optional second part contains
 * the version constraint.
 *
 * For example 'base == 3.2' would be split into 'base' and ' == 3.2'.
 *
 * @returns {{name: string, range: string}}
 *   Null if the trimmed string doesn't begin with a package name.
 */
export function splitSingleDependency(
  input: string,
): { name: string; range: string } | null {
  const match = countPackageNameLength(input);
  if (match === null) {
    return null;
  }
  const name: string = input.slice(0, match);
  const range = input.slice(match).trim();
  return { name, range };
}

export function extractNamesAndRanges(content: string): CabalDependency[] {
  const list = content.split(',');
  const deps = [];
  for (const untrimmedReplaceString of list) {
    const replaceString = untrimmedReplaceString.trim();
    const maybeNameRange = splitSingleDependency(replaceString);
    if (maybeNameRange !== null) {
      deps.push({
        currentValue: maybeNameRange.range,
        packageName: maybeNameRange.name,
        replaceString,
      });
    }
  }
  return deps;
}
