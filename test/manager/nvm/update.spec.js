const nodefile = require('../../../lib/manager/nvm/update');

describe('manager/nvm/update', () => {
  describe('setNewValue', () => {
    it('updates values', () => {
      const upgrade = {
        newVersion: '8.9.1',
      };
      const res = nodefile.setNewValue('8.9.0\n', upgrade);
      expect(res).toMatchSnapshot();
    });
  });
});
