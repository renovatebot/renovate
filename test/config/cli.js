const configMaster = require('../../lib/config/cli.js');

describe('config/cli', () => {
  describe('.getCliName(definition)', () => {
    it('generates CLI value', () => {
      const option = {
        name: 'oneTwoThree',
      };
      configMaster.getCliName(option).should.eql('--one-two-three');
    });
  });
});
