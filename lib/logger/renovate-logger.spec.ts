import { LOGGER_NOT_INITIALIZED } from '../constants/error-messages.ts';
import { RenovateLogger } from './renovate-logger.ts';
import type { BunyanLogger } from './types.ts';

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
    logger.bunyan = fakeLogger as unknown as BunyanLogger;
    expect(fakeLogger.info).toHaveBeenCalledTimes(1);
  });
});
