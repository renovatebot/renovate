/**
 * Require the `codeBlock` (or `stripIndent`) template helper from
 * `common-tags` for multi-line string fixtures in test files.
 *
 * Untagged multi-line template literals force fixtures to be written with
 * zero indentation, which breaks the visual nesting of the surrounding
 * code. The `codeBlock` helper strips the common leading indentation (and
 * trims the surrounding newlines), so fixtures can be indented naturally.
 *
 * Only template literals that span multiple *source* lines are flagged,
 * i.e. a raw newline must occur in the literal text itself (not merely
 * inside a `${...}` expression). Single-line templates that produce
 * multi-line values via `\n` escape sequences are left alone: they do not
 * hurt the surrounding indentation, and tagging them is not value-
 * preserving in general (`codeBlock` re-indents or inlines multi-line
 * substitution values, and the escaped lines take part in the helpers'
 * indentation stripping).
 *
 * Shapes that cannot round-trip through `codeBlock`/`stripIndent` are NOT
 * flagged either, because tagging them would change the produced string:
 *
 * - Values with leading or trailing whitespace (e.g. fixtures that start or
 *   end with `\n`): both helpers `.trim()` the end result, so the
 *   whitespace would be lost.
 * - As a consequence, values where every content line is indented are never
 *   flagged: a trimmed value always starts with a non-whitespace character,
 *   i.e. its first line has zero indentation. Values whose shortest line
 *   indentation is non-zero cannot be produced by the helpers (they always
 *   strip the shortest indentation).
 *
 * Interpolated `${...}` expressions are treated as opaque single-line,
 * non-whitespace placeholders when computing the value.
 *
 * Also skipped:
 *
 * - Tagged templates of any kind (`codeBlock`, `html`, `it.each`, ...).
 * - `describe`/`it`/`test`/`suite`/`bench` titles (including `.each`/`.only`
 *   style member and chained calls).
 * - Inline snapshot arguments (`toMatchInlineSnapshot` and friends), which
 *   are managed by vitest.
 */

const TITLE_FUNCTIONS = new Set(['describe', 'it', 'test', 'suite', 'bench']);

const INLINE_SNAPSHOT_MATCHERS = new Set([
  'toMatchInlineSnapshot',
  'toThrowErrorMatchingInlineSnapshot',
]);

/**
 * Walk a callee to its leftmost identifier by unwrapping
 * CallExpression.callee and MemberExpression.object chains, so that
 * `it.each(cases)(title, fn)` resolves to `it`.
 * @param {import('estree').Expression | import('estree').Super} node
 * @returns {string | null}
 */
function getLeftmostIdentifier(node) {
  if (node.type === 'Identifier') {
    return node.name;
  }
  if (node.type === 'CallExpression') {
    return getLeftmostIdentifier(node.callee);
  }
  if (node.type === 'MemberExpression') {
    return getLeftmostIdentifier(node.object);
  }
  return null;
}

/**
 * Compute the value the template literal produces, with every substitution
 * replaced by an opaque single-line, non-whitespace placeholder.
 * @param {import('estree').TemplateLiteral} node
 * @returns {string | null}
 */
function getCookedValue(node) {
  const parts = [];
  for (const quasi of node.quasis) {
    // `cooked` is only undefined for invalid escape sequences, which are a
    // syntax error in untagged templates, but guard anyway.
    if (typeof quasi.value.cooked !== 'string') {
      return null;
    }
    parts.push(quasi.value.cooked);
  }
  return parts.join('x');
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    messages: {
      useCodeBlock:
        'Use the codeBlock (or stripIndent) template helper from common-tags for multi-line fixtures.',
    },
  },
  create(context) {
    return {
      TemplateLiteral(node) {
        const parent = node.parent;
        // tagged templates (codeBlock`...`, it.each`...`, ...) are fine
        if (parent?.type === 'TaggedTemplateExpression') {
          return;
        }
        if (parent?.type === 'CallExpression') {
          // describe/it/test titles
          if (
            parent.arguments[0] === node &&
            TITLE_FUNCTIONS.has(getLeftmostIdentifier(parent.callee) ?? '')
          ) {
            return;
          }
          // inline snapshots are managed by vitest
          if (
            parent.callee.type === 'MemberExpression' &&
            parent.callee.property.type === 'Identifier' &&
            INLINE_SNAPSHOT_MATCHERS.has(parent.callee.property.name) &&
            parent.arguments.includes(node)
          ) {
            return;
          }
        }

        // only flag literals spanning multiple source lines; multi-line
        // values built from `\n` escapes are fine (see rule docs above)
        if (!node.quasis.some((quasi) => quasi.value.raw.includes('\n'))) {
          return;
        }

        const value = getCookedValue(node);
        if (value === null || !value.includes('\n')) {
          return;
        }
        // Only flag values which `codeBlock`/`stripIndent` can reproduce
        // exactly; see the rule documentation above.
        if (value !== value.trim()) {
          return;
        }

        context.report({ node, messageId: 'useCodeBlock' });
      },
    };
  },
};
