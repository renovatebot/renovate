import * as renovateWorker from './workers/global';

jest.mock('./workers/global');

describe('renovate', () => {
  it('starts', () => {
    require('./renovate');
    expect(renovateWorker.start).toHaveBeenCalledTimes(1);
  });
});
