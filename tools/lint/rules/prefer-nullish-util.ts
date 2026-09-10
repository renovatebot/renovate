import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

/**
 * Return the method/function name of a non-computed member call like
 * `.optional()` or `z.nullable(x)`, or null if the node is not such a call.
 */
function getCalleeName(node: ESTree.Node): string | null {
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

export default defineRule({
  meta: {
    type: 'suggestion',
    messages: {
      noNullish:
        'Use `Nullish()` from schema-utils instead of `nullish()` (or `DeepNullish()` for whole schemas).',
      noChain:
        'Use `Nullish()` from schema-utils instead of combining `{{inner}}()` and `{{outer}}()` (or `DeepNullish()` for whole schemas).',
    },
  },
  createOnce(context) {
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
        // a non-null `outer` implies a member callee, but that narrowing
        // happens inside `getCalleeName` and is invisible to the compiler
        const receiver = (node.callee as ESTree.MemberExpression).object;
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
});
