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

function isCallLike(
  node: ESTree.Node,
): node is
  ESTree.CallExpression | ESTree.NewExpression | ESTree.ChainExpression {
  return (
    node.type === 'CallExpression' ||
    node.type === 'NewExpression' ||
    node.type === 'ChainExpression'
  );
}

function calleeDepth(callee: ESTree.Node): number {
  let current = unwrap(callee);
  while (current.type === 'MemberExpression') {
    current = unwrap(current.object);
  }
  return isCallLike(current) ? valueDepth(current) : 0;
}

/**
 * Logical depth of a value, looking through calls, `new` and concise arrow
 * bodies. Block bodies and function expressions are opaque.
 */
function valueDepth(node: ESTree.Node): number {
  const inner = unwrap(node);
  switch (inner.type) {
    case 'LogicalExpression':
      return getDepth(inner);
    case 'ChainExpression':
      return valueDepth(inner.expression);
    case 'CallExpression':
    case 'NewExpression':
      return Math.max(
        calleeDepth(inner.callee),
        ...inner.arguments.map(valueDepth),
      );
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
 * `state` tracks whether the current node is a plain value, a call, or a
 * member access on a call (only valid when it ends up as a callee).
 */
function isRoot(node: ESTree.LogicalExpression): boolean {
  let child: ESTree.Node = node;
  let state: 'value' | 'call' | 'member' = 'value';
  for (;;) {
    const parent: ESTree.Node = child.parent;
    if (isWrapper(parent) || parent.type === 'ChainExpression') {
      child = parent;
      continue;
    }
    if (state === 'member') {
      if (parent.type === 'MemberExpression' && parent.object === child) {
        child = parent;
        continue;
      }
      if (parent.type === 'CallExpression' || parent.type === 'NewExpression') {
        if (parent.callee !== child) {
          return true;
        }
        state = 'call';
        child = parent;
        continue;
      }
      return true;
    }
    if (parent.type === 'LogicalExpression') {
      return false;
    }
    if (parent.type === 'CallExpression' || parent.type === 'NewExpression') {
      if (parent.arguments.includes(child)) {
        state = 'call';
      } else if (state !== 'call' || parent.callee !== child) {
        return true;
      }
      child = parent;
      continue;
    }
    if (
      state === 'call' &&
      parent.type === 'MemberExpression' &&
      parent.object === child
    ) {
      state = 'member';
      child = parent;
      continue;
    }
    if (
      parent.type === 'ArrowFunctionExpression' &&
      parent.expression &&
      parent.body === child
    ) {
      state = 'value';
      child = parent;
      continue;
    }
    return true;
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
