/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    messages: {
      noHostRulesMock:
        'Do not mock host-rules; configure real rules via hostRules.add() in the test instead.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type !== 'MemberExpression' ||
          callee.computed ||
          callee.object.type !== 'Identifier' ||
          callee.object.name !== 'vi' ||
          callee.property.type !== 'Identifier' ||
          (callee.property.name !== 'mock' && callee.property.name !== 'doMock')
        ) {
          return;
        }
        const [specifier] = node.arguments;
        if (
          specifier?.type === 'Literal' &&
          typeof specifier.value === 'string' &&
          specifier.value.includes('host-rules')
        ) {
          context.report({ node, messageId: 'noHostRulesMock' });
        }
      },
    };
  },
};
