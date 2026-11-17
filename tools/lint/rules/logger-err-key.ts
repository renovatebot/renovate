import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';
import { getLoggerLevel, isErrorIsh } from '../utils/logger.ts';

/**
 * Metadata keys that hold an error but are not the canonical `err` key.
 * Bunyan only runs the error serializer for the `err` key, so errors under
 * any other key are logged without the serializer's stack handling and
 * redaction, and cannot be searched consistently.
 */
const nonCanonicalKeys = new Set(['error', 'exception']);

/**
 * Error properties which are commonly logged instead of the error itself.
 * The `err` serializer already includes them, together with the rest of the
 * error, so the whole error should be logged instead.
 */
const errorStringProperties = new Set(['message', 'stack']);

/**
 * If the value is `<error>.message` or `<error>.stack`, return the `<error>`
 * expression, otherwise `null`. TS-specific wrapper expressions are unwrapped
 * first.
 */
function getErrorStringSource(
  node: ESTree.Expression,
): ESTree.Expression | null {
  if (
    node.type === 'TSAsExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSSatisfiesExpression'
  ) {
    return getErrorStringSource(node.expression);
  }
  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    errorStringProperties.has(node.property.name) &&
    node.object.type !== 'Super' &&
    isErrorIsh(node.object)
  ) {
    return node.object;
  }
  return null;
}

export default defineRule({
  meta: {
    type: 'problem',
    fixable: 'code',
    messages: {
      errKey:
        'Use the `err` key for errors in logger metadata instead of `{{key}}`, so the error serializer is applied and error logs can be searched consistently.',
      errString:
        'Log the whole error under the `err` key instead of `{{key}}: {{value}}`; the error serializer includes the message and stack and keeps error logs searchable.',
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
          if (!name || !nonCanonicalKeys.has(name)) {
            continue;
          }
          const { value } = property;
          const errorSource = getErrorStringSource(value);
          if (errorSource) {
            const source = context.sourceCode.getText(errorSource);
            context.report({
              node: property,
              messageId: 'errString',
              data: { key: name, value: context.sourceCode.getText(value) },
              fix: (fixer) =>
                fixer.replaceText(
                  property,
                  source === 'err' ? 'err' : `err: ${source}`,
                ),
            });
            continue;
          }
          if (!isErrorIsh(value)) {
            continue;
          }
          context.report({
            node: property,
            messageId: 'errKey',
            data: { key: name },
            fix(fixer) {
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
