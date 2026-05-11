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
    const filename = context.filename ?? context.physicalFilename ?? '';
    // Only enforce in lib/, but not in the parseUrl implementation itself
    if (!filename.includes('/lib/') || filename.endsWith('lib/util/url.ts')) {
      return {};
    }
    return {
      NewExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'URL' &&
          // only consider newURL(arg) and not newURL(arg, base) as parseUrl does not allow this
          node.arguments.length === 1
        ) {
          context.report({ node, messageId: 'noNewUrl' });
        }
      },
    };
  },
};
