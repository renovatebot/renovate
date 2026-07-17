/**
 * Date/time utility modules that are allowed to use the native `Date` API,
 * e.g. to interoperate between Luxon and legacy timestamp formats.
 */
const DATE_UTILITY_MODULES = [
  '/lib/util/date',
  '/lib/util/pretty-time',
  '/lib/util/timestamp',
];

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    messages: {
      preferLuxon:
        'Use Luxon (`DateTime` / `Duration`) instead of `{{api}}` for date/time handling, and prefer UTC. See docs/development/best-practices.md.',
    },
  },
  create(context) {
    const filename = context.filename ?? context.physicalFilename ?? '';
    // Only enforce in lib/ source files. Spec files legitimately construct
    // native dates, e.g. for `vi.setSystemTime()`.
    if (
      !filename.includes('/lib/') ||
      filename.endsWith('.spec.ts') ||
      DATE_UTILITY_MODULES.some((module) => filename.includes(module))
    ) {
      return {};
    }
    return {
      NewExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'Date') {
          context.report({
            node,
            messageId: 'preferLuxon',
            data: { api: 'new Date()' },
          });
        }
      },
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          !node.callee.computed &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'Date' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'now'
        ) {
          context.report({
            node,
            messageId: 'preferLuxon',
            data: { api: 'Date.now()' },
          });
        }
      },
    };
  },
};
