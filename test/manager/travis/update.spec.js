const fs = require('fs');
const path = require('path');
const nodefile = require('../../../lib/manager/travis/update');

const content = fs.readFileSync(
  path.resolve('test/manager/travis/_fixtures/travis.yml'),
  'utf8'
);

describe('manager/travis/update', () => {
  describe('updateDependency', () => {
    it('updates values', () => {
      const upgrade = {
        currentValue: ['8', '6', '4'],
        newValue: [6, 8],
      };
      const res = nodefile.updateDependency(content, upgrade);
      expect(res).toMatchSnapshot();
    });
    it('falls back to 2 spaces', () => {
      const upgrade = {
        currentValue: [8, 6, 4],
        newValue: [6, 8],
      };
      const res = nodefile.updateDependency('hello: world', upgrade);
      expect(res).toMatchSnapshot();
    });
    it('it uses double quotes', () => {
      const upgrade = {
        currentValue: ['6'],
        newValue: [6, 8],
      };
      const res = nodefile.updateDependency('node_js:\n  - "6"\n', upgrade);
      expect(res).toMatchSnapshot();
    });
    it('returns null if error', () => {
      const upgrade = {
        currentValue: [8, 6, 4],
        newValue: '6',
      };
      const res = nodefile.updateDependency(content, upgrade);
      expect(res).toBeNull();
    });
  });
});
