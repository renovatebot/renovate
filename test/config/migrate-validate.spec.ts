import { migrateAndValidate } from '../../lib/config/migrate-validate';
import { getConfig, RenovateConfig } from '../util';

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
});

describe('config/migrate-validate', () => {
  describe('migrateAndValidate()', () => {
    it('handles empty', async () => {
      const res = await migrateAndValidate(config, {});
      expect(res).toMatchSnapshot();
    });
    it('handles migration', async () => {
      const input: RenovateConfig = { automerge: 'none' as any };
      const res = await migrateAndValidate(config, input);
      expect(res).toMatchSnapshot();
    });
    it('handles invalid', async () => {
      const input: RenovateConfig = { foo: 'none' };
      const res = await migrateAndValidate(config, input);
      expect(res).toMatchSnapshot();
      expect(res.errors).toHaveLength(1);
    });
  });
});
