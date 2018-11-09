const fs = require('fs');
const {
  updateDependency,
} = require('../../../lib/manager/pip_requirements/update');

const requirements = fs.readFileSync(
  'test/_fixtures/pip_requirements/requirements1.txt',
  'utf8'
);

const requirements3 = fs.readFileSync(
  'test/_fixtures/pip_requirements/requirements3.txt',
  'utf8'
);

const requirements4 = fs.readFileSync(
  'test/_fixtures/pip_requirements/requirements4.txt',
  'utf8'
);

describe('manager/pip_requirements/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        depName: 'some-package',
        lineNumber: 2,
        newValue: '==1.0.1',
      };
      const res = updateDependency(requirements, upgrade);
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(requirements);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('returns null if error', () => {
      const res = updateDependency(null, null);
      expect(res).toBe(null);
    });
    it('replaces existing value with comment', () => {
      const upgrade = {
        depName: 'psycopg2',
        lineNumber: 3,
        newValue: '==2.4.6',
      };
      const res = updateDependency(requirements3, upgrade);
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(requirements3);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });

    it('replaces existing value with extras', () => {
      const upgrade = {
        depName: 'celery',
        lineNumber: 1,
        newValue: '==4.1.2',
      };
      const res = updateDependency(requirements4, upgrade);
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(requirements4);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
  });
});
