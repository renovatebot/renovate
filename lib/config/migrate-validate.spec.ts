import { getConfig } from './defaults';
import { migrateAndValidate } from './migrate-validate';
import * as configMigration from './migration';
import { type RenovateConfig, logger } from '~test/util';

let config: RenovateConfig;

beforeEach(() => {
  config = getConfig();
});

describe('config/migrate-validate', () => {
  describe('migrateAndValidate()', () => {
    it('handles empty', async () => {
      const res = await migrateAndValidate(config, {});
      expect(res).toEqual({
        errors: [],
        warnings: [],
      });
    });

    it('handles migration', async () => {
      const input: RenovateConfig = { automerge: 'none' as any };
      const res = await migrateAndValidate(config, input);
      expect(res).toEqual({
        automerge: false,
        errors: [],
        warnings: [],
      });
    });

    it('handles invalid', async () => {
      const input: RenovateConfig = { foo: 'none' };
      const res = await migrateAndValidate(config, input);
      expect(res).toMatchSnapshot();
      expect(res.errors).toHaveLength(1);
    });

    it('isOnboarded', async () => {
      const input: RenovateConfig = {};
      const res = await migrateAndValidate(
        { ...config, repoIsOnboarded: true },
        input,
      );
      expect(res.warnings).toBeUndefined();
      expect(res).toMatchSnapshot();
    });

    it('logs errors', async () => {
      vi.spyOn(configMigration, 'migrateConfig').mockImplementation(() => {
        throw new Error('test error');
      });
      await expect(
        migrateAndValidate(config, { invalid: 'config' } as any),
      ).rejects.toThrow('test error');
      expect(logger.logger.debug).toHaveBeenCalledTimes(2);
      expect(logger.logger.debug).toHaveBeenNthCalledWith(
        1,
        'migrateAndValidate()',
      );
      expect(logger.logger.debug).toHaveBeenNthCalledWith(
        2,
        { config: { invalid: 'config' } },
        'migrateAndValidate error',
      );
    });
  });
});
