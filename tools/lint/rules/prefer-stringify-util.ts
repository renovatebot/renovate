import { defineRule } from '@oxlint/plugins';

export default defineRule({
  meta: {
    type: 'suggestion',
    messages: {
      preferStringifyUtil:
        "Use safeStringify() or quickStringify() from 'lib/util/stringify.ts' instead of JSON.stringify(): they handle circular references and non-serializable values safely. Additionally, they are more performant than `JSON.stringify`",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          !node.callee.computed &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'JSON' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'stringify'
        ) {
          context.report({ node, messageId: 'preferStringifyUtil' });
        }
      },
    };
  },
});
