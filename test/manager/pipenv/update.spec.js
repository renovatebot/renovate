const fs = require('fs');
const { updateDependency } = require('../../../lib/manager/pipenv/update');

const pipfile = fs.readFileSync('test/_fixtures/pipenv/Pipfile1', 'utf8');

describe('manager/pipenv/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        depName: 'some-package',
        newValue: '==1.0.1',
        depType: 'packages',
      };
      const res = updateDependency(pipfile, upgrade);
      expect(res).not.toEqual(pipfile);
      expect(res.includes(upgrade.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
    it('upgrades dev packages', () => {
      const upgrade = {
        depName: 'dev-package',
        newValue: '==0.2.0',
        depType: 'dev-packages',
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
