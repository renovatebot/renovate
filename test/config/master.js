const configMaster = require('../../lib/config/master.js');

describe('config/master', () => {
  describe('.getEnvName(definition)', () => {
    it('returns existing env', () => {
      const option = {
        name: 'foo',
        env: 'FOO',
      };
      configMaster.getEnvName(option).should.eql('FOO');
    });
    it('generates RENOVATE_ env', () => {
      const option = {
        name: 'oneTwoThree',
      };
      configMaster.getEnvName(option).should.eql('RENOVATE_ONE_TWO_THREE');
    });
  });
});

console.log(configMaster.getDefaultConfig());
console.log(require('../../lib/config/default'));
