import type { Context, ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

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
 * Per-name usage state collected by {@link scanUsages}: whether any usage
 * exists, whether any usage inspects the actual contents (as opposed to only
 * its length), and every `expect(...).toHaveLength(...)` call found.
 */
interface UsageState {
  any: boolean;
  value: boolean;
  toHaveLengthCalls: ESTree.Node[];
}

/**
 * How a reference to the checked value is used, as classified by
 * {@link classifyLengthUsage}.
 */
type LengthUsage =
  | { kind: 'matcher'; call: ESTree.MemberExpression }
  | { kind: 'property' }
  | null;

function isValidateConfigCallee(callee: ESTree.Expression): boolean {
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
 */
function findDeclarator(node: ESTree.Node): ESTree.VariableDeclarator | null {
  const target = node.parent?.type === 'AwaitExpression' ? node.parent : node;
  const declarator = target.parent;
  if (declarator?.type === 'VariableDeclarator' && declarator.init === target) {
    return declarator;
  }
  return null;
}

/**
 * Maps each destructured key (`warnings` / `errors`) to its local binding
 * name, e.g. `{ warnings: w }` maps `warnings` -> `w`; `{ warnings }` maps
 * `warnings` -> `warnings`.
 */
function getDestructuredBindings(
  pattern: ESTree.ObjectPattern,
): Map<string, string> {
  const bindings = new Map<string, string>();
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
 * to search for later uses of the result. A function without a body (an
 * overload signature) yields `null`, which {@link scanUsages} treats as an
 * empty subtree.
 */
function findSearchRoot(node: ESTree.Node): ESTree.Node | null {
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
 */
function isPropertyKeyLabel(node: ESTree.Node): boolean {
  const { parent } = node;
  return (
    parent?.type === 'Property' &&
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
 *   checked elsewhere. The matched `expect(...).toHaveLength` member
 *   expression is returned along with it, as the node to report.
 * - `'property'`: a bare `<node>.length` read (e.g. an `if` gate before
 *   using the real value) — not itself banned, but doesn't count as
 *   inspecting the actual contents.
 * - `null`: anything else, e.g. `toEqual(...)`, `toMatchObject(...)`,
 *   logging, concatenation — counts as inspecting the actual contents.
 */
function classifyLengthUsage(node: ESTree.Node): LengthUsage {
  const { parent } = node;
  if (
    parent?.type === 'MemberExpression' &&
    !parent.computed &&
    parent.object === node &&
    parent.property.type === 'Identifier' &&
    parent.property.name === 'length'
  ) {
    return { kind: 'property' };
  }
  if (
    parent?.type === 'CallExpression' &&
    parent.callee.type === 'Identifier' &&
    parent.callee.name === 'expect' &&
    parent.arguments.some((argument) => argument === node)
  ) {
    const grandparent = parent.parent;
    if (
      grandparent?.type === 'MemberExpression' &&
      grandparent.object === parent &&
      !grandparent.computed &&
      grandparent.property.type === 'Identifier' &&
      grandparent.property.name === 'toHaveLength'
    ) {
      return { kind: 'matcher', call: grandparent };
    }
  }
  return null;
}

/**
 * Whether `value` is an AST node, i.e. an object carrying a `type` string.
 * Used to filter the arbitrary property values the walk below collects; the
 * discriminated `ESTree.Node` union cannot describe them up front. The
 * `Record` half of the result type is what lets the walk read a node's
 * children by arbitrary key — the union itself has no index signature.
 */
function isNode(
  value: unknown,
): value is ESTree.Node & Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

/**
 * Recursively scans the subtree rooted at `root` (skipping `skip`, e.g. the
 * destructuring pattern itself) for nodes matched by `classify`, tracking,
 * per matched name: whether any usage exists, whether any usage inspects
 * the actual contents (as opposed to only its length), and every
 * `expect(...).toHaveLength(...)` call found (banned outright).
 */
function scanUsages(
  root: ESTree.Node | null,
  skip: ESTree.Node | null,
  classify: (node: ESTree.Node) => string | null,
): Map<string, UsageState> {
  const results = new Map<string, UsageState>();
  const stack: unknown[] = [root];
  const seen = new Set<ESTree.Node>();
  while (stack.length > 0) {
    const node = stack.pop();
    if (!isNode(node) || seen.has(node) || node === skip) {
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
      const usage = classifyLengthUsage(node);
      if (usage?.kind === 'matcher') {
        state.toHaveLengthCalls.push(usage.call);
      } else if (usage === null) {
        state.value = true;
      }
      results.set(name, state);
    }

    // The walk descends into every key of every node; children are
    // re-narrowed by `isNode` when popped off the stack again.
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
 */
function reportLengthUsage(
  context: Context,
  reportNode: ESTree.Node,
  name: 'warnings' | 'errors',
  state: UsageState | undefined,
  lengthOnlyMessageId: 'lengthOnlyWarnings' | 'lengthOnlyErrors',
): void {
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
    context.report({
      node: reportNode,
      messageId: lengthOnlyMessageId,
    });
  }
}

export default defineRule({
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
  createOnce(context) {
    return {
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
          const pattern = declarator.id;
          const bindings = getDestructuredBindings(pattern);
          if (!bindings.has('warnings')) {
            context.report({
              node: pattern,
              messageId: 'missingWarnings',
            });
          }
          if (!bindings.has('errors')) {
            context.report({
              node: pattern,
              messageId: 'missingErrors',
            });
          }

          const localToKey = new Map(
            [...bindings.entries()].map(([key, local]) => [local, key]),
          );
          const root = findSearchRoot(declarator);
          const usages = scanUsages(root, pattern, (candidate) => {
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
              pattern,
              'warnings',
              usages.get('warnings'),
              'lengthOnlyWarnings',
            );
          }
          if (bindings.has('errors')) {
            reportLengthUsage(
              context,
              pattern,
              'errors',
              usages.get('errors'),
              'lengthOnlyErrors',
            );
          }
          return;
        }

        if (declarator.id.type === 'Identifier') {
          const identifier = declarator.id;
          const bindingName = identifier.name;
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
              identifier,
              'warnings',
              warningsState,
              'lengthOnlyWarnings',
            );
          } else {
            context.report({
              node: identifier,
              messageId: 'missingWarnings',
            });
          }
          const errorsState = usages.get('errors');
          if (errorsState?.any) {
            reportLengthUsage(
              context,
              identifier,
              'errors',
              errorsState,
              'lengthOnlyErrors',
            );
          } else {
            context.report({
              node: identifier,
              messageId: 'missingErrors',
            });
          }
          return;
        }

        context.report({ node, messageId: 'uncheckedResult' });
      },
    };
  },
});
