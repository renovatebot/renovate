import { logger } from '../logger';
import { isSkipComment } from './ignore';

vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
  },
}));

describe('util/ignore', () => {
  it('returns true for "renovate:ignore" comments', () => {
    expect(isSkipComment('renovate:ignore')).toBe(true);
  });

  it('returns false for comments not starting with "renovate:" or "pyup:"', () => {
    expect(isSkipComment('other:ignore')).toBe(false);
  });

  it('returns false for "renovate:" comments without "ignore"', () => {
    expect(isSkipComment('renovate:update')).toBe(false);
  });

  it('logs unknown command for "renovate:" comments without "ignore"', () => {
    isSkipComment('renovate:update');
    expect(logger.debug).toHaveBeenCalledWith(
      'Unknown comment command: update',
    );
  });

  it('returns false when comment is undefined', () => {
    expect(isSkipComment()).toBe(false);
  });
});
