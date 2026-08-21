// Custom prettier plugin to preserve MkDocs/Material admonitions (!!! / ??? / ???+).
// Prettier 3.x does not understand this non-standard CommonMark extension
// and corrupts the indented body by reflowing it into preceding paragraphs.
//
// Strategy: before the built-in markdown parser runs, replace each admonition
// block with an HTML comment placeholder; after parsing, restore the original
// text in the resulting html AST nodes. Prettier prints html nodes verbatim.
//
// Known limitations:
//   - Nested admonitions are preserved verbatim (outer block is masked as one unit).
import markdownPlugin from 'prettier/plugins/markdown';

const ADMONITION_HEADER =
  /^(?:!!!|\?\?\?\+?)\s+[A-Za-z][\w-]*(?:\s+"[^"\n]*")?\s*$/;
const BODY_LINE = /^(?:$|\s{2,})/;
const PLACEHOLDER_RE = /^<!--mkdocs-admonition:(?<index>\d+)-->\s*$/;
const COLLISION_GUARD = 'mkdocs-admonition:';
// When <!-- prettier-ignore --> precedes an admonition, prettier will attempt
// to output the *next* AST node verbatim using original-text offsets that come
// from the masked text — causing a position mismatch and a runtime error.
// Fix: absorb <!-- prettier-ignore --> into the admonition placeholder so it
// never precedes a placeholder node in the masked text.
// Matches both spaced (<!-- prettier-ignore -->) and compact (<!--prettier-ignore-->) forms.
const PRETTIER_IGNORE_RE = /^<!--\s*prettier-ignore\s*-->$/;

/** @param {string[]} bodyLines */
function normalizeBodyIndent(bodyLines) {
  let minIndent = Infinity;
  for (const line of bodyLines) {
    if (line.trim() === '') {
      continue;
    }
    const m = /^(\s*)/.exec(line);
    if (m) {
      minIndent = Math.min(minIndent, m[1].length);
    }
  }
  if (minIndent === Infinity || minIndent === 2) {
    return bodyLines;
  }
  return bodyLines.map((line) =>
    line.trim() === '' ? '' : `  ${line.slice(minIndent)}`,
  );
}

/** @param {string} text */
function maskAdmonitions(text) {
  const lines = text.split('\n');
  const placeholders = [];
  const masked = [];
  let inFence = false;
  let fenceChar = '';
  let fenceLen = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (inFence) {
      // Closing fence: same char, at least as many chars, no content after
      const closeMatch = /^\s{0,3}(?<fence>`{3,}|~{3,})\s*$/.exec(line);
      const closeFence = closeMatch?.groups?.fence;
      if (closeFence?.[0] === fenceChar && closeFence.length >= fenceLen) {
        inFence = false;
      }
      masked.push(line);
      i++;
      continue;
    }

    // Opening fence: 0-3 spaces then 3+ backticks or tildes
    const fenceMatch = /^\s{0,3}(?<fence>`{3,}|~{3,})/.exec(line);
    if (fenceMatch?.groups) {
      inFence = true;
      fenceChar = fenceMatch.groups.fence[0];
      fenceLen = fenceMatch.groups.fence.length;
      masked.push(line);
      i++;
      continue;
    }

    // When <!-- prettier-ignore --> precedes an admonition, absorb both into
    // one placeholder so the ignore comment never precedes a placeholder node.
    if (PRETTIER_IGNORE_RE.test(line)) {
      let peekIdx = i + 1;
      while (peekIdx < lines.length && lines[peekIdx] === '') {
        peekIdx++;
      }
      if (peekIdx < lines.length && ADMONITION_HEADER.test(lines[peekIdx])) {
        const prefixLines = [line]; // <!-- prettier-ignore -->
        i++;
        while (i < peekIdx) {
          prefixLines.push(lines[i]); // blank lines between ignore and !!!
          i++;
        }
        prefixLines.push(lines[i]); // !!! header
        i++;
        const bodyLines = [];
        while (i < lines.length && BODY_LINE.test(lines[i])) {
          bodyLines.push(lines[i]);
          i++;
        }
        while (bodyLines.length > 0 && bodyLines.at(-1) === '') {
          bodyLines.pop();
          i--;
        }
        const blockLines = [...prefixLines, ...normalizeBodyIndent(bodyLines)];
        const n = placeholders.length;
        placeholders.push(blockLines.join('\n'));
        masked.push(`<!--mkdocs-admonition:${n}-->`);
        continue;
      }
    }

    if (ADMONITION_HEADER.test(line)) {
      i++;
      const bodyLines = [];

      // Greedily consume body: blank lines and 2+-space-indented lines
      while (i < lines.length && BODY_LINE.test(lines[i])) {
        bodyLines.push(lines[i]);
        i++;
      }

      // Strip trailing blank lines to avoid double-blank in prettier output;
      // they will be re-emitted to the masked stream as normal blank lines.
      while (bodyLines.length > 0 && bodyLines.at(-1) === '') {
        bodyLines.pop();
        i--;
      }

      const blockLines = [line, ...normalizeBodyIndent(bodyLines)];
      const n = placeholders.length;
      placeholders.push(blockLines.join('\n'));
      masked.push(`<!--mkdocs-admonition:${n}-->`);
      continue;
    }

    masked.push(line);
    i++;
  }

  return { maskedText: masked.join('\n'), placeholders };
}

/**
 * @param {import('mdast').Root} ast
 * @param {string[]} placeholders
 */
function unmaskAdmonitions(ast, placeholders) {
  /** @param {import('mdast').Nodes} node */
  function walk(node) {
    if (node.type === 'html') {
      const match = PLACEHOLDER_RE.exec(node.value);
      if (match?.groups) {
        node.value = placeholders[Number(match.groups.index)];
      }
      return;
    }

    if ('children' in node) {
      for (const child of /** @type {import('mdast').Parent} */ (node)
        .children) {
        walk(child);
      }
    }
  }

  walk(ast);
  return ast;
}

const builtinParser = markdownPlugin.parsers.markdown;

/**
 * @param {string} text
 * @param {import('prettier').ParserOptions<any> & { originalText: string }} options
 */
async function parse(text, options) {
  if (text.includes(COLLISION_GUARD)) {
    throw new Error(
      `Source text contains "${COLLISION_GUARD}" which collides with plugin placeholders.`,
    );
  }

  const { maskedText, placeholders } = maskAdmonitions(text);
  // The built-in parser records character offsets into the text it parsed.
  // Prettier's printer later slices `options.originalText` at those offsets
  // (e.g. to read ordered-list markers).  We must keep originalText in sync
  // with the text we actually parsed, otherwise the printer crashes.
  // prettier creates a fresh options object per format() call so mutating it
  // here is safe within a single formatting run.
  options.originalText = maskedText;
  const ast = await builtinParser.parse(maskedText, options);
  return unmaskAdmonitions(ast, placeholders);
}

export const parsers = {
  markdown: {
    ...builtinParser,
    parse,
    astFormat: 'mdast',
  },
};
