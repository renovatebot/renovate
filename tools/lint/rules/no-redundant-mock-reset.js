/**
 * Names of the vitest suite functions that establish the innermost calling
 * context. Walking up from a mock-reset call, the first of these found
 * decides whether the call runs inside a per-test hook (`beforeEach` /
 * `afterEach`) or somewhere it may be intentional (`it`, `beforeAll`, ...).
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

const HOOK_NAMES = new Set(['beforeEach', 'afterEach']);

/** Methods on the `vi` object made redundant by `mockReset: true`. */
const REDUNDANT_VI_METHODS = new Set(['resetAllMocks', 'clearAllMocks']);

/** Per-mock methods made redundant by `mockReset: true`. */
const REDUNDANT_MOCK_METHODS = new Set(['mockReset', 'mockClear']);

/**
 * Find the name of the innermost enclosing suite function call.
 * @param {import('eslint').Rule.Node} node
 * @returns {string | null}
 */
function getEnclosingContextName(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (
      current.type === 'CallExpression' &&
      current.callee.type === 'Identifier' &&
      CONTEXT_NAMES.has(current.callee.name)
    ) {
      return current.callee.name;
    }
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    messages: {
      redundantMockReset:
        '`{{call}}` in `{{hook}}` is redundant: `mockReset: true` is set globally in vitest.config.mts and resets all mocks before each test.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type !== 'MemberExpression' ||
          callee.computed ||
          callee.property.type !== 'Identifier'
        ) {
          return;
        }

        const method = callee.property.name;
        /** @type {string} */
        let call;
        if (
          callee.object.type === 'Identifier' &&
          callee.object.name === 'vi' &&
          REDUNDANT_VI_METHODS.has(method)
        ) {
          call = `vi.${method}()`;
        } else if (REDUNDANT_MOCK_METHODS.has(method)) {
          call = `.${method}()`;
        } else {
          return;
        }

        const contextName = getEnclosingContextName(node);
        if (contextName === null || !HOOK_NAMES.has(contextName)) {
          return;
        }

        context.report({
          node,
          messageId: 'redundantMockReset',
          data: { call, hook: contextName },
        });
      },
    };
  },
};
