import { defineRule } from '@oxlint/plugins';

/**
 * Flags `x ?? []` in favour of `coerceArray(x)` from `lib/util/array.ts`.
 *
 * Only a bare `[]` literal counts: `x ?? [1]` keeps a meaningful default, and
 * `x ?? ([] as Foo[])` carries an assertion the helper cannot express.
 */
export default defineRule({
  meta: {
    type: 'suggestion',
    messages: {
      preferCoerceArray:
        'Use `coerceArray()` from `lib/util/array.ts` instead of `?? []`.',
    },
  },
  createOnce(context) {
    return {
      LogicalExpression(node) {
        if (node.operator !== '??') {
          return;
        }
        if (
          node.right.type === 'ArrayExpression' &&
          node.right.elements.length === 0
        ) {
          context.report({ node, messageId: 'preferCoerceArray' });
        }
      },
    };
  },
});
