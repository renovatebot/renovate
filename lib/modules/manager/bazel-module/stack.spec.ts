import { Stack } from './stack';

describe('modules/manager/bazel-module/stack', () => {
  describe('Stack', () => {
    it.each`
      items                  | exp
      ${[]}                  | ${undefined}
      ${['first', 'second']} | ${'second'}
    `('get current for $items', ({ items, exp }) => {
      const stack = Stack.create(...items);
      expect(stack.safeCurrent).toBe(exp);
    });
  });
});
