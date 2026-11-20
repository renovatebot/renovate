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

const logicalAssignmentOperators = new Set(['&&=', '||=', '??=']);

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

function isLogicalOperator(
  node: Node | null,
): node is ESTree.LogicalExpression | ESTree.AssignmentExpression {
  if (node?.type === 'LogicalExpression') {
    return true;
  }
  return (
    node?.type === 'AssignmentExpression' &&
    logicalAssignmentOperators.has(node.operator)
  );
}

// Whether an optional link (`?.`) at or below this member or call can skip the
// evaluation of its arguments and computed keys.
function hasOptionalLink(node: Node): boolean {
  let current = node;
  for (;;) {
    if (current.type === 'MemberExpression') {
      if (current.optional) {
        return true;
      }
      current = current.object;
    } else if (current.type === 'CallExpression') {
      if (current.optional) {
        return true;
      }
      current = current.callee;
    } else if (current.type === 'TSNonNullExpression') {
      current = current.expression;
    } else {
      return false;
    }
  }
}

function isConditionallyEvaluated(child: Node, parent: Node): boolean {
  switch (parent.type) {
    case 'ConditionalExpression':
      return parent.consequent === child || parent.alternate === child;
    case 'LogicalExpression':
    case 'AssignmentPattern':
      return parent.right === child;
    case 'AssignmentExpression':
      return isLogicalOperator(parent) && parent.right === child;
    case 'CallExpression':
      return parent.callee !== child && hasOptionalLink(parent);
    case 'MemberExpression':
      return parent.property === child && hasOptionalLink(parent);
    default:
      return false;
  }
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
        'Do not `await` in a conditionally evaluated position (ternary branch, right side of `&&`, `||`, `??` or their assignments, optional chain argument or key, default value); await in a separate statement or use `if`/`else`.',
    },
  },
  createOnce(context) {
    return {
      ConditionalExpression(node) {
        const parent = skipTransparentParents(node);
        if (isLogicalOperator(parent)) {
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
