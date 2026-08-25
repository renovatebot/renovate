import { defineRule } from '@oxlint/plugins';

/**
 * Forbids the count form `next <N>` of coverage-ignore hints.
 *
 * The count is not honored by the coverage provider: vitest's
 * `ast-v8-to-istanbul` hint parser captures only the keyword
 * (`if`/`else`/`next`/`file`), so `next` always exempts exactly the next AST
 * node, however many lines it spans. A trailing number suggests a line range
 * that is never applied and misleads readers about what is exempted.
 *
 * The fixer drops the count, which preserves the actual (keyword-only)
 * behavior.
 */
const countRegex = /(v8 ignore\s+next)\s+\d+/;

export default defineRule({
  meta: {
    type: 'problem',
    fixable: 'code',
    messages: {
      noCount:
        "The count in 'v8 ignore next <N>' is not honored by V8 coverage - 'next' always exempts exactly the next AST node. Use 'v8 ignore next' (or 'if'/'else'/'file') instead.",
    },
  },
  createOnce(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const match = countRegex.exec(comment.value);
          if (!match) {
            continue;
          }
          // comment.value excludes the leading `/*` or `//` (2 characters)
          const start = comment.start + 2 + match.index;
          const end = start + match[0].length;
          const keyword = match[1];
          context.report({
            loc: comment.loc,
            messageId: 'noCount',
            fix(fixer) {
              return fixer.replaceTextRange([start, end], keyword);
            },
          });
        }
      },
    };
  },
});
