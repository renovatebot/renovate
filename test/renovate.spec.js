const renovateWorker = require('../lib/workers');

renovateWorker.start = jest.fn();

describe('renovate', () => {
  it('starts', () => {
    require('../lib/renovate');
    expect(renovateWorker.start.mock.calls.length).toBe(1);
  });
});
