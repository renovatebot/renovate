import type { Node } from '@oxlint/plugins';
import { defineRule } from '@oxlint/plugins';

const hookNames = new Set(['beforeAll', 'afterAll', 'beforeEach', 'afterEach']);

interface Hook {
  node: Node;
  name: string;
  timeout: string;
}

export default defineRule({
  meta: {},
  createOnce(context) {
    let hooks: Hook[] = [];
    return {
      before() {
        if (!context.filename.endsWith('.spec.ts')) {
          return false;
        }
        hooks = [];
      },
      CallExpression(node) {
        const { callee } = node;
        if (callee.type !== 'Identifier' || !hookNames.has(callee.name)) {
          return;
        }
        const timeoutArg = node.arguments[1];
        hooks.push({
          node,
          name: callee.name,
          timeout: timeoutArg
            ? context.sourceCode.getText(timeoutArg)
            : 'default',
        });
      },
      'Program:exit'() {
        const counts = new Map<string, number>();
        for (const { timeout } of hooks) {
          counts.set(timeout, (counts.get(timeout) ?? 0) + 1);
        }
        if (counts.size < 2) {
          return;
        }
        // most common wins; ties go to the first one seen
        let expected = hooks[0].timeout;
        for (const [timeout, count] of counts) {
          if (count > (counts.get(expected) ?? 0)) {
            expected = timeout;
          }
        }
        const expectedText =
          expected === 'default' ? 'no explicit timeout' : expected;
        for (const { node, name, timeout } of hooks) {
          if (timeout === expected) {
            continue;
          }
          const actual =
            timeout === 'default' ? 'no explicit timeout' : timeout;
          context.report({
            node,
            message: `All hooks in a spec file must use the same timeout: \`${name}\` has ${actual}, but most hooks use ${expectedText}.`,
          });
        }
      },
    };
  },
});
