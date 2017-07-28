const configValidation = require('../../lib/config/validation.js');

describe('config/validation', () => {
  describe('validateConfig(config)', () => {
    it('returns nested errors', () => {
      const config = {
        foo: 1,
        depTypes: {
          bar: 2,
        },
      };
      const errors = configValidation.validateConfig(config);
      expect(errors).toHaveLength(2);
      expect(errors).toMatchSnapshot();
    });
  });
});
