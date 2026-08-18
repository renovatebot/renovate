import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

/**
 * Operators used when both comparisons assert equality with `null` /
 * `undefined` (`x === null || x === undefined`).
 */
const EQUALITY_OPERATORS = new Set(['===', '==']);

/**
 * Operators used when both comparisons assert inequality with `null` /
 * `undefined` (`x !== null && x !== undefined`).
 */
const INEQUALITY_OPERATORS = new Set(['!==', '!=']);

/**
 * Unwrap `ChainExpression` nodes so optional chains (`a?.b`) compare
 * structurally equal to their inner member expression.
 */
function unwrapChain(node: ESTree.Node): ESTree.Node {
  return node.type === 'ChainExpression' ? node.expression : node;
}

/**
 * Whether two nodes are the same simple reference: an identifier, `this`, or
 * a member chain of those with identifier or literal keys. Anything with
 * possible side effects (calls, complex computed keys) is not considered.
 */
function isSameRef(rawA: ESTree.Node, rawB: ESTree.Node): boolean {
  const a = unwrapChain(rawA);
  const b = unwrapChain(rawB);
  if (a.type !== b.type) {
    return false;
  }
  // the check above already guarantees both nodes have the same type, but the
  // compiler cannot correlate the two narrowings, so `b` is re-checked
  switch (a.type) {
    case 'Identifier':
      return b.type === 'Identifier' && a.name === b.name;
    case 'ThisExpression':
      return true;
    case 'MemberExpression': {
      if (b.type !== 'MemberExpression') {
        return false;
      }
      if (a.computed !== b.computed) {
        return false;
      }
      if (
        a.computed &&
        !(
          a.property.type === 'Literal' &&
          b.property.type === 'Literal' &&
          a.property.value === b.property.value
        )
      ) {
        return false;
      }
      if (
        !a.computed &&
        !(
          a.property.type === 'Identifier' &&
          b.property.type === 'Identifier' &&
          a.property.name === b.property.name
        )
      ) {
        return false;
      }
      return isSameRef(a.object, b.object);
    }
    default:
      return false;
  }
}

/**
 * Comparison of a simple reference against a nullish value, as returned by
 * `getNullishComparison`.
 */
interface NullishComparison {
  ref: ESTree.Node;
  nullish: 'null' | 'undefined';
}

/**
 * If `node` compares a simple reference with `null` or `undefined` using one
 * of the given operators, return the reference and which nullish value it is
 * compared against; otherwise return null.
 */
function getNullishComparison(
  node: ESTree.Node,
  operators: Set<string>,
): NullishComparison | null {
  if (node.type !== 'BinaryExpression' || !operators.has(node.operator)) {
    return null;
  }
  for (const [side, ref] of [
    [node.right, node.left],
    [node.left, node.right],
  ]) {
    if (side.type === 'Literal' && side.value === null) {
      return { ref, nullish: 'null' };
    }
    if (side.type === 'Identifier' && side.name === 'undefined') {
      return { ref, nullish: 'undefined' };
    }
  }
  return null;
}

/**
 * Whether `node` is `typeof <expr> ==/===/!=/!== '<literalValue>'` (either
 * operand order).
 */
function isTypeofComparison(
  node: ESTree.BinaryExpression,
  literalValue: string,
): boolean {
  if (
    !EQUALITY_OPERATORS.has(node.operator) &&
    !INEQUALITY_OPERATORS.has(node.operator)
  ) {
    return false;
  }
  for (const [a, b] of [
    [node.left, node.right],
    [node.right, node.left],
  ]) {
    if (
      a.type === 'UnaryExpression' &&
      a.operator === 'typeof' &&
      b.type === 'Literal' &&
      b.value === literalValue
    ) {
      return true;
    }
  }
  return false;
}

export default defineRule({
  meta: {
    type: 'suggestion',
    messages: {
      preferIsTruthy:
        'Use `.filter(isTruthy)` with `isTruthy` from `@sindresorhus/is` instead of `.filter(Boolean)` for a properly typed result.',
      preferIsString:
        "Use `isString()` from `@sindresorhus/is` instead of comparing `typeof` against 'string'.",
      preferIsNullOrUndefined:
        'Use `isNullOrUndefined()` from `@sindresorhus/is` instead of comparing against both `null` and `undefined`.',
      preferNotIsNullOrUndefined:
        'Use `!isNullOrUndefined()` from `@sindresorhus/is` instead of comparing against both `null` and `undefined`.',
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        // `.filter(Boolean)`
        if (
          node.callee.type === 'MemberExpression' &&
          !node.callee.computed &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'filter' &&
          node.arguments.length === 1 &&
          node.arguments[0].type === 'Identifier' &&
          node.arguments[0].name === 'Boolean'
        ) {
          context.report({ node, messageId: 'preferIsTruthy' });
        }
      },
      BinaryExpression(node) {
        // `typeof x === 'string'` / `typeof x !== 'string'`
        if (isTypeofComparison(node, 'string')) {
          context.report({ node, messageId: 'preferIsString' });
        }
      },
      LogicalExpression(node) {
        // `x === null || x === undefined` / `x !== null && x !== undefined`
        let operators: Set<string>;
        if (node.operator === '||') {
          operators = EQUALITY_OPERATORS;
        } else if (node.operator === '&&') {
          operators = INEQUALITY_OPERATORS;
        } else {
          return;
        }
        const left = getNullishComparison(node.left, operators);
        const right = getNullishComparison(node.right, operators);
        if (
          left &&
          right &&
          left.nullish !== right.nullish &&
          isSameRef(left.ref, right.ref)
        ) {
          context.report({
            node,
            messageId:
              node.operator === '||'
                ? 'preferIsNullOrUndefined'
                : 'preferNotIsNullOrUndefined',
          });
        }
      },
    };
  },
});
