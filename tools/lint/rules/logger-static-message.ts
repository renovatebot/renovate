import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

/**
 * Log levels whose messages are used in metrics or error catching services
 * and therefore must have a static `msg` component.
 * See docs/development/best-practices.md ("Logging").
 */
const flaggedLevels = new Set(['warn', 'error', 'fatal']);

/**
 * Extract the log level from a `logger.<level>(...)` or
 * `logger.once.<level>(...)` callee, or return `null` if the callee is not a
 * logger call.
 */
function getLoggerLevel(callee: ESTree.Expression): string | null {
  if (
    callee.type !== 'MemberExpression' ||
    callee.computed ||
    callee.property.type !== 'Identifier'
  ) {
    return null;
  }
  const obj = callee.object;
  if (obj.type === 'Identifier' && obj.name === 'logger') {
    return callee.property.name;
  }
  if (
    obj.type === 'MemberExpression' &&
    !obj.computed &&
    obj.object.type === 'Identifier' &&
    obj.object.name === 'logger' &&
    obj.property.type === 'Identifier' &&
    obj.property.name === 'once'
  ) {
    return callee.property.name;
  }
  return null;
}

/**
 * Whether the expression is (or contains, in a `+` chain) a string literal or
 * template literal, i.e. builds the message string dynamically.
 */
function hasStringOperand(node: ESTree.Node): boolean {
  if (node.type === 'Literal') {
    return typeof node.value === 'string';
  }
  if (node.type === 'TemplateLiteral') {
    return true;
  }
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return hasStringOperand(node.left) || hasStringOperand(node.right);
  }
  return false;
}

/**
 * Whether the metadata property value looks like an error object: an
 * identifier or member access named like an error (`err`, `error`,
 * `parseError`, ...) or a `new SomeError(...)` expression. TS-specific
 * wrapper expressions are unwrapped first.
 */
function isErrorIsh(node: ESTree.Expression): boolean {
  if (
    node.type === 'TSAsExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSSatisfiesExpression'
  ) {
    return isErrorIsh(node.expression);
  }
  if (node.type === 'Identifier') {
    return /err(?:or)?$/i.test(node.name);
  }
  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier'
  ) {
    return /err(?:or)?$/i.test(node.property.name);
  }
  if (node.type === 'NewExpression') {
    return (
      node.callee.type === 'Identifier' && node.callee.name.endsWith('Error')
    );
  }
  return false;
}

export default defineRule({
  meta: {
    type: 'problem',
    messages: {
      staticMessage:
        "WARN, ERROR and FATAL messages must have a static msg component so they can be grouped in metrics; move interpolated values into the metadata object, e.g. logger.{{level}}({ url }, 'Failed to fetch').",
      errKey: 'use the err key for errors in logger metadata',
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const level = getLoggerLevel(node.callee);
        if (!level || !flaggedLevels.has(level)) {
          return;
        }

        const [first, second] = node.arguments;
        if (!first) {
          return;
        }

        let messageArg: ESTree.Argument | undefined = first;
        if (first.type === 'ObjectExpression') {
          messageArg = second;
          for (const property of first.properties) {
            if (
              property.type === 'Property' &&
              !property.computed &&
              ((property.key.type === 'Identifier' &&
                property.key.name === 'error') ||
                (property.key.type === 'Literal' &&
                  property.key.value === 'error')) &&
              isErrorIsh(property.value)
            ) {
              context.report({ node: property, messageId: 'errKey' });
            }
          }
        }

        if (!messageArg) {
          return;
        }
        if (
          (messageArg.type === 'TemplateLiteral' &&
            messageArg.expressions.length > 0) ||
          (messageArg.type === 'BinaryExpression' &&
            messageArg.operator === '+' &&
            hasStringOperand(messageArg))
        ) {
          context.report({
            node: messageArg,
            messageId: 'staticMessage',
            data: { level },
          });
        }
      },
    };
  },
});
