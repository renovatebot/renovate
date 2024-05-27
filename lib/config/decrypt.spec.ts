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
  });
});
