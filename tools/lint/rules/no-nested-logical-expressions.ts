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

/**
 * Logical depth of a value, looking through member access, calls (callee and
 * arguments), `new`, spread and concise arrow bodies. Block bodies, function
 * expressions and computed properties are opaque.
 */
function valueDepth(node: ESTree.Node): number {
  const inner = unwrap(node);
  switch (inner.type) {
    case 'LogicalExpression':
      return getDepth(inner);
    case 'ChainExpression':
      return valueDepth(inner.expression);
    case 'MemberExpression':
      return valueDepth(inner.object);
    case 'CallExpression':
    case 'NewExpression':
      return Math.max(
        valueDepth(inner.callee),
        ...inner.arguments.map(valueDepth),
      );
    case 'SpreadElement':
      return valueDepth(inner.argument);
    case 'ArrowFunctionExpression':
      return inner.expression ? valueDepth(inner.body) : 0;
    default:
      return 0;
  }
}

function operandDepth(
  operand: ESTree.Node,
  operator: ESTree.LogicalExpression['operator'],
): number {
  const inner = unwrap(operand);
  if (inner.type !== 'LogicalExpression') {
    return valueDepth(inner);
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

/**
 * Walks up through exactly the constructs `valueDepth` looks through.
 */
function isRoot(node: ESTree.LogicalExpression): boolean {
  let child: ESTree.Node = node;
  for (;;) {
    const parent: ESTree.Node = child.parent;
    if (parent.type === 'LogicalExpression') {
      return false;
    }
    const transparent =
      isWrapper(parent) ||
      parent.type === 'ChainExpression' ||
      parent.type === 'CallExpression' ||
      parent.type === 'NewExpression' ||
      parent.type === 'SpreadElement' ||
      (parent.type === 'MemberExpression' && parent.object === child) ||
      (parent.type === 'ArrowFunctionExpression' &&
        parent.expression &&
        parent.body === child);
    if (!transparent) {
      return true;
    }
    child = parent;
  }
}

export default defineRule({
  meta: {
    type: 'suggestion',
    messages: {
      tooDeep:
        'Logical expression nests logical operators (`&&`, `||`, `??`) {{depth}} levels deep (max {{max}}). Extract part of it into a named variable or function.',
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
        if (!isRoot(node)) {
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
