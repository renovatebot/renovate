import { normalizeRedisUrl } from './redis';

describe('util/cache/package/redis', () => {
  describe('normalizeRedisUrl', () => {
    it('leaves standard Redis URL alone', () => {
      const url = 'redis://user:password@localhost:6379';
      expect(normalizeRedisUrl(url)).toBe(url);
    });

    it('leaves secure Redis URL alone', () => {
      const url = 'rediss://user:password@localhost:6379';
      expect(normalizeRedisUrl(url)).toBe(url);
    });

    it('rewrites standard Redis Cluster URL', () => {
      const url = 'redis+cluster://user:password@localhost:6379';
      expect(normalizeRedisUrl(url)).toBe(
        'redis://user:password@localhost:6379',
      );
    });

    it('rewrites secure Redis Cluster URL', () => {
      const url = 'rediss+cluster://user:password@localhost:6379';
      expect(normalizeRedisUrl(url)).toBe(
        'rediss://user:password@localhost:6379',
      );
    });
  });
});
