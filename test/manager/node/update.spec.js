const fs = require('fs');
const path = require('path');
const nodefile = require('../../../lib/manager/node/update');

const content = fs.readFileSync(
  path.resolve('test/_fixtures/node/travis.yml'),
  'utf8'
);

describe('manager/node/update', () => {
  describe('setNewValue', () => {
    it('updates values', () => {
      const upgrade = {
        newVersions: ['6', '8'],
      };
      const res = nodefile.setNewValue(content, upgrade);
      expect(res).toMatchSnapshot();
    });
    it('falls back to 2 spaces', () => {
      const upgrade = {
        newVersions: ['6', '8'],
      };
      const res = nodefile.setNewValue('hello: world', upgrade);
      expect(res).toMatchSnapshot();
    });
    it('returns null if error', () => {
      const upgrade = {
        newVersions: '6',
      };
      const res = nodefile.setNewValue(content, upgrade);
      expect(res).toBe(null);
    });
  });
});
