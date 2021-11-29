import { addSplit, getSplits, splitInit } from './split';

describe('util/split', () => {
  it('adds splits and returns results', () => {
    splitInit();
    addSplit('one');
    addSplit('two');
    const res = getSplits();
    expect(res.total).toBeDefined();
    expect(Object.keys(res.splits)).toHaveLength(2);
  });
});
