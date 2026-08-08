/**
 * Note on the `next <N>` count form of these coverage-ignore hints:
 * empirically verified against vitest 4 (`@vitest/coverage-v8` with
 * `ast-v8-to-istanbul`) that the count `N` is NOT honored — the hint parser
 * only captures the keyword (`if`/`else`/`next`/`file`) and `next` always
 * exempts exactly the next AST node, however many lines it spans: `next 2`
 * before two sibling statements exempts only the first, while `next 1`
 * before a multi-line `if` block exempts the whole block. Existing counts
 * are inert noise and remain allowed by this rule; only a justification is
 * required.
 *
 * A `stop` marker only terminates a region opened by `start`; the
 * justification lives on the `start` marker, so bare stops are exempt.
 */
const bareStopRegex = /^\s*v8 ignore stop\s*$/;

/**
 * `--` (or `---`) separator followed by a non-empty reason,
 * e.g. `v8 ignore next -- should never happen`.
 */
const dashReasonRegex = /v8 ignore.*?--+\s+\S/;

/**
 * Legacy colon form, e.g. `v8 ignore next 3: hard to test`. Accepted because
 * it is widespread in the codebase, but the dash form is recommended.
 */
const colonReasonRegex = /v8 ignore\s+[a-z]+(?:\s+\d+)?\s*:\s*\S/;

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    messages: {
      missingReason:
        'Coverage-ignore comments must carry a justification: /* v8 ignore <kind> -- <reason> */',
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const text = comment.value;
          if (!text.includes('v8 ignore')) {
            continue;
          }
          if (bareStopRegex.test(text)) {
            continue;
          }
          if (dashReasonRegex.test(text) || colonReasonRegex.test(text)) {
            continue;
          }
          if (!comment.loc) {
            continue;
          }
          context.report({
            loc: comment.loc,
            messageId: 'missingReason',
          });
        }
      },
    };
  },
};
