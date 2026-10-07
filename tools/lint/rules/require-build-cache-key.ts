import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';
import { getPropertyName } from '../utils/property-name.ts';

/** `packageCache` methods which take the key as their second argument. */
const packageCacheMethods = new Set(['get', 'set', 'setWithRawTtl']);

/** `memCache` methods which take the key as their first argument. */
const memCacheMethods = new Set(['get', 'set']);

/** Names of functions which return a cache key. */
const cacheKeyFunctionName = /cacheKey$/i;

/** Names of variables and class properties which hold a cache key. */
const cacheKeyVariableName = /^memKey$|cacheKey$/i;

/** Whether the expression joins an array literal, as in `[a, b].join(':')`. */
function isArrayJoin(node: ESTree.CallExpression): boolean {
  const { callee } = node;
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.name === 'join' &&
    callee.object.type === 'ArrayExpression'
  );
}

/**
 * Whether the expression builds a key inline, with a template literal that has
 * expressions, with `+` or by joining an array literal, looking through
 * conditional and logical operands and TypeScript `as`, `<T>`, `!` and
 * `satisfies` wrappers.
 */
function isInlineKey(node: ESTree.Node): boolean {
  switch (node.type) {
    case 'TemplateLiteral':
      return node.expressions.length > 0;
    case 'BinaryExpression':
      return node.operator === '+';
    case 'CallExpression':
      return isArrayJoin(node);
    case 'ConditionalExpression':
      return isInlineKey(node.consequent) || isInlineKey(node.alternate);
    case 'LogicalExpression':
      return isInlineKey(node.left) || isInlineKey(node.right);
    case 'TSAsExpression':
    case 'TSNonNullExpression':
    case 'TSSatisfiesExpression':
    case 'TSTypeAssertion':
      return isInlineKey(node.expression);
    default:
      return false;
  }
}

/** Returns the expression passed as `key` in an options object. */
function getKeyProperty(
  options: ESTree.Argument | undefined,
): ESTree.Node | undefined {
  if (options?.type !== 'ObjectExpression') {
    return undefined;
  }
  for (const property of options.properties) {
    if (property.type === 'Property' && getPropertyName(property) === 'key') {
      return property.value;
    }
  }
  return undefined;
}

/** Returns the expression used as cache key by the call, if any. */
function getCacheKeyArgument(
  node: ESTree.CallExpression,
): ESTree.Node | undefined {
  const { callee } = node;
  if (callee.type === 'Identifier' && callee.name === 'withCache') {
    return getKeyProperty(node.arguments[0]);
  }

  if (
    callee.type !== 'MemberExpression' ||
    callee.computed ||
    callee.property.type !== 'Identifier'
  ) {
    return undefined;
  }

  const method = callee.property.name;
  if (callee.object.type === 'ThisExpression' && method === 'cached') {
    return getKeyProperty(node.arguments[0]);
  }

  if (callee.object.type !== 'Identifier') {
    return undefined;
  }

  const object = callee.object.name;
  if (object === 'packageCache' && packageCacheMethods.has(method)) {
    return node.arguments[1];
  }
  if (object === 'memCache' && memCacheMethods.has(method)) {
    return node.arguments[0];
  }

  return undefined;
}

/**
 * Returns the names of a function: its own name, and the name of the class
 * method or property, object method or property, or variable it is assigned
 * to.
 */
function getFunctionNames(node: ESTree.Node): (string | undefined)[] {
  const names: (string | undefined)[] = [];
  if (
    (node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression') &&
    node.id
  ) {
    names.push(node.id.name);
  }

  const { parent } = node;
  if (
    parent?.type === 'MethodDefinition' ||
    parent?.type === 'PropertyDefinition' ||
    parent?.type === 'Property'
  ) {
    names.push(getPropertyName(parent));
  }
  if (
    parent?.type === 'VariableDeclarator' &&
    parent.id.type === 'Identifier'
  ) {
    names.push(parent.id.name);
  }
  return names;
}

function isFunction(node: ESTree.Node): boolean {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  );
}

/** Returns the innermost function enclosing the node. */
function getEnclosingFunction(node: ESTree.Node): ESTree.Node | null {
  let current: ESTree.Node | null = node.parent;
  while (current && !isFunction(current)) {
    current = current.parent;
  }
  return current;
}

/** Whether one of the function's names ends in `cacheKey`. */
function isCacheKeyFunction(node: ESTree.Node | null): boolean {
  const names = node ? getFunctionNames(node) : [];
  return names.some((name) => !!name && cacheKeyFunctionName.test(name));
}

/** Whether the name ends in `cacheKey` or is `memKey`. */
function isCacheKeyVariable(name: string | undefined): boolean {
  return !!name && cacheKeyVariableName.test(name);
}

/** Returns the name of an identifier or non-computed member assignment target. */
function getAssignmentTargetName(
  node: ESTree.AssignmentExpression['left'],
): string | undefined {
  if (node.type === 'Identifier') {
    return node.name;
  }
  if (node.type === 'MemberExpression' && !node.computed) {
    return node.property.name;
  }
  return undefined;
}

/**
 * Reports cache keys built inline with a template literal, `+` or an array
 * literal `join()` instead of with `buildCacheKey()`.
 *
 * Checks the `key` of `withCache()` and `this.cached()` options, the key
 * argument of `packageCache.get()`, `packageCache.set()`,
 * `packageCache.setWithRawTtl()`, `memCache.get()` and `memCache.set()`, the
 * values returned from functions whose name ends in `cacheKey`, and the
 * initialisers of and values assigned to variables and class properties whose
 * name ends in `cacheKey` or is `memKey`.
 */
export default defineRule({
  meta: {
    type: 'problem',
    messages: {
      requireBuildCacheKey:
        'Build cache keys with buildCacheKey() from lib/util/cache/package/key.ts instead of a template literal, string concatenation or array join.',
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const key = getCacheKeyArgument(node);
        if (key && isInlineKey(key)) {
          context.report({ node: key, messageId: 'requireBuildCacheKey' });
        }
      },
      ReturnStatement(node) {
        if (
          node.argument &&
          isInlineKey(node.argument) &&
          isCacheKeyFunction(getEnclosingFunction(node))
        ) {
          context.report({
            node: node.argument,
            messageId: 'requireBuildCacheKey',
          });
        }
      },
      VariableDeclarator(node) {
        if (
          node.init &&
          node.id.type === 'Identifier' &&
          isCacheKeyVariable(node.id.name) &&
          isInlineKey(node.init)
        ) {
          context.report({
            node: node.init,
            messageId: 'requireBuildCacheKey',
          });
        }
      },
      AssignmentExpression(node) {
        if (
          isCacheKeyVariable(getAssignmentTargetName(node.left)) &&
          isInlineKey(node.right)
        ) {
          context.report({
            node: node.right,
            messageId: 'requireBuildCacheKey',
          });
        }
      },
      PropertyDefinition(node) {
        if (
          node.value &&
          isCacheKeyVariable(getPropertyName(node)) &&
          isInlineKey(node.value)
        ) {
          context.report({
            node: node.value,
            messageId: 'requireBuildCacheKey',
          });
        }
      },
      ArrowFunctionExpression(node) {
        if (
          node.body.type !== 'BlockStatement' &&
          isInlineKey(node.body) &&
          isCacheKeyFunction(node)
        ) {
          context.report({
            node: node.body,
            messageId: 'requireBuildCacheKey',
          });
        }
      },
    };
  },
});
