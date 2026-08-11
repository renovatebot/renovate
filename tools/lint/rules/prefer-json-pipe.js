/**
 * Return the method/function name of a non-computed member call like
 * `.parse()` or `JSON.parse()`, or null if the node is not such a call.
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

/**
 * True for a `JSON.parse(...)` call expression.
 * @param {import('estree').Node} node
 * @returns {boolean}
 */
function isJsonParseCall(node) {
  return (
    getCalleeName(node) === 'parse' &&
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'JSON'
  );
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    messages: {
      preferJsonPipe:
        'Use `Json.pipe(Schema)` from schema-utils instead of `Schema.{{method}}(JSON.parse(...))` — it folds the parse and validation into a single schema.',
    },
  },
  create(context) {
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
};
