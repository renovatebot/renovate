import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

interface Options {
  max?: number;
}

const defaultMax = 2;

function isWrapper(
  node: ESTree.Node,
): node is
  ESTree.UnaryExpression | ESTree.TSNonNullExpression | ESTree.TSAsExpression {
  return (
    (node.type === 'UnaryExpression' && node.operator === '!') ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSAsExpression'
  );
}

function unwrap(node: ESTree.Node): ESTree.Node {
  let current = node;
  while (isWrapper(current)) {
    current =
      current.type === 'UnaryExpression'
        ? current.argument
        : current.expression;
  }
  return current;
}

function isAndOr(node: ESTree.Node): node is ESTree.LogicalExpression {
  return (
    node.type === 'LogicalExpression' &&
    (node.operator === '&&' || node.operator === '||')
  );
}

function operandDepth(
  operand: ESTree.Node,
  operator: ESTree.LogicalExpression['operator'],
): number {
  const inner = unwrap(operand);
  if (!isAndOr(inner)) {
    return 0;
  }
  const depth = getDepth(inner);
  return inner.operator === operator ? depth - 1 : depth;
}

function getDepth(node: ESTree.LogicalExpression): number {
  return (
    1 +
    Math.max(
      operandDepth(node.left, node.operator),
      operandDepth(node.right, node.operator),
    )
  );
}

function isRoot(node: ESTree.LogicalExpression): boolean {
  let parent = node.parent;
  while (isWrapper(parent)) {
    parent = parent.parent;
  }
  return !isAndOr(parent);
}

export default defineRule({
  meta: {
    type: 'suggestion',
    messages: {
      tooDeep:
        'Logical expression nests `&&`/`||` {{depth}} levels deep (max {{max}}). Extract part of it into a named variable or function.',
    },
    schema: [
      {
        type: 'object',
        properties: { max: { type: 'integer', minimum: 1 } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ max: defaultMax }],
  },
  createOnce(context) {
    return {
      LogicalExpression(node) {
        if (!isAndOr(node) || !isRoot(node)) {
          return;
        }
        const options = context.options[0] as Options | undefined;
        const max = options?.max ?? defaultMax;
        const depth = getDepth(node);
        if (depth > max) {
          context.report({
            node,
            messageId: 'tooDeep',
            data: { depth: String(depth), max: String(max) },
          });
        }
      },
    };
  },
});
