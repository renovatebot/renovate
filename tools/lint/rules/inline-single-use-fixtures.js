/**
 * Suggest inlining module-scope `const` fixtures that are referenced from
 * exactly one `it()` / `test()` block ("inline to test if only used once").
 *
 * Keeping a fixture next to the only test that uses it makes the test
 * self-contained and easier to read. This is a nudge, not a hard rule:
 * naming a value can still aid clarity, so the rule is meant to run at
 * "warn" severity and never provides an autofix (moving code is risky).
 *
 * A declaration is only flagged when ALL of the following hold:
 *
 * - It is a top-level (module-scope), non-exported `const` with a single
 *   declarator binding a plain identifier. Destructuring patterns and
 *   multi-declarator statements are skipped: "inline this binding" has no
 *   obvious mechanical meaning for them.
 * - The initializer spans multiple source lines. Single-line consts used
 *   once are often still clearer named (e.g. `const timeout = 60_000`), and
 *   inlining them saves nothing; multiline object/array/template fixtures
 *   are the real readability win.
 * - The initializer is not itself a function: `const helper = () => {...}`
 *   is a named helper, not a data fixture, and keeping helpers named aids
 *   readability and stack traces.
 * - Every reference lives inside the callback function of one and the same
 *   `it()` / `test()` call (including `.only` / `.skip` / `.each(...)` and
 *   similar chained variants).
 *
 * The reference check uses scope analysis (`getDeclaredVariables`), so
 * shadowing is handled inherently: only true references to the module-scope
 * binding are counted. Anything that is not clearly "inside the one test
 * callback" bails out — false negatives are fine, false positives are not.
 * In particular, the rule stays silent when the const is referenced:
 *
 * - in `describe` / `beforeEach` / `afterEach` / `beforeAll` / `afterAll`
 *   bodies or any other non-test code (module-scope helper functions,
 *   other module-scope declarations, `vi.mock()` factories, ...),
 * - in a test *title* (`` it(`parses ${fixture}`, ...) ``) or in an
 *   `it.each(table)` argument table — only references inside a function
 *   argument of the test call count,
 * - from more than one test, or from zero tests.
 */

const TEST_NAMES = new Set(['it', 'test']);

/**
 * Resolve the base identifier name of a (possibly chained) callee, e.g.
 * `it` -> `it`, `it.only` -> `it`, `it.each(...)` -> `it`,
 * `test.failing.each(...)` -> `test`.
 * @param {import('estree').Node} callee
 * @returns {string | null}
 */
function getCalleeBaseName(callee) {
  let current = callee;
  for (;;) {
    switch (current.type) {
      case 'Identifier':
        return current.name;
      case 'MemberExpression':
        current = current.object;
        break;
      case 'CallExpression':
        current = current.callee;
        break;
      default:
        return null;
    }
  }
}

/**
 * Find the `it()` / `test()` call whose callback function contains the
 * given identifier reference. Returns `null` when the reference is not
 * inside a function argument of a test call (bail-out).
 * @param {import('eslint').Rule.Node} identifier
 * @returns {import('estree').CallExpression | null}
 */
function findEnclosingTestCall(identifier) {
  let child = identifier;
  for (
    let current = child.parent;
    current;
    child = current, current = current.parent
  ) {
    if (
      current.type !== 'CallExpression' ||
      !TEST_NAMES.has(getCalleeBaseName(current.callee) ?? '')
    ) {
      continue;
    }
    // The reference must sit inside a function argument (the test
    // callback), not e.g. in the title template or an `.each` table.
    if (
      current.arguments.some((arg) => arg === child) &&
      (child.type === 'ArrowFunctionExpression' ||
        child.type === 'FunctionExpression')
    ) {
      return current;
    }
    return null;
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    messages: {
      inlineSingleUseFixture:
        'Fixture `{{name}}` is only used in a single test. Inline it into that `{{testName}}()` block, or keep it named only if the name genuinely aids clarity.',
    },
  },
  create(context) {
    const filename = context.filename ?? context.physicalFilename ?? '';
    if (!filename.endsWith('.spec.ts')) {
      return {};
    }
    return {
      /** @param {import('estree').VariableDeclaration} node */
      'Program > VariableDeclaration'(node) {
        if (node.kind !== 'const' || node.declarations.length !== 1) {
          return;
        }
        const declarator = node.declarations[0];
        if (declarator.id.type !== 'Identifier' || !declarator.init) {
          return;
        }
        // Named helper functions are not data fixtures.
        if (
          declarator.init.type === 'ArrowFunctionExpression' ||
          declarator.init.type === 'FunctionExpression'
        ) {
          return;
        }
        // Only multiline initializers: one-line consts are often clearer
        // named, and inlining them saves nothing.
        const initLoc = declarator.init.loc;
        if (!initLoc || initLoc.end.line <= initLoc.start.line) {
          return;
        }

        const variables = context.sourceCode.getDeclaredVariables(node);
        if (variables.length !== 1) {
          return;
        }
        const references = variables[0].references.filter((ref) => !ref.init);
        if (references.length === 0) {
          return;
        }

        /** @type {import('estree').CallExpression | null} */
        let testCall = null;
        for (const reference of references) {
          const enclosing = findEnclosingTestCall(
            /** @type {import('eslint').Rule.Node} */ (reference.identifier),
          );
          if (!enclosing || (testCall && enclosing !== testCall)) {
            return;
          }
          testCall = enclosing;
        }
        if (!testCall) {
          return;
        }

        context.report({
          node: declarator.id,
          messageId: 'inlineSingleUseFixture',
          data: {
            name: declarator.id.name,
            testName: getCalleeBaseName(testCall.callee) ?? 'it',
          },
        });
      },
    };
  },
};
