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
 * Parser objects whose `.parse()` result should be validated through a
 * `<Helper>.pipe(Schema)` helper from schema-utils.
 */
const parserHelpers: Record<string, string> = {
  JSON: 'Json',
  ini: 'Ini',
};

/**
 * For a `JSON.parse(...)` or `ini.parse(...)` call expression return the
 * parser object name, otherwise null.
 */
function getParserName(node: ESTree.Node): string | null {
  if (
    getCalleeName(node) === 'parse' &&
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    Object.hasOwn(parserHelpers, node.callee.object.name)
  ) {
    return node.callee.object.name;
  }
  return null;
}

export default defineRule({
  meta: {
    type: 'suggestion',
    messages: {
      preferParserPipe:
        'Use `{{helper}}.pipe(Schema)` from schema-utils instead of `Schema.{{method}}({{parser}}.parse(...))` — it folds the parse and validation into a single schema.',
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
        const parser = arg ? getParserName(arg) : null;
        if (parser) {
          context.report({
            node,
            messageId: 'preferParserPipe',
            data: { method, parser, helper: parserHelpers[parser] },
          });
        }
      },
    };
  },
});
