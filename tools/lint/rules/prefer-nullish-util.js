/**
 * Return the method/function name of a non-computed member call like
 * `.optional()` or `z.nullable(x)`, or null if the node is not such a call.
 * @param {import('estree').Node} node
 * @returns {string | null}
 */
function getCalleeName(node) {
  if (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property.type === 'Identifier'
  ) {
    return node.callee.property.name;
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    messages: {
      noNullish:
        'Use `Nullish()` from schema-utils instead of `nullish()` (or `DeepNullish()` for whole schemas).',
      noChain:
        'Use `Nullish()` from schema-utils instead of combining `{{inner}}()` and `{{outer}}()` (or `DeepNullish()` for whole schemas).',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        // `.nullish()` and standalone `z.nullish(x)`
        const outer = getCalleeName(node);
        if (outer === 'nullish') {
          context.report({ node, messageId: 'noNullish' });
          return;
        }
        if (outer !== 'optional' && outer !== 'nullable') {
          return;
        }
        const expectedInner = outer === 'optional' ? 'nullable' : 'optional';
        // chained: `.nullable().optional()` / `z.nullable(x).optional()`
        const receiver = /** @type {import('estree').MemberExpression} */ (
          node.callee
        ).object;
        // nested standalone: `z.optional(z.nullable(x))`
        const nested = node.arguments.length === 1 ? node.arguments[0] : null;
        if (
          getCalleeName(receiver) === expectedInner ||
          (nested && getCalleeName(nested) === expectedInner)
        ) {
          context.report({
            node,
            messageId: 'noChain',
            data: { inner: expectedInner, outer },
          });
        }
      },
    };
  },
};
