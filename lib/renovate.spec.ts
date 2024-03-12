import * as renovateWorker from './workers/global';

Object.defineProperty(renovateWorker, 'start', { value: jest.fn() });

describe('renovate', () => {
  it('starts', async () => {
    await import('./renovate');
    expect(renovateWorker.start).toHaveBeenCalledTimes(1);
  });
});
