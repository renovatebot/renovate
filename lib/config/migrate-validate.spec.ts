import { RenovateConfig, getConfig, getName } from '../../test/util';
import { migrateAndValidate } from './migrate-validate';

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
});

describe(getName(__filename), () => {
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

    it('isOnboarded', async () => {
      const input: RenovateConfig = {};
      const res = await migrateAndValidate(
        { ...config, repoIsOnboarded: true, warnings: undefined },
        input
      );
      expect(res.warnings).toBeUndefined();
      expect(res).toMatchSnapshot();
    });
  });
});
