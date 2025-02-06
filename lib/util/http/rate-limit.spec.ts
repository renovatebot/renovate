import * as hostRules from '../host-rules';
import {
  getConcurrentRequestsLimit,
  getThrottleIntervalMs,
  setHttpRateLimits,
} from './rate-limits';

describe('util/http/rate-limit', () => {
  beforeEach(() => {
    hostRules.clear();
    setHttpRateLimits([], []);
  });

  describe('getConcurrentRequestsLimit', () => {
    it('returns null if no limits are set', () => {
      expect(getConcurrentRequestsLimit('https://example.com')).toBeNull();
    });

    it('returns null if host does not match', () => {
      setHttpRateLimits(
        [{ matchHost: 'https://crates.io/api/', concurrency: 42 }],
        undefined,
      );
      expect(getConcurrentRequestsLimit('https://index.crates.io')).toBeNull();
    });

    it('gets the limit from the host rules', () => {
      hostRules.add({ matchHost: 'example.com', concurrentRequestLimit: 123 });
      expect(getConcurrentRequestsLimit('https://example.com')).toBe(123);
    });

    it('selects default value if host rule is greater', () => {
      setHttpRateLimits(
        [{ matchHost: 'example.com', concurrency: 123 }],
        undefined,
      );
      hostRules.add({ matchHost: 'example.com', concurrentRequestLimit: 456 });
      expect(getConcurrentRequestsLimit('https://example.com')).toBe(123);
    });

    it('selects host rule value if default is greater', () => {
      setHttpRateLimits(
        [{ matchHost: 'example.com', concurrency: 456 }],
        undefined,
      );
      hostRules.add({ matchHost: 'example.com', concurrentRequestLimit: 123 });
      expect(getConcurrentRequestsLimit('https://example.com')).toBe(123);
    });

    it('matches wildcard host', () => {
      setHttpRateLimits([{ matchHost: '*', concurrency: 123 }], undefined);
      expect(getConcurrentRequestsLimit('https://example.com')).toBe(123);
    });
  });

  describe('getThrottleIntervalMs', () => {
    it('returns null if no limits are set', () => {
      expect(getThrottleIntervalMs('https://example.com')).toBeNull();
    });

    it('returns null if host does not match', () => {
      setHttpRateLimits(
        [{ matchHost: 'https://crates.io/api/', concurrency: 123 }],
        undefined,
      );
      expect(getThrottleIntervalMs('https://index.crates.io')).toBeNull();
    });

    it('gets the limit from the host rules', () => {
      hostRules.add({ matchHost: 'example.com', maxRequestsPerSecond: 8 });
      expect(getThrottleIntervalMs('https://example.com')).toBe(125);
    });

    it('selects maximum throttle when default is greater', () => {
      setHttpRateLimits(undefined, [
        { matchHost: 'example.com', throttleMs: 500 },
      ]);
      hostRules.add({ matchHost: 'example.com', maxRequestsPerSecond: 8 });
      expect(getThrottleIntervalMs('https://example.com')).toBe(500);
    });

    it('selects maximum throttle when host rule is greater', () => {
      setHttpRateLimits(undefined, [
        { matchHost: 'example.com', throttleMs: 125 },
      ]);
      hostRules.add({ matchHost: 'example.com', maxRequestsPerSecond: 2 });
      expect(getThrottleIntervalMs('https://example.com')).toBe(500);
    });

    it('matches wildcard host', () => {
      setHttpRateLimits(undefined, [{ matchHost: '*', throttleMs: 123 }]);
      expect(getThrottleIntervalMs('https://example.com')).toBe(123);
    });
  });
});
