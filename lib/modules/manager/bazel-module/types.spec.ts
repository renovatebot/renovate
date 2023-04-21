import { Stack } from './types';

describe('modules/manager/bazel-module/types', () => {
  describe('Stack', () => {
    it.each`
      items                  | exp
      ${[]}                  | ${null}
      ${['first', 'second']} | ${'second'}
    `('get current for $items', ({ items, exp }) => {
      const stack = Stack.create(...items);
      expect(stack.current).toBe(exp);
    });
  });
});
