/**
 * `validateConfig()` returns `{ warnings, errors }`. Checking only one of the
 * two silently drops the other: callers that check `errors` but not
 * `warnings` (or vice versa) miss regressions in the half they didn't check.
 * This rule requires every call site to check both, either by destructuring
 * both properties or by accessing `<result>.warnings` and `<result>.errors`
 * somewhere in the enclosing function.
 */

/**
 * @param {any} callee
 * @returns {boolean}
 */
function isValidateConfigCallee(callee) {
  if (callee.type === 'Identifier') {
    return callee.name === 'validateConfig';
  }
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'validateConfig'
  );
}

/**
 * Walk up from the call, unwrapping a surrounding `await`, to find the
 * `VariableDeclarator` the result is assigned to (if any).
 * @param {any} node
 * @returns {any}
 */
function findDeclarator(node) {
  const target = node.parent.type === 'AwaitExpression' ? node.parent : node;
  const declarator = target.parent;
  if (
    declarator.type === 'VariableDeclarator' &&
    declarator.init === target
  ) {
    return declarator;
  }
  return null;
}

/**
 * Names bound by an `ObjectPattern`'s non-rest properties, e.g. `warnings`
 * from `{ warnings: w }` or `{ warnings }`.
 * @param {any} pattern
 * @returns {Set<string>}
 */
function getDestructuredKeys(pattern) {
  const keys = new Set();
  for (const prop of pattern.properties) {
    if (
      prop.type === 'Property' &&
      !prop.computed &&
      prop.key.type === 'Identifier'
    ) {
      keys.add(prop.key.name);
    }
  }
  return keys;
}

/**
 * Find the nearest enclosing function body (or the `Program`, at top level)
 * to search for later uses of the result-holding identifier.
 * @param {any} node
 * @returns {any}
 */
function findSearchRoot(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (
      current.type === 'FunctionDeclaration' ||
      current.type === 'FunctionExpression' ||
      current.type === 'ArrowFunctionExpression'
    ) {
      return current.body;
    }
    if (current.type === 'Program') {
      return current;
    }
  }
  return node;
}

/**
 * Whether `<bindingName>.warnings` / `<bindingName>.errors` member accesses
 * appear anywhere in the subtree rooted at `root`.
 * @param {any} root
 * @param {string} bindingName
 * @returns {{ hasWarnings: boolean, hasErrors: boolean }}
 */
function scanMemberAccess(root, bindingName) {
  let hasWarnings = false;
  let hasErrors = false;
  /** @type {any[]} */
  const stack = [root];
  const seen = new Set();
  while (stack.length > 0) {
    const node = stack.pop();
    if (
      node === null ||
      typeof node !== 'object' ||
      typeof node.type !== 'string' ||
      seen.has(node)
    ) {
      continue;
    }
    seen.add(node);

    if (
      node.type === 'MemberExpression' &&
      !node.computed &&
      node.object.type === 'Identifier' &&
      node.object.name === bindingName &&
      node.property.type === 'Identifier'
    ) {
      if (node.property.name === 'warnings') {
        hasWarnings = true;
      } else if (node.property.name === 'errors') {
        hasErrors = true;
      }
    }

    for (const key in node) {
      if (key === 'parent') {
        continue;
      }
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === 'object') {
            stack.push(item);
          }
        }
      } else if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }
  return { hasWarnings, hasErrors };
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    messages: {
      missingWarnings:
        'This `validateConfig()` result checks `errors` but not `warnings`; a warning-triggering regression could go unnoticed. Check both.',
      missingErrors:
        'This `validateConfig()` result checks `warnings` but not `errors`; an error-triggering regression could go unnoticed. Check both.',
      uncheckedResult:
        'The result of `validateConfig()` must be assigned to a variable (destructured as `{ warnings, errors }`, or bound and checked via `<result>.warnings` / `<result>.errors`) so both can be checked.',
    },
  },
  create(context) {
    return {
      /** @param {any} node */
      CallExpression(node) {
        if (
          node.callee.type !== 'Identifier' &&
          node.callee.type !== 'MemberExpression'
        ) {
          return;
        }
        if (!isValidateConfigCallee(node.callee)) {
          return;
        }

        const declarator = findDeclarator(node);
        if (declarator === null) {
          context.report({ node, messageId: 'uncheckedResult' });
          return;
        }

        if (declarator.id.type === 'ObjectPattern') {
          const keys = getDestructuredKeys(declarator.id);
          if (!keys.has('warnings')) {
            context.report({
              node: declarator.id,
              messageId: 'missingWarnings',
            });
          }
          if (!keys.has('errors')) {
            context.report({
              node: declarator.id,
              messageId: 'missingErrors',
            });
          }
          return;
        }

        if (declarator.id.type === 'Identifier') {
          const root = findSearchRoot(declarator);
          const { hasWarnings, hasErrors } = scanMemberAccess(
            root,
            declarator.id.name,
          );
          if (!hasWarnings) {
            context.report({
              node: declarator.id,
              messageId: 'missingWarnings',
            });
          }
          if (!hasErrors) {
            context.report({
              node: declarator.id,
              messageId: 'missingErrors',
            });
          }
          return;
        }

        context.report({ node, messageId: 'uncheckedResult' });
      },
    };
  },
};
