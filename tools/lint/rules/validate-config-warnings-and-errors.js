/**
 * `validateConfig()` returns `{ warnings, errors }`. Checking only one of the
 * two silently drops the other: callers that check `errors` but not
 * `warnings` (or vice versa) miss regressions in the half they didn't check.
 * Checking only the *length* of one has the same problem in a subtler form:
 * `expect(errors).toHaveLength(2)` (or a bare `errors.length` test) passes
 * whether the messages are the expected ones or complete garbage.
 *
 * This rule requires every call site to both reference `warnings` and
 * `errors`, and to do so in a way that inspects their actual contents
 * (`toEqual`, `toMatchObject`, logging the array, concatenating it, etc.),
 * not merely their length.
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
  if (declarator.type === 'VariableDeclarator' && declarator.init === target) {
    return declarator;
  }
  return null;
}

/**
 * Maps each destructured key (`warnings` / `errors`) to its local binding
 * name, e.g. `{ warnings: w }` maps `warnings` -> `w`; `{ warnings }` maps
 * `warnings` -> `warnings`.
 * @param {any} pattern
 * @returns {Map<string, string>}
 */
function getDestructuredBindings(pattern) {
  /** @type {Map<string, string>} */
  const bindings = new Map();
  for (const prop of pattern.properties) {
    if (
      prop.type === 'Property' &&
      !prop.computed &&
      prop.key.type === 'Identifier' &&
      prop.value.type === 'Identifier'
    ) {
      bindings.set(prop.key.name, prop.value.name);
    }
  }
  return bindings;
}

/**
 * Find the nearest enclosing function body (or the `Program`, at top level)
 * to search for later uses of the result.
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
 * True when `node` is only the object-literal key of a non-shorthand
 * property, e.g. the `warnings` in `{ warnings: someUnrelatedVar }` — a
 * label, not a reference to a `warnings` binding.
 * @param {any} node
 * @returns {boolean}
 */
function isPropertyKeyLabel(node) {
  const { parent } = node;
  return (
    parent.type === 'Property' &&
    parent.key === node &&
    !parent.computed &&
    !parent.shorthand
  );
}

/**
 * Classifies how `node` (an Identifier or MemberExpression referencing the
 * checked value) is used:
 * - `'matcher'`: `expect(<node>).toHaveLength(...)` — a banned Jest/vitest
 *   length assertion, flagged unconditionally, however else the value is
 *   checked elsewhere.
 * - `'property'`: a bare `<node>.length` read (e.g. an `if` gate before
 *   using the real value) — not itself banned, but doesn't count as
 *   inspecting the actual contents.
 * - `null`: anything else, e.g. `toEqual(...)`, `toMatchObject(...)`,
 *   logging, concatenation — counts as inspecting the actual contents.
 * @param {any} node
 * @returns {'matcher' | 'property' | null}
 */
function classifyLengthUsage(node) {
  const { parent } = node;
  if (
    parent.type === 'MemberExpression' &&
    !parent.computed &&
    parent.object === node &&
    parent.property.type === 'Identifier' &&
    parent.property.name === 'length'
  ) {
    return 'property';
  }
  if (
    parent.type === 'CallExpression' &&
    parent.callee.type === 'Identifier' &&
    parent.callee.name === 'expect' &&
    parent.arguments.includes(node)
  ) {
    const grandparent = parent.parent;
    if (
      grandparent?.type === 'MemberExpression' &&
      grandparent.object === parent &&
      !grandparent.computed &&
      grandparent.property.type === 'Identifier' &&
      grandparent.property.name === 'toHaveLength'
    ) {
      return 'matcher';
    }
  }
  return null;
}

/**
 * Recursively scans the subtree rooted at `root` (skipping `skip`, e.g. the
 * destructuring pattern itself) for nodes matched by `classify`, tracking,
 * per matched name: whether any usage exists, whether any usage inspects
 * the actual contents (as opposed to only its length), and every
 * `expect(...).toHaveLength(...)` call found (banned outright).
 * @param {any} root
 * @param {any} skip
 * @param {(node: any) => string | null} classify
 * @returns {Map<string, { any: boolean, value: boolean, toHaveLengthCalls: any[] }>}
 */
