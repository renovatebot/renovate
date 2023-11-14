import { logger } from '../../logger';
import { clearDnsCache, dnsLookup, printDnsStats } from './dns';

describe('util/http/dns', () => {
  describe('dnsLookup', () => {
    it('works', async () => {
      clearDnsCache();
      const ip = await new Promise((resolve) =>
        dnsLookup('api.github.com', 4, (_e, r, _f) => {
          resolve(r);
        }),
      );
      expect(ip).toBeString();
      // uses cache
      expect(
        await new Promise((resolve) =>
          dnsLookup('api.github.com', (_e, r, _f) => {
            resolve(r);
          }),
        ),
      ).toBe(ip);
      expect(
        await new Promise((resolve) =>
          dnsLookup('api.github.com', {}, (_e, r, _f) => {
            resolve(r);
          }),
        ),
      ).toBe(ip);
    });

    it('throws', async () => {
      clearDnsCache();
      const ip = new Promise((resolve, reject) =>
        dnsLookup('api.github.comcccccccc', 4, (_e, r, _f) => {
          if (_e) {
            reject(_e);
          } else {
            resolve(r);
          }
        }),
      );
      await expect(ip).rejects.toThrow();
    });

    it('prints stats', () => {
      printDnsStats();
      expect(logger.debug).toHaveBeenCalled();
    });
  });
});
