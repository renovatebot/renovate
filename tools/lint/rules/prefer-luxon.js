/**
 * Flags `new Date(...)` in `lib/` source: constructing native dates is
 * timezone-sensitive (e.g. `new Date(y, m, d)` uses local time) and Luxon
 * (`DateTime` / `Duration`, preferring UTC) should be used instead. See
 * docs/development/best-practices.md ("Dates and times").
 *
 * `Date.now()` is deliberately NOT flagged: it returns UTC-based epoch
 * milliseconds and is used for elapsed-time measurement and TTL arithmetic,
 * which is timezone-independent by construction — the class of bug this rule
 * targets (timezone-dependent date construction/formatting) cannot occur
 * there, and Luxon offers no correctness benefit over a raw millis number.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export default {
  meta: {
    type: 'suggestion',
    messages: {
      preferLuxon:
        'Use Luxon (`DateTime` / `Duration`) instead of `new Date()` for date/time handling, and prefer UTC. See docs/development/best-practices.md.',
    },
  },
  create(context) {
    return {
      NewExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'Date') {
          context.report({
            node,
            messageId: 'preferLuxon',
          });
        }
      },
    };
  },
};
