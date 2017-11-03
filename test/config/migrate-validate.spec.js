const { migrateAndValidate } = require('../../lib/config/migrate-validate');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = { ...require('../_fixtures/config') };
});

describe('config/migrate-validate', () => {
  describe('migrateAndValidate()', () => {
    it('handles empty', () => {
      const res = migrateAndValidate(config, {});
      expect(res).toMatchSnapshot();
    });
    it('handles migration', () => {
      const input = { automerge: 'none' };
      const res = migrateAndValidate(config, input);
      expect(res).toMatchSnapshot();
    });
    it('handles invalid', () => {
      const input = { foo: 'none' };
      const res = migrateAndValidate(config, input);
      expect(res).toMatchSnapshot();
      expect(res.errors).toHaveLength(1);
    });
  });
});
