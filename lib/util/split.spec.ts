import { addSplit, getSplits, splitInit } from './split';

describe('util/split', () => {
  it('adds splits and returns results', () => {
    vi.setSystemTime(0);
    splitInit();

    vi.setSystemTime(1000);
    addSplit('init');

    vi.setSystemTime(3000);
    addSplit('lookup');

    const res = getSplits();
    expect(res.total).toBeDefined();
    expect(res.splits.init).toEqual(1000);
    expect(res.splits.lookup).toEqual(2000);
  });
});
