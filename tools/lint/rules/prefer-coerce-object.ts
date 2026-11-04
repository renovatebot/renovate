import { defineRule } from '@oxlint/plugins';

/**
 * Flags `x ?? {}` in favour of `coerceObject(x)` from `lib/util/object.ts`.
 * A chain like `x ?? y ?? {}` maps onto the two-argument `coerceObject(x, y)`.
 *
 * Only a bare `{}` literal counts: `x ?? { a: 1 }` keeps a meaningful default,
 * and `x ?? ({} as Foo)` carries an assertion the helper cannot express.
 */
export default defineRule({
  meta: {
    type: 'suggestion',
    messages: {
      preferCoerceObject:
        'Use `coerceObject()` from `lib/util/object.ts` instead of `?? {}`.',
    },
  },
  createOnce(context) {
    return {
      LogicalExpression(node) {
        if (node.operator !== '??') {
          return;
        }
        if (
          node.right.type === 'ObjectExpression' &&
          node.right.properties.length === 0
        ) {
          context.report({ node, messageId: 'preferCoerceObject' });
        }
      },
    };
  },
});
