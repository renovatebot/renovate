import { logger } from '../../test/util';
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
      delete process.env.MEND_HOSTED;
      delete process.env.RENOVATE_X_ENCRYPTED_STRICT;
    });

    it('returns empty with no privateKey', async () => {
      delete config.encrypted;
      const res = await decryptConfig(config, repository);
      expect(res).toMatchObject(config);
    });

    it('warns if no privateKey found', async () => {
      config.encrypted = { a: '1' };
      GlobalConfig.set({ encryptedWarning: 'text' });

      const res = await decryptConfig(config, repository);

      expect(logger.logger.once.warn).toHaveBeenCalledWith('text');
      expect(res.encrypted).toBeUndefined();
      expect(res.a).toBeUndefined();
    });

    it('throws exception if encrypted found but no privateKey', async () => {
      config.encrypted = { a: '1' };

      process.env.RENOVATE_X_ENCRYPTED_STRICT = 'true';
      await expect(decryptConfig(config, repository)).rejects.toThrow(
        'config-validation',
      );
    });

    // coverage
    it('throws exception if encrypted found but no privateKey- Mend Hosted', async () => {
      config.encrypted = { a: '1' };

      process.env.MEND_HOSTED = 'true';
      process.env.RENOVATE_X_ENCRYPTED_STRICT = 'true';
      await expect(decryptConfig(config, repository)).rejects.toThrow(
        'config-validation',
      );
    });
  });
});
