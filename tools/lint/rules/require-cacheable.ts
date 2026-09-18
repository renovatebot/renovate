import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

function getPropertyName(node: ESTree.ObjectProperty): string | undefined {
  const { key } = node;
  if (key.type === 'Identifier' && !node.computed) {
    return key.name;
  }
  if (key.type === 'Literal' && typeof key.value === 'string') {
    return key.value;
  }
  return undefined;
}

/**
 * Requires every `withCache()` call to say whether its result may be cached.
 *
 * `cacheable` defaults to `true`, so a call which leaves it out writes whatever it fetched to the package cache - including data which came from a registry only this user can reach. That cache is shared between repositories, and on the hosted app between tenants, so the decision should be made deliberately at each call site rather than inherited from the default.
 *
 * Where the data can never be private - a datasource with a single, well-known, public registry - `cacheable: true` states that, and is what the reviewer needs to see.
 *
 * Calls which build their options elsewhere, or spread them in, are left alone: the property may well be set, and this rule cannot see it.
 */
export default defineRule({
  meta: {
    type: 'problem',
    messages: {
      requireCacheable:
        "Pass 'cacheable' to withCache() to say whether this result may be written to a shared cache. Use a check for the public registry, or `cacheable: true` where the data can never be private.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== 'Identifier' ||
          node.callee.name !== 'withCache'
        ) {
          return;
        }

        const [options] = node.arguments;
        if (options?.type !== 'ObjectExpression') {
          return;
        }

        let isKnown = true;
        for (const property of options.properties) {
          if (property.type === 'SpreadElement') {
            return;
          }

          const name = getPropertyName(property);
          if (name === 'cacheable') {
            return;
          }

          isKnown &&= name !== undefined;
        }

        if (isKnown) {
          context.report({ node: options, messageId: 'requireCacheable' });
        }
      },
    };
  },
});
