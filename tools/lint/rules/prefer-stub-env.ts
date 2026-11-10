import type { ESTree } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

/**
 * Names of the vitest suite functions that establish the innermost calling
 * context. Walking up from a `process.env` mutation, the first of these found
 * decides whether the mutation happens per-test (where `vi.stubEnv` works) or
 * once per file (where it does not).
 */
const CONTEXT_NAMES = new Set([
  'beforeEach',
  'afterEach',
  'beforeAll',
  'afterAll',
  'it',
  'test',
  'describe',
]);

/**
 * Contexts that run per test. `unstubEnvs` reverts stubs *before* each test,
 * so only stubs created from here survive into the test that needs them.
 *
 * Module scope, `describe` bodies and `beforeAll` / `afterAll` are absent on
 * purpose: a `vi.stubEnv()` call there is undone before the first test runs,
 * so those have to keep assigning to `process.env` directly.
 */
const PER_TEST_CONTEXTS = new Set(['beforeEach', 'afterEach', 'it', 'test']);

/**
 * Resolve the name a suite function is called by, so that `it.each(...)(...)`
 * and `it.only(...)` are recognised the same way as a plain `it(...)`.
 */
function getCalleeName(callee: ESTree.Node): string | null {
  switch (callee.type) {
    case 'Identifier':
      return callee.name;
    // `it.only`, `test.each`, ...
    case 'MemberExpression':
      return callee.object.type === 'Identifier' ? callee.object.name : null;
    // `it.each([...])(...)` calls the result of `it.each([...])`
    case 'CallExpression':
      return getCalleeName(callee.callee);
    default:
      return null;
  }
}

/** Find the name of the innermost enclosing suite function call. */
function getEnclosingContextName(node: ESTree.Node): string | null {
  for (
    let current: ESTree.Node | null = node.parent;
    current;
    current = current.parent
  ) {
    if (current.type === 'CallExpression') {
      const name = getCalleeName(current.callee);
      if (name !== null && CONTEXT_NAMES.has(name)) {
        return name;
      }
    }
  }
  return null;
}

/** Whether `node` is the `process.env` member expression. */
function isProcessEnv(node: ESTree.Node): boolean {
  return (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.object.type === 'Identifier' &&
    node.object.name === 'process' &&
    node.property.type === 'Identifier' &&
    node.property.name === 'env'
  );
}

/** Whether `node` reads a single variable off `process.env`. */
function isProcessEnvMember(
  node: ESTree.Node,
): node is ESTree.MemberExpression {
  return node.type === 'MemberExpression' && isProcessEnv(node.object);
}

export default defineRule({
  meta: {
    type: 'suggestion',
    fixable: 'code',
    messages: {
      preferStubEnv:
        'Use `vi.stubEnv({{key}}, ...)` instead of assigning to `process.env` inside `{{context}}`. `unstubEnvs` is enabled in vitest.config.mts, so stubs are reverted before every test and need no manual cleanup.',
      preferStubEnvDelete:
        'Use `vi.stubEnv({{key}}, undefined)` instead of `delete process.env` inside `{{context}}`. `unstubEnvs` is enabled in vitest.config.mts, so stubs are reverted before every test and need no manual cleanup.',
      noProcessEnvReassign:
        'Do not replace the `process.env` object. `vi.stubEnv()` captures the original object when the worker starts, so after a reassignment its deletes silently target the old object and leave the variable set. Stub the individual variables instead.',
    },
  },
  createOnce(context) {
    /**
     * Source text of the key to pass to `vi.stubEnv`: the literal property
     * name quoted, or the computed expression verbatim.
     */
    function keyText(member: ESTree.MemberExpression): string {
      if (member.computed) {
        return context.sourceCode.getText(member.property);
      }
      return member.property.type === 'Identifier'
        ? `'${member.property.name}'`
        : context.sourceCode.getText(member.property);
    }

    return {
      AssignmentExpression(node) {
        // `process.env = { ...OLD_ENV }` breaks `vi.stubEnv` outright, so it is
        // reported wherever it appears, not just inside a per-test context.
        if (isProcessEnv(node.left)) {
          context.report({ node, messageId: 'noProcessEnvReassign' });
          return;
        }

        if (!isProcessEnvMember(node.left)) {
          return;
        }

        const contextName = getEnclosingContextName(node);
        if (contextName === null || !PER_TEST_CONTEXTS.has(contextName)) {
          return;
        }

        const key = keyText(node.left);
        context.report({
          node,
          messageId: 'preferStubEnv',
          data: { key, context: contextName },
          // Only a plain `=` maps onto a stub, and only as a statement: as an
          // expression the assignment yields the assigned value whereas
          // `vi.stubEnv()` yields the `vi` utils object.
          fix:
            node.operator === '=' && node.parent.type === 'ExpressionStatement'
              ? (fixer) =>
                  fixer.replaceText(
                    node,
                    `vi.stubEnv(${key}, ${context.sourceCode.getText(node.right)})`,
                  )
              : undefined,
        });
      },

      UnaryExpression(node) {
        if (node.operator !== 'delete' || !isProcessEnvMember(node.argument)) {
          return;
        }

        const contextName = getEnclosingContextName(node);
        if (contextName === null || !PER_TEST_CONTEXTS.has(contextName)) {
          return;
        }

        const key = keyText(node.argument);
        context.report({
          node,
          messageId: 'preferStubEnvDelete',
          data: { key, context: contextName },
          // `delete` yields a boolean, so only replace it as a statement.
          fix:
            node.parent.type === 'ExpressionStatement'
              ? (fixer) =>
                  fixer.replaceText(node, `vi.stubEnv(${key}, undefined)`)
              : undefined,
        });
      },
    };
  },
});
