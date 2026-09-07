import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

/**
 * Return the method/function name of a non-computed member call like
 * `.parse()` or `JSON.parse()`, or null if the node is not such a call.
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

/**
 * True for a `JSON.parse(...)` call expression.
 */
function isJsonParseCall(node: ESTree.Node): boolean {
  return (
    getCalleeName(node) === 'parse' &&
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'JSON'
  );
}

export default defineRule({
  meta: {
    type: 'suggestion',
    messages: {
      preferJsonPipe:
        'Use `Json.pipe(Schema)` from schema-utils instead of `Schema.{{method}}(JSON.parse(...))` — it folds the parse and validation into a single schema.',
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const method = getCalleeName(node);
        if (method !== 'parse' && method !== 'safeParse') {
          return;
        }
        const [arg] = node.arguments;
        if (arg && isJsonParseCall(arg)) {
          context.report({
            node,
            messageId: 'preferJsonPipe',
            data: { method },
          });
        }
      },
    };
  },
});
