const fs = require('fs');
const {
  updateDependency,
} = require('../../../lib/manager/pip_requirements/update');

const requirements = fs.readFileSync(
  'test/manager/pip_requirements/_fixtures/requirements1.txt',
  'utf8'
);

const requirements3 = fs.readFileSync(
  'test/manager/pip_requirements/_fixtures/requirements3.txt',
  'utf8'
);

const requirements4 = fs.readFileSync(
  'test/manager/pip_requirements/_fixtures/requirements4.txt',
  'utf8'
);

const setupPy1 = fs.readFileSync(
  'test/manager/pip_setup/_fixtures/setup.py',
  'utf-8'
);

const setupPy2 = fs.readFileSync(
  'test/manager/pip_setup/_fixtures/setup-2.py',
  'utf-8'
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
      expect(res).toBeNull();
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
    it('handles dependencies in different lines in setup.py', () => {
      const upgrade = {
        depName: 'requests',
        lineNumber: 64,
        newValue: '>=2.11.0',
      };
      const res = updateDependency(setupPy1, upgrade);
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(setupPy1);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('handles multiple dependencies in same lines in setup.py', () => {
      const upgrade = {
        depName: 'pycryptodome',
        lineNumber: 60,
        newValue: '==3.8.0',
      };
      const res = updateDependency(setupPy2, upgrade);
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(setupPy2);
      const expectedUpdate =
        "install_requires=['gunicorn>=19.7.0,<20.0', 'Werkzeug>=0.11.5,<0.15', 'pycryptodome==3.8.0','statsd>=3.2.1,<4.0', 'requests>=2.10.0,<3.0', 'raven>=5.27.1,<7.0','future>=0.15.2,<0.17',],";
      expect(res).toContain(expectedUpdate);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
  });
});
