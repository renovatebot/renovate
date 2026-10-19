import { defineRule } from '@oxlint/plugins';
import { getPropertyName } from '../utils/property-name.ts';

export default defineRule({
  meta: {
    type: 'problem',
    messages: {
      requirePublic:
        "Pass a `public` option or assign the callback context's `public` field. Use `public: true` where the data can never be private.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        const isWithCache =
          callee.type === 'Identifier' && callee.name === 'withCache';
        const isCached =
          callee.type === 'MemberExpression' &&
          callee.object.type === 'ThisExpression' &&
          !callee.computed &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'cached';
        if (!isWithCache && !isCached) {
          return;
        }

        const [options, callback] = node.arguments;
        if (options?.type !== 'ObjectExpression') {
          return;
        }

        let isKnown = true;
        for (const property of options.properties) {
          if (property.type === 'SpreadElement') {
            return;
          }

          const name = getPropertyName(property);
          if (name === 'public') {
            return;
          }

          isKnown &&= name !== undefined;
        }

        if (
          (callback?.type === 'ArrowFunctionExpression' ||
            callback?.type === 'FunctionExpression') &&
          callback.params[0]?.type === 'Identifier'
        ) {
          const parameter = callback.params[0];
          const variable = context.sourceCode
            .getDeclaredVariables(callback)
            .find((candidate) => candidate.identifiers.includes(parameter));
          const assignsPublic = variable?.references.some(({ identifier }) => {
            const member = identifier.parent;
            if (
              member.type !== 'MemberExpression' ||
              member.object !== identifier ||
              getPropertyName({
                key: member.property,
                computed: member.computed,
              }) !== 'public'
            ) {
              return false;
            }

            const assignment = member.parent;
            return (
              assignment.type === 'AssignmentExpression' &&
              assignment.operator === '=' &&
              assignment.left === member
            );
          });
          if (assignsPublic) {
            return;
          }
        }

        if (isKnown) {
          context.report({ node: options, messageId: 'requirePublic' });
        }
      },
    };
  },
});
