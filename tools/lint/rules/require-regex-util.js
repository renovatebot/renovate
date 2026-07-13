/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    messages: {
      requireRegexUtil:
        'Use regEx() from lib/util/regex.ts instead of raw RegExp — it uses the RE2 engine for ReDoS-safe matching.',
    },
  },
  create(context) {
    const filename = context.filename ?? context.physicalFilename ?? '';
    // Only enforce in lib/, but not in the regEx implementation itself
    if (!filename.includes('/lib/') || filename.endsWith('lib/util/regex.ts')) {
      return {};
    }
    /**
     * Regex literals passed directly as the first argument of regEx(...).
     * Collected in the CallExpression visitor (which runs before its argument
     * Literal in the pre-order traversal) so the Literal visitor can skip them.
     * @type {Set<import('estree').Node>}
     */
    const wrappedLiterals = new Set();
    return {
      NewExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'RegExp'
        ) {
          context.report({ node, messageId: 'requireRegexUtil' });
        }
      },
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'regEx' &&
          node.arguments.length > 0 &&
          node.arguments[0].type === 'Literal' &&
          'regex' in node.arguments[0]
        ) {
          wrappedLiterals.add(node.arguments[0]);
        }
      },
      Literal(node) {
        if ('regex' in node && !wrappedLiterals.has(node)) {
          context.report({ node, messageId: 'requireRegexUtil' });
        }
      },
    };
  },
};
