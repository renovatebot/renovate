/**
 * Minimal shapes of the TypeScript AST nodes inspected by this rule. oxc emits
 * a typescript-eslint-compatible AST, but these nodes are absent from ESLint's
 * estree typings and oxlint does not export its own node types, so the fields
 * this rule reads are described here.
 *
 * @typedef {{ type: string, name?: string }} TSTypeName
 * @typedef {{ type: string, typeName?: TSTypeName }} TSType
 * @typedef {{ type: string, typeAnnotation: TSType }} TSAsExpression
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    messages: {
      preferFakeSha:
        'Casting with `as LongCommitSha` bypasses the type system; use `fakeSha()` from `test/util` instead.',
    },
  },
  create(context) {
    return {
      /** @param {unknown} node */
      TSAsExpression(node) {
        const asExpr = /** @type {TSAsExpression} */ (node);
        const { typeAnnotation } = asExpr;
        if (
          typeAnnotation.type === 'TSTypeReference' &&
          typeAnnotation.typeName?.type === 'Identifier' &&
          typeAnnotation.typeName.name === 'LongCommitSha'
        ) {
          context.report({
            node: /** @type {import('estree').Node} */ (node),
            messageId: 'preferFakeSha',
          });
        }
      },
    };
  },
};
