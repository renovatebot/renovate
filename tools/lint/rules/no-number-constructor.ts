import { defineRule } from '@oxlint/plugins';

export default defineRule({
  meta: {
    type: 'problem',
    messages: {
      noNumberConstructor:
        "Use parseInt(x, 10) instead of the 'Number' constructor.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'Number'
        ) {
          context.report({ node, messageId: 'noNumberConstructor' });
        }
      },
      NewExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'Number'
        ) {
          context.report({ node, messageId: 'noNumberConstructor' });
        }
      },
    };
  },
});
