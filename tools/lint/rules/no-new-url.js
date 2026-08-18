/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    messages: {
      noNewUrl:
        "Use parseUrl() from 'lib/util/url.ts' instead of 'new URL()' to avoid unhandled exceptions on invalid URLs.",
    },
  },
  create(context) {
    return {
      NewExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'URL' &&
          // only consider new URL(arg) and not new URL(arg, base) as parseUrl does not allow this
          node.arguments.length === 1
        ) {
          context.report({ node, messageId: 'noNewUrl' });
        }
      },
    };
  },
};
