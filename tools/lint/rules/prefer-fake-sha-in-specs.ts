import { defineRule } from '@oxlint/plugins';

export default defineRule({
  meta: {
    type: 'problem',
    messages: {
      preferFakeSha:
        'Casting with `as LongCommitSha` bypasses the type system; use `fakeSha()` from `test/util` instead.',
    },
  },
  createOnce(context) {
    return {
      TSAsExpression(node) {
        const { typeAnnotation } = node;
        if (
          typeAnnotation.type === 'TSTypeReference' &&
          typeAnnotation.typeName.type === 'Identifier' &&
          typeAnnotation.typeName.name === 'LongCommitSha'
        ) {
          context.report({
            node,
            messageId: 'preferFakeSha',
          });
        }
      },
    };
  },
});
