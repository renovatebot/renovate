import { defineRule } from '@oxlint/plugins';
import { getLoggerLevel, isErrorIsh } from '../utils/logger.ts';

/**
 * Metadata keys that hold an error but are not the canonical `err` key.
 * Bunyan only runs the error serializer for the `err` key, so errors under
 * any other key are logged without the serializer's stack handling and
 * redaction, and cannot be searched consistently.
 */
const nonCanonicalKeys = new Set(['error', 'exception']);

export default defineRule({
  meta: {
    type: 'problem',
    fixable: 'code',
    messages: {
      errKey:
        'Use the `err` key for errors in logger metadata instead of `{{key}}`, so the error serializer is applied and error logs can be searched consistently.',
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!getLoggerLevel(node.callee)) {
          return;
        }
        const [first] = node.arguments;
        if (first?.type !== 'ObjectExpression') {
          return;
        }
        for (const property of first.properties) {
          if (property.type !== 'Property' || property.computed) {
            continue;
          }
          const { key } = property;
          let name: string | null = null;
          if (key.type === 'Identifier') {
            name = key.name;
          } else if (key.type === 'Literal' && typeof key.value === 'string') {
            name = key.value;
          }
          if (
            !name ||
            !nonCanonicalKeys.has(name) ||
            !isErrorIsh(property.value)
          ) {
            continue;
          }
          context.report({
            node: property,
            messageId: 'errKey',
            data: { key: name },
            fix(fixer) {
              const { value } = property;
              if (value.type === 'Identifier' && value.name === 'err') {
                return fixer.replaceText(property, 'err');
              }
              if (property.shorthand) {
                return fixer.replaceText(property, `err: ${name}`);
              }
              return fixer.replaceText(key, 'err');
            },
          });
        }
      },
    };
  },
});
