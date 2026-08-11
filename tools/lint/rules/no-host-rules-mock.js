/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    messages: {
      noHostRulesMock:
        "Do not mock host-rules; configure real rules via the test util instead: import { hostRules } from '~test/host-rules.ts' and call hostRules.add() in the test.",
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
          // only the host-rules module itself, not e.g. `host-rules-from-env`
          /(?:^|\/)host-rules(?:\.[cm]?[jt]s)?$/.test(specifier.value)
        ) {
          context.report({ node, messageId: 'noHostRulesMock' });
        }
      },
    };
  },
};
