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
 * @param {import('estree').Node} node
 * @returns {import('estree').Node}
 */
function unwrapChain(node) {
  return node.type === 'ChainExpression' ? node.expression : node;
}

/**
 * Whether two nodes are the same simple reference: an identifier, `this`, or
 * a member chain of those with identifier or literal keys. Anything with
 * possible side effects (calls, complex computed keys) is not considered.
 * @param {import('estree').Node} rawA
 * @param {import('estree').Node} rawB
 * @returns {boolean}
 */
function isSameRef(rawA, rawB) {
  const a = unwrapChain(rawA);
  const b = unwrapChain(rawB);
  if (a.type !== b.type) {
    return false;
  }
  switch (a.type) {
    case 'Identifier':
      return a.name === /** @type {import('estree').Identifier} */ (b).name;
    case 'ThisExpression':
      return true;
    case 'MemberExpression': {
      const other = /** @type {import('estree').MemberExpression} */ (b);
      if (a.computed !== other.computed) {
        return false;
      }
      if (
        a.computed &&
        !(
          a.property.type === 'Literal' &&
          other.property.type === 'Literal' &&
          a.property.value === other.property.value
        )
      ) {
        return false;
      }
      if (
        !a.computed &&
        !(
          a.property.type === 'Identifier' &&
          other.property.type === 'Identifier' &&
          a.property.name === other.property.name
        )
      ) {
        return false;
      }
      return isSameRef(a.object, other.object);
    }
    default:
      return false;
  }
}

/**
 * If `node` compares a simple reference with `null` or `undefined` using one
 * of the given operators, return the reference and which nullish value it is
 * compared against; otherwise return null.
 * @param {import('estree').Node} node
 * @param {Set<string>} operators
 * @returns {{ ref: import('estree').Node, nullish: 'null' | 'undefined' } | null}
 */
function getNullishComparison(node, operators) {
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
 * @param {import('estree').BinaryExpression} node
 * @param {string} literalValue
 * @returns {boolean}
 */
function isTypeofComparison(node, literalValue) {
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

/** @type {import('eslint').Rule.RuleModule} */
export default {
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
  create(context) {
    const filename = context.filename ?? context.physicalFilename ?? '';
    // Only enforce in lib/ (sources and specs)
    if (!filename.includes('/lib/')) {
      return {};
    }
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
        /** @type {Set<string>} */
        let operators;
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
};
