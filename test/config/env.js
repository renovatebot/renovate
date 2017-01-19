const env = require('../../lib/config/env.js');

describe('config/env', () => {
  describe('.getEnvName(definition)', () => {
    it('returns existing env', () => {
      const option = {
        name: 'foo',
        env: 'FOO',
      };
      env.getEnvName(option).should.eql('FOO');
    });
    it('generates RENOVATE_ env', () => {
      const option = {
        name: 'oneTwoThree',
      };
      env.getEnvName(option).should.eql('RENOVATE_ONE_TWO_THREE');
    });
  });
});