function scanUsages(root, skip, classify) {
  /** @type {Map<string, { any: boolean, value: boolean, toHaveLengthCalls: any[] }>} */
  const results = new Map();
  /** @type {any[]} */
  const stack = [root];
  const seen = new Set();
  while (stack.length > 0) {
    const node = stack.pop();
    if (
      node === null ||
      typeof node !== 'object' ||
      typeof node.type !== 'string' ||
      seen.has(node) ||
      node === skip
    ) {
      continue;
    }
    seen.add(node);

    const name = classify(node);
    if (name !== null) {
      const state = results.get(name) ?? {
        any: false,
        value: false,
        toHaveLengthCalls: [],
      };
      state.any = true;
      const kind = classifyLengthUsage(node);
      if (kind === 'matcher') {
        state.toHaveLengthCalls.push(node.parent.parent);
      } else if (kind === null) {
        state.value = true;
      }
      results.set(name, state);
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
  return results;
}

/**
 * Reports the length-related problems for one tracked name (`warnings` /
 * `errors`), given its usage state: any `expect(...).toHaveLength(...)`
 * call is banned outright; absent that, checking only via bare `.length`
 * (or not being referenced again at all) is reported as `lengthOnly`.
 * @param {import('eslint').Rule.RuleContext} context
 * @param {any} reportNode
 * @param {'warnings' | 'errors'} name
 * @param {{ any: boolean, value: boolean, toHaveLengthCalls: any[] } | undefined} state
 * @param {'lengthOnlyWarnings' | 'lengthOnlyErrors'} lengthOnlyMessageId
 */
function reportLengthUsage(
  context,
  reportNode,
  name,
  state,
  lengthOnlyMessageId,
) {
  const calls = state?.toHaveLengthCalls ?? [];
  if (calls.length > 0) {
    for (const call of calls) {
      context.report({
        node: call,
        messageId: 'noToHaveLength',
        data: { name },
      });
    }
    return;
  }
  if (!state?.value) {
    context.report({ node: reportNode, messageId: lengthOnlyMessageId });
  }
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
      lengthOnlyWarnings:
        '`warnings` from `validateConfig()` is only checked by length (`.length`), not its actual contents. A wrong or unexpected warning would pass unnoticed; assert on the value itself (e.g. `toEqual`, `toMatchObject`).',
      lengthOnlyErrors:
        '`errors` from `validateConfig()` is only checked by length (`.length`), not its actual contents. A wrong or unexpected error would pass unnoticed; assert on the value itself (e.g. `toEqual`, `toMatchObject`).',
      noToHaveLength:
        "Don't check `{{name}}` from `validateConfig()` with `toHaveLength()` — it passes whether the {{name}} are correct or garbage, even alongside a partial check elsewhere. Assert on the whole value instead (`toEqual`, `toMatchObject`), which also verifies the count.",
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
          const bindings = getDestructuredBindings(declarator.id);
          if (!bindings.has('warnings')) {
            context.report({
              node: declarator.id,
              messageId: 'missingWarnings',
            });
          }
          if (!bindings.has('errors')) {
            context.report({
              node: declarator.id,
              messageId: 'missingErrors',
            });
          }

          const localToKey = new Map(
            [...bindings.entries()].map(([key, local]) => [local, key]),
          );
          const root = findSearchRoot(declarator);
          const usages = scanUsages(root, declarator.id, (candidate) => {
            if (
              candidate.type !== 'Identifier' ||
              isPropertyKeyLabel(candidate)
            ) {
              return null;
            }
            return localToKey.get(candidate.name) ?? null;
          });

          if (bindings.has('warnings')) {
            reportLengthUsage(
              context,
              declarator.id,
              'warnings',
              usages.get('warnings'),
              'lengthOnlyWarnings',
            );
          }
          if (bindings.has('errors')) {
            reportLengthUsage(
              context,
              declarator.id,
              'errors',
              usages.get('errors'),
              'lengthOnlyErrors',
            );
          }
          return;
        }

        if (declarator.id.type === 'Identifier') {
          const bindingName = declarator.id.name;
          const root = findSearchRoot(declarator);
          const usages = scanUsages(root, null, (candidate) => {
            if (
              candidate.type !== 'MemberExpression' ||
              candidate.computed ||
              candidate.object.type !== 'Identifier' ||
              candidate.object.name !== bindingName ||
              candidate.property.type !== 'Identifier'
            ) {
              return null;
            }
            const { name } = candidate.property;
            return name === 'warnings' || name === 'errors' ? name : null;
          });

          const warningsState = usages.get('warnings');
          if (warningsState?.any) {
            reportLengthUsage(
              context,
              declarator.id,
              'warnings',
              warningsState,
              'lengthOnlyWarnings',
            );
          } else {
            context.report({
              node: declarator.id,
              messageId: 'missingWarnings',
            });
          }
          const errorsState = usages.get('errors');
          if (errorsState?.any) {
            reportLengthUsage(
              context,
              declarator.id,
              'errors',
              errorsState,
              'lengthOnlyErrors',
            );
          } else {
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
