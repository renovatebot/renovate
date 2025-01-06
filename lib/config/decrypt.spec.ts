import { decryptConfig } from './decrypt';
import { GlobalConfig } from './global';
import type { RenovateConfig } from './types';

const repository = 'abc/def';

describe('config/decrypt', () => {
  describe('decryptConfig()', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      config = {};
      GlobalConfig.reset();
    });

    it('returns empty with no privateKey', async () => {
      delete config.encrypted;
      const res = await decryptConfig(config, repository);
      expect(res).toMatchObject(config);
    });

    it('throws exception if encrypted found but no privateKey', async () => {
      config.encrypted = { a: '1' };

      await expect(decryptConfig(config, repository)).rejects.toThrow(
        'config-validation',
      );
    });
  });
});
