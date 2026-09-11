import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

/**
 * `as const` assertions are represented as a type reference named `const`.
 * They narrow instead of bypassing type checking, so they stay allowed.
 */
function isConstAssertion(typeAnnotation: ESTree.TSType): boolean {
  return (
    typeAnnotation.type === 'TSTypeReference' &&
    typeAnnotation.typeName.type === 'Identifier' &&
    typeAnnotation.typeName.name === 'const'
  );
}

export default defineRule({
  meta: {
    type: 'problem',
    messages: {
      preferPartial:
        'Casting an object literal with `as` bypasses type checking; use `partial<T>()` from `test/util` (or a properly typed value) instead.',
    },
  },
  createOnce(context) {
    return {
      TSAsExpression(node) {
        if (
          node.expression.type === 'ObjectExpression' &&
          !isConstAssertion(node.typeAnnotation)
        ) {
          context.report({
            node,
            messageId: 'preferPartial',
          });
        }
      },
    };
  },
});
