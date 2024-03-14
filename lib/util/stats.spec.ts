import { logger } from '../../test/util';
import * as memCache from './cache/memory';
import { LookupStats, PackageCacheStats, makeTimingReport } from './stats';

describe('util/stats', () => {
  beforeEach(() => {
    memCache.init();
  });

  describe('makeTimingReport', () => {
    it('supports empty data', () => {
      const res = makeTimingReport([]);
      expect(res).toEqual({
        avgMs: 0,
        count: 0,
        maxMs: 0,
        medianMs: 0,
        totalMs: 0,
      });
    });

    it('supports single data point', () => {
      const res = makeTimingReport([100]);
      expect(res).toEqual({
        avgMs: 100,
        count: 1,
        maxMs: 100,
        medianMs: 100,
        totalMs: 100,
      });
    });

    it('supports multiple data points', () => {
      const res = makeTimingReport([100, 200, 400]);
      expect(res).toEqual({
        avgMs: 233,
        count: 3,
        maxMs: 400,
        medianMs: 200,
        totalMs: 700,
      });
    });
  });

  describe('LookupStats', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns empty report', () => {
      const res = LookupStats.getReport();
      expect(res).toEqual({});
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

  describe('PackageCacheStats', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('returns empty report', () => {
      const res = PackageCacheStats.getReport();
      expect(res).toEqual({
        get: { avgMs: 0, count: 0, maxMs: 0, medianMs: 0, totalMs: 0 },
        set: { avgMs: 0, count: 0, maxMs: 0, medianMs: 0, totalMs: 0 },
      });
    });

    it('writes data points', () => {
      PackageCacheStats.writeGet(100);
      PackageCacheStats.writeGet(200);
      PackageCacheStats.writeGet(400);
      PackageCacheStats.writeSet(1000);

      const res = PackageCacheStats.getReport();

      expect(res).toEqual({
        get: {
          avgMs: 233,
          count: 3,
          maxMs: 400,
          medianMs: 200,
          totalMs: 700,
        },
        set: {
          avgMs: 1000,
          count: 1,
          maxMs: 1000,
          medianMs: 1000,
          totalMs: 1000,
        },
      });
    });

    it('wraps get function', async () => {
      const res = await PackageCacheStats.wrapGet(() => {
        jest.advanceTimersByTime(100);
        return Promise.resolve('foo');
      });

      expect(res).toBe('foo');
      expect(PackageCacheStats.getReport()).toEqual({
        get: { avgMs: 100, count: 1, maxMs: 100, medianMs: 100, totalMs: 100 },
        set: { avgMs: 0, count: 0, maxMs: 0, medianMs: 0, totalMs: 0 },
      });
    });

    it('wraps set function', async () => {
      await PackageCacheStats.wrapSet(() => {
        jest.advanceTimersByTime(100);
        return Promise.resolve();
      });

      expect(PackageCacheStats.getReport()).toEqual({
        get: { avgMs: 0, count: 0, maxMs: 0, medianMs: 0, totalMs: 0 },
        set: { avgMs: 100, count: 1, maxMs: 100, medianMs: 100, totalMs: 100 },
      });
    });

    it('logs report', () => {
      PackageCacheStats.writeGet(100);
      PackageCacheStats.writeGet(200);
      PackageCacheStats.writeGet(400);
      PackageCacheStats.writeSet(1000);

      PackageCacheStats.report();

      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
      const [data, msg] = logger.logger.debug.mock.calls[0];
      expect(msg).toBe('Package cache statistics');
      expect(data).toEqual({
        get: {
          avgMs: 233,
          count: 3,
          maxMs: 400,
          medianMs: 200,
          totalMs: 700,
        },
        set: {
          avgMs: 1000,
          count: 1,
          maxMs: 1000,
          medianMs: 1000,
          totalMs: 1000,
        },
      });
    });
  });
});
