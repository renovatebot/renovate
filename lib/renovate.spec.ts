import * as renovateWorker from './workers/global/index.ts';

vi.mock('./workers/global/index.ts');

describe('renovate', () => {
  it('starts', async () => {
    await vi.importActual('./renovate.ts');
    expect(renovateWorker.start).toHaveBeenCalledTimes(1);
  });
});
