import { logger } from '../../test/util';
import * as memCache from './cache/memory';
import { LookupStats } from './stats';

describe('util/stats', () => {
  beforeEach(() => {
    memCache.init();
  });

  describe('LookupStats', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('writes data points', () => {
      LookupStats.write('npm', 100);
      LookupStats.write('npm', 200);
      LookupStats.write('npm', 400);
      LookupStats.write('docker', 1000);

      const res = LookupStats.getReport();

      expect(res).toEqual({
        docker: {
          avgMs: 1000,
          count: 1,
          maxMs: 1000,
          medianMs: 1000,
          totalMs: 1000,
        },
        npm: {
          avgMs: 233,
          count: 3,
          maxMs: 400,
          medianMs: 200,
          totalMs: 700,
        },
      });
    });

    it('wraps a function', async () => {
      const res = await LookupStats.wrap('npm', () => {
        jest.advanceTimersByTime(100);
        return Promise.resolve('foo');
      });

      expect(res).toBe('foo');
      expect(LookupStats.getReport()).toEqual({
        npm: {
          avgMs: 100,
          count: 1,
          maxMs: 100,
          medianMs: 100,
          totalMs: 100,
        },
      });
    });

    it('logs report', () => {
      LookupStats.write('npm', 100);
      LookupStats.write('npm', 200);
      LookupStats.write('npm', 400);
      LookupStats.write('docker', 1000);

      LookupStats.report();

      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
      const [data, msg] = logger.logger.debug.mock.calls[0];
      expect(msg).toBe('Lookup statistics');
      expect(data).toEqual({
        docker: {
          avgMs: 1000,
          count: 1,
          maxMs: 1000,
          medianMs: 1000,
          totalMs: 1000,
        },
        npm: {
          avgMs: 233,
          count: 3,
          maxMs: 400,
          medianMs: 200,
          totalMs: 700,
        },
      });
    });
  });
});
