import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';
import { getPropertyName } from '../utils/property-name.ts';

/**
 * Whether `node` calls `getOptions()`, either directly or as a member such as `options.getOptions()`.
 */
function isGetOptionsCall(node: ESTree.Node | null | undefined): boolean {
  if (node?.type !== 'CallExpression') {
    return false;
  }
  const { callee } = node;
  if (callee.type === 'Identifier') {
    return callee.name === 'getOptions';
  }
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'getOptions'
  );
}

/**
 * Returns the name which `param` binds to the option's `name`: the parameter itself for `o`, or the binding of `name` for `{ name }`.
 */
function getNameAccess(
  param: ESTree.Node | undefined,
): { object: string } | { binding: string } | undefined {
  if (param?.type === 'Identifier') {
    return { object: param.name };
  }
  if (param?.type !== 'ObjectPattern') {
    return undefined;
  }
  for (const property of param.properties) {
    if (
      property.type === 'Property' &&
      getPropertyName(property) === 'name' &&
      property.value.type === 'Identifier'
    ) {
      return { binding: property.value.name };
    }
  }
  return undefined;
}

/**
 * Whether `callback` is an arrow function which compares the option's `name` with `===`, like `(o) => o.name === 'foo'` or `({ name }) => name === 'foo'`.
 */
function isNameComparison(callback: ESTree.Node | undefined): boolean {
  if (
    callback?.type !== 'ArrowFunctionExpression' ||
    callback.body.type !== 'BinaryExpression' ||
    callback.body.operator !== '==='
  ) {
    return false;
  }
  const access = getNameAccess(callback.params[0]);
  if (!access) {
    return false;
  }
  const { left, right } = callback.body;
  return [left, right].some((side) => {
    if ('binding' in access) {
      return side.type === 'Identifier' && side.name === access.binding;
    }
    return (
      side.type === 'MemberExpression' &&
      !side.computed &&
      side.object.type === 'Identifier' &&
      side.object.name === access.object &&
      side.property.type === 'Identifier' &&
      side.property.name === 'name'
    );
  });
}

/**
 * Whether `node` looks up a single option: `find()`, or `filter()` by the option's `name`.
 */
function isLookup(node: ESTree.CallExpression): boolean {
  const { callee } = node;
  if (
    callee.type !== 'MemberExpression' ||
    callee.computed ||
    callee.property.type !== 'Identifier'
  ) {
    return false;
  }
  if (callee.property.name === 'find') {
    return true;
  }
  return (
    callee.property.name === 'filter' && isNameComparison(node.arguments[0])
  );
}

export default defineRule({
  meta: {
    type: 'suggestion',
    messages: {
      preferGetOption:
        'Use `getOption(name)` to look up a config option, instead of searching `getOptions()` with `find()` or `filter()`.',
    },
  },
  createOnce(context) {
    /** Names of variables initialized with `getOptions()`. */
    const optionsVariables = new Set<string>();
    /** Lookups on a variable, keyed by the variable name. */
    const lookups: { name: string; node: ESTree.Node }[] = [];

    return {
      before() {
        optionsVariables.clear();
        lookups.length = 0;
      },

      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && isGetOptionsCall(node.init)) {
          optionsVariables.add(node.id.name);
        }
      },

      CallExpression(node) {
        if (!isLookup(node)) {
          return;
        }
        const callee = node.callee as ESTree.MemberExpression;

        if (isGetOptionsCall(callee.object)) {
          context.report({ node, messageId: 'preferGetOption' });
          return;
        }

        if (callee.object.type === 'Identifier') {
          lookups.push({ name: callee.object.name, node });
        }
      },

      'Program:exit'() {
        for (const { name, node } of lookups) {
          if (optionsVariables.has(name)) {
            context.report({ node, messageId: 'preferGetOption' });
          }
        }
      },
    };
  },
});
