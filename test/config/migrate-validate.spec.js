const { migrateAndValidate } = require('../../lib/config/migrate-validate');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = { ...require('./config/_fixtures') };
});

describe('config/migrate-validate', () => {
  describe('migrateAndValidate()', () => {
    it('handles empty', async () => {
      const res = await migrateAndValidate(config, {});
      expect(res).toMatchSnapshot();
    });
    it('handles migration', async () => {
      /** @type any */
      const input = { automerge: 'none' };
      const res = await migrateAndValidate(config, input);
      expect(res).toMatchSnapshot();
    });
    it('handles invalid', async () => {
      const input = { foo: 'none' };
      const res = await migrateAndValidate(config, input);
      expect(res).toMatchSnapshot();
      expect(res.errors).toHaveLength(1);
    });
  });
});
