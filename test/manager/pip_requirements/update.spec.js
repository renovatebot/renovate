const fs = require('fs');
const {
  updateDependency,
} = require('../../../lib/manager/pip_requirements/update');

const requirements = fs.readFileSync(
  'test/_fixtures/pip_requirements/requirements1.txt',
  'utf8'
);

describe('manager/pip_requirements/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        depName: 'url',
        lineNumber: 2,
        newValue: '1.0.1',
      };
      const res = updateDependency(requirements, upgrade);
      expect(res).not.toEqual(requirements);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('returns null if error', () => {
      const res = updateDependency(null, null);
      expect(res).toBe(null);
    });
  });
});
