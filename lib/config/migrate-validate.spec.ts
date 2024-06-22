import type { RenovateConfig } from '../../test/util';
import { getConfig } from './defaults';
import { migrateAndValidate } from './migrate-validate';

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
  });
});
