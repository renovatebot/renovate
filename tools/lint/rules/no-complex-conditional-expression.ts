import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

type Node = ESTree.Node;

// Expression wrappers that do not change evaluation order.
const transparentTypes = new Set([
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
]);

function isScopeBoundary(node: Node): boolean {
  return (
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionExpression' ||
    node.type === 'FunctionDeclaration' ||
    node.type === 'StaticBlock' ||
    node.type.endsWith('Statement') ||
    node.type.endsWith('Declaration')
  );
}

function skipTransparentParents(node: Node): Node | null {
  let parent = node.parent;
  while (parent && transparentTypes.has(parent.type)) {
    parent = parent.parent;
  }
  return parent;
}

function isConditionallyEvaluated(child: Node, parent: Node): boolean {
  if (parent.type === 'ConditionalExpression') {
    return parent.consequent === child || parent.alternate === child;
  }
  if (parent.type === 'LogicalExpression') {
    return parent.right === child;
  }
  return false;
}

export default defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow ternaries as operands of logical expressions and `await` in conditionally evaluated expressions, as V8 coverage misreports such constructs.',
    },
    messages: {
      ternaryInLogical:
        'Do not use a ternary as an operand of `{{operator}}`; extract it into a variable or use `if`/`else`.',
      conditionalAwait:
        'Do not `await` inside a ternary branch or on the right side of `&&`, `||` or `??`; await in a separate statement or use `if`/`else`.',
    },
  },
  createOnce(context) {
    return {
      ConditionalExpression(node) {
        const parent = skipTransparentParents(node);
        if (parent?.type === 'LogicalExpression') {
          context.report({
            node,
            messageId: 'ternaryInLogical',
            data: { operator: parent.operator },
          });
        }
      },
      AwaitExpression(node) {
        let current: Node = node;
        let parent: Node | null = node.parent;
        while (parent && !isScopeBoundary(parent)) {
          if (isConditionallyEvaluated(current, parent)) {
            context.report({ node, messageId: 'conditionalAwait' });
            return;
          }
          current = parent;
          parent = current.parent;
        }
      },
    };
  },
});
