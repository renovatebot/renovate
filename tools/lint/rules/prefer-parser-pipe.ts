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
 * For a `JSON.parse(...)` call expression return true.
 */
function isJsonParse(node: ESTree.Node): boolean {
  return (
    getCalleeName(node) === 'parse' &&
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'JSON'
  );
}

/**
 * Return true for a direct `ini.parse(...)` call.
 */
function isIniParse(node: ESTree.Node): boolean {
  return (
    getCalleeName(node) === 'parse' &&
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'ini'
  );
}

export default defineRule({
  meta: {
    type: 'suggestion',
    messages: {
      preferParserPipe:
        'Use `Json.pipe(Schema)` from schema-utils instead of `Schema.{{method}}(JSON.parse(...))` — it folds the parse and validation into a single schema.',
      preferIni:
        'Use `Ini.pipe(Schema)` (or `Ini`) from schema-utils instead of `ini.parse(...)` — it folds the parse and validation into a single schema.',
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (isIniParse(node)) {
          context.report({ node, messageId: 'preferIni' });
          return;
        }
        const method = getCalleeName(node);
        if (method !== 'parse' && method !== 'safeParse') {
          return;
        }
        const [arg] = node.arguments;
        if (arg && isJsonParse(arg)) {
          context.report({
            node,
            messageId: 'preferParserPipe',
            data: { method },
          });
        }
      },
    };
  },
});
