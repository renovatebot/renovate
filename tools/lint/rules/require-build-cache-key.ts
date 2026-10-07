import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

/** Callees whose first argument is an options object with a `key`. */
const optionsCallees = new Set(['withCache', 'cache']);

/** `packageCache` methods which take the key as their second argument. */
const packageCacheMethods = new Set(['get', 'set', 'setWithRawTtl']);

/** Names of functions which return a cache key. */
const cacheKeyFunctionName = /cacheKey$/i;

/**
 * Whether the expression builds a key inline, with a template literal that has
 * expressions or with `+`, including either branch of a conditional.
 */
function isInlineKey(node: ESTree.Node): boolean {
  if (node.type === 'TemplateLiteral') {
    return node.expressions.length > 0;
  }
  if (node.type === 'BinaryExpression') {
    return node.operator === '+';
  }
  if (node.type === 'ConditionalExpression') {
    return isInlineKey(node.consequent) || isInlineKey(node.alternate);
  }
  return false;
}

/** Returns the expression passed as `key` in an options object. */
function getKeyProperty(
  options: ESTree.Argument | undefined,
): ESTree.Node | undefined {
  if (options?.type !== 'ObjectExpression') {
    return undefined;
  }
  for (const property of options.properties) {
    if (
      property.type === 'Property' &&
      !property.computed &&
      property.key.type === 'Identifier' &&
      property.key.name === 'key'
    ) {
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
  if (callee.type === 'Identifier' && optionsCallees.has(callee.name)) {
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

  if (
    callee.object.type === 'Identifier' &&
    callee.object.name === 'packageCache' &&
    packageCacheMethods.has(method)
  ) {
    return node.arguments[1];
  }

  return undefined;
}

/** Returns the name of a function declaration, method or assigned function. */
function getFunctionName(node: ESTree.Node): string | undefined {
  if (
    (node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression') &&
    node.id
  ) {
    return node.id.name;
  }

  const { parent } = node;
  if (
    parent?.type === 'MethodDefinition' &&
    !parent.computed &&
    parent.key.type === 'Identifier'
  ) {
    return parent.key.name;
  }
  if (
    parent?.type === 'VariableDeclarator' &&
    parent.id.type === 'Identifier'
  ) {
    return parent.id.name;
  }
  return undefined;
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

/** Whether the function's name ends in `cacheKey`. */
function isCacheKeyFunction(node: ESTree.Node | null): boolean {
  const name = node ? getFunctionName(node) : undefined;
  return !!name && cacheKeyFunctionName.test(name);
}

/**
 * Reports cache keys built inline with a template literal or `+` instead of
 * with `buildCacheKey()`.
 *
 * Checks the `key` of `withCache()`, `this.cached()` and `@cache()` options,
 * the key argument of `packageCache.get()`, `packageCache.set()` and
 * `packageCache.setWithRawTtl()`, and the values returned from functions whose
 * name ends in `cacheKey`.
 */
export default defineRule({
  meta: {
    type: 'problem',
    messages: {
      requireBuildCacheKey:
        'Build cache keys with buildCacheKey() from lib/util/cache/package/key.ts instead of a template literal or string concatenation.',
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        let key = getCacheKeyArgument(node);
        if (
          key?.type === 'ArrowFunctionExpression' &&
          key.body.type !== 'BlockStatement'
        ) {
          key = key.body;
        }
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
