import { LOGGER_NOT_INITIALIZED } from '../constants/error-messages.ts';
import { RenovateLogger } from './renovate-logger.ts';
import type { PinoLogger } from './types.ts';

describe('logger/renovate-logger', () => {
  it('throws', () => {
    const logger = new RenovateLogger('test', {});

    expect(() => logger.childLogger()).toThrow(LOGGER_NOT_INITIALIZED);
  });

  it('should queue logs until initialized', () => {
    const fakeLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
    };
    const logger = new RenovateLogger('test', {});
    logger.info('test');
    expect(fakeLogger.info).toHaveBeenCalledTimes(0);
    logger.pinoLogger = fakeLogger as unknown as PinoLogger;
    expect(fakeLogger.info).toHaveBeenCalledTimes(1);
  });

  describe('before pino is initialized', () => {
    it('should log to console', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      const logger = new RenovateLogger('test', {});
      logger.info('hello before init');
      expect(consoleSpy).toHaveBeenCalledWith(
        `⚠️ NOTE ⚠️: Renovate's logger has not yet been initialized. If you see no other output, this is a bug`,
      );
    });

    it('should not log more than once', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      const logger = new RenovateLogger('test', {});
      logger.info('hello before init');
      logger.info('hello before init');
      logger.info('hello before init');
      expect(consoleSpy).toHaveBeenCalledExactlyOnceWith(
        `⚠️ NOTE ⚠️: Renovate's logger has not yet been initialized. If you see no other output, this is a bug`,
      );
    });
  });
});
