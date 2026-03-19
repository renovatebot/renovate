import * as otel from './instrumentation/index.ts';
import * as renovateWorker from './workers/global/index.ts';

vi.mock('./instrumentation/index.ts');
vi.mock('./proxy.ts');
vi.mock('./workers/global/index.ts');

describe('renovate', () => {
  it('starts', async () => {
    vi.mocked(otel.instrument).mockImplementationOnce((_, cb) => cb());
    const waiter = new Promise<void>((resolve) => {
      vi.mocked(otel.shutdown).mockImplementationOnce(() => {
        resolve();
        return Promise.resolve();
      });
    });
    await vi.importActual('./renovate.ts');
    await waiter;
    expect(renovateWorker.start).toHaveBeenCalledTimes(1);
  });
});
