import { defineRule } from '@oxlint/plugins';

export default defineRule({
  meta: {
    type: 'suggestion',
    messages: {
      preferIsObject:
        "Consider `isObject()` or `isPlainObject()` from `@sindresorhus/is` instead of comparing `typeof` against 'object'. Semantics differ (`typeof null === 'object'`, arrays are objects, `isObject()` includes functions) — verify equivalence before changing.",
    },
  },
  createOnce(context) {
    return {
      BinaryExpression(node) {
        if (!['===', '!==', '==', '!='].includes(node.operator)) {
          return;
        }
        for (const [a, b] of [
          [node.left, node.right],
          [node.right, node.left],
        ]) {
          if (
            a.type === 'UnaryExpression' &&
            a.operator === 'typeof' &&
            b.type === 'Literal' &&
            b.value === 'object'
          ) {
            context.report({ node, messageId: 'preferIsObject' });
            return;
          }
        }
      },
    };
  },
});
