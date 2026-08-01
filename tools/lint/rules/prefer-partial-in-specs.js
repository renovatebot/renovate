/**
 * Minimal shapes of the TypeScript AST nodes inspected by this rule. oxc emits
 * a typescript-eslint-compatible AST, but these nodes are absent from ESLint's
 * estree typings and oxlint does not export its own node types, so the fields
 * this rule reads are described here.
 *
 * @typedef {{ type: string }} TSType
 * @typedef {{ type: string, expression: { type: string }, typeAnnotation: TSType }} TSAsExpression
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    messages: {
      preferPartial:
        'Casting an object literal to `any` bypasses the type system; use `partial<T>()` from `test/util` (or a properly typed value) instead.',
    },
  },
  create(context) {
    return {
      /** @param {unknown} node */
      TSAsExpression(node) {
        const asExpr = /** @type {TSAsExpression} */ (node);
        if (
          asExpr.expression.type === 'ObjectExpression' &&
          asExpr.typeAnnotation.type === 'TSAnyKeyword'
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
