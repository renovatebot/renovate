const fs = require('fs');
const { updateDependency } = require('../../../lib/manager/pipenv/update');

const pipfile = fs.readFileSync('test/_fixtures/pipenv/Pipfile1', 'utf8');

describe('manager/pipenv/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        depName: 'url',
        newValue: '1.0.1',
      };
      const res = updateDependency(pipfile, upgrade);
      expect(res).not.toEqual(pipfile);
      expect(res.includes(upgrade.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
    it('returns null if error', () => {
      const res = updateDependency(null, null);
      expect(res).toBe(null);
    });
  });
});
