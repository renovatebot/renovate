/**
 * Return the method name of a zero-argument member call like `.optional()`,
 * or null if the node is not such a call.
 * @param {import('estree').Node} node
 * @returns {string | null}
 */
function getChainedMethodName(node) {
  if (
    node.type === 'CallExpression' &&
    node.arguments.length === 0 &&
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
      preferNullish:
        'Use `.nullish()` instead of chaining `.{{inner}}().{{outer}}()`.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const outer = getChainedMethodName(node);
        if (outer !== 'optional' && outer !== 'nullable') {
          return;
        }
        const receiver = /** @type {import('estree').MemberExpression} */ (
          node.callee
        ).object;
        const inner = getChainedMethodName(receiver);
        const expectedInner = outer === 'optional' ? 'nullable' : 'optional';
        if (inner === expectedInner) {
          context.report({
            node,
            messageId: 'preferNullish',
            data: { inner, outer },
          });
        }
      },
    };
  },
};
