import { Stack } from './stack';

describe('modules/manager/bazel-module/stack', () => {
  describe('Stack', () => {
    it.each`
      items                  | exp
      ${[]}                  | ${undefined}
      ${['first', 'second']} | ${'second'}
    `('safely get current for $items', ({ items, exp }) => {
      const stack = Stack.create(...items);
      expect(stack.safeCurrent).toBe(exp);
    });

    it('current throws if no items', () => {
      const stack = Stack.create<string>();
      expect(() => stack.current).toThrow(
        new Error('Requested current, but no value.')
      );
    });
  });
});
