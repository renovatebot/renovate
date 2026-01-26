import * as renovateWorker from './workers/global';

vi.mock('./workers/global');

describe('renovate', () => {
  it('starts', async () => {
    await vi.importActual('./renovate');
    expect(renovateWorker.start).toHaveBeenCalledTimes(1);
  });
});
