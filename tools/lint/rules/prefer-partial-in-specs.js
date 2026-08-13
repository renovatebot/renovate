/**
 * Minimal shapes of the TypeScript AST nodes inspected by this rule. oxc emits
 * a typescript-eslint-compatible AST, but these nodes are absent from ESLint's
 * estree typings and oxlint does not export its own node types, so the fields
 * this rule reads are described here.
 *
 * @typedef {{ type: string, typeName?: { type: string, name?: string } }} TSType
 * @typedef {{ type: string, expression: { type: string }, typeAnnotation: TSType }} TSAsExpression
 */

/**
 * `as const` assertions are represented as a type reference named `const`.
 * They narrow instead of bypassing type checking, so they stay allowed.
 *
 * @param {TSType} typeAnnotation
 */
function isConstAssertion(typeAnnotation) {
  return (
    typeAnnotation.type === 'TSTypeReference' &&
    typeAnnotation.typeName?.type === 'Identifier' &&
    typeAnnotation.typeName.name === 'const'
  );
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    messages: {
      preferPartial:
        'Casting an object literal with `as` bypasses type checking; use `partial<T>()` from `test/util` (or a properly typed value) instead.',
    },
  },
  create(context) {
    return {
      /** @param {unknown} node */
      TSAsExpression(node) {
        const asExpr = /** @type {TSAsExpression} */ (node);
        if (
          asExpr.expression.type === 'ObjectExpression' &&
          !isConstAssertion(asExpr.typeAnnotation)
        ) {
          context.report({
            node: /** @type {import('estree').Node} */ (node),
            messageId: 'preferPartial',
          });
        }
      },
    };
  },
};
