import { memoize } from './memoize';

describe('util/memoize', () => {
  let calledTimes = 0;

  it('works', () => {
    const fn = (): number => {
      calledTimes += 1;
      return calledTimes;
    };
    const memFn = memoize(fn);

    expect(memFn()).toBe(1);
    expect(memFn()).toBe(1);
    expect(calledTimes).toBe(1);
  });
});
