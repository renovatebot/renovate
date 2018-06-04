const fs = require('fs');
const path = require('path');
const nodefile = require('../../../lib/manager/travis/update');

const content = fs.readFileSync(
  path.resolve('test/_fixtures/node/travis.yml'),
  'utf8'
);

describe('manager/travis/update', () => {
  describe('updateDependency', () => {
    it('updates values', () => {
      const upgrade = {
        newValue: ['6', '8'],
      };
      const res = nodefile.updateDependency(content, upgrade);
      expect(res).toMatchSnapshot();
    });
    it('falls back to 2 spaces', () => {
      const upgrade = {
        newValue: ['6', '8'],
      };
      const res = nodefile.updateDependency('hello: world', upgrade);
      expect(res).toMatchSnapshot();
    });
    it('returns null if error', () => {
      const upgrade = {
        newValue: '6',
      };
      const res = nodefile.updateDependency(content, upgrade);
      expect(res).toBe(null);
    });
  });
});
