import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';
import { getLoggerLevel } from '../utils/logger.ts';

/**
 * Log levels whose messages are used in metrics or error catching services
 * and therefore must have a static `msg` component.
 * See docs/development/best-practices.md ("Logging").
 */
const flaggedLevels = new Set(['warn', 'error', 'fatal']);

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

export default defineRule({
  meta: {
    type: 'problem',
    messages: {
      staticMessage:
        "WARN, ERROR and FATAL messages must have a static msg component so they can be grouped in metrics; move interpolated values into the metadata object, e.g. logger.{{level}}({ url }, 'Failed to fetch').",
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

        const messageArg: ESTree.Argument | undefined =
          first.type === 'ObjectExpression' ? second : first;
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
