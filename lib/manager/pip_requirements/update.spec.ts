import { readFileSync } from 'fs';
import { updateDependency } from './update';

const requirements = readFileSync(
  'lib/manager/pip_requirements/__fixtures__/requirements1.txt',
  'utf8'
);

const requirements3 = readFileSync(
  'lib/manager/pip_requirements/__fixtures__/requirements3.txt',
  'utf8'
);

const requirements4 = readFileSync(
  'lib/manager/pip_requirements/__fixtures__/requirements4.txt',
  'utf8'
);

const setupPy1 = readFileSync(
  'lib/manager/pip_setup/__fixtures__/setup.py',
  'utf-8'
);

const setupPy2 = readFileSync(
  'lib/manager/pip_setup/__fixtures__/setup-2.py',
  'utf-8'
);

describe('manager/pip_requirements/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const updateOptions = {
        depName: 'some-package',
        managerData: { lineNumber: 2 },
        newValue: '==1.0.1',
      };
      const res = updateDependency({
        fileContent: requirements,
        updateOptions,
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(requirements);
      expect(res.includes(updateOptions.newValue)).toBe(true);
    });
    it('returns null if error', () => {
      const res = updateDependency({ fileContent: null, updateOptions: null });
      expect(res).toBeNull();
    });
    it('replaces existing value with comment', () => {
      const updateOptions = {
        depName: 'psycopg2',
        managerData: { lineNumber: 3 },
        newValue: '==2.4.6',
      };
      const res = updateDependency({
        fileContent: requirements3,
        updateOptions,
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(requirements3);
      expect(res.includes(updateOptions.newValue)).toBe(true);
    });

    it('replaces existing value with extras', () => {
      const updateOptions = {
        depName: 'celery',
        managerData: { lineNumber: 1 },
        newValue: '==4.1.2',
      };
      const res = updateDependency({
        fileContent: requirements4,
        updateOptions,
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(requirements4);
      expect(res.includes(updateOptions.newValue)).toBe(true);
    });
    it('handles dependencies in different lines in setup.py', () => {
      const updateOptions = {
        depName: 'requests',
        managerData: { lineNumber: 64 },
        newValue: '>=2.11.0',
      };
      const res = updateDependency({ fileContent: setupPy1, updateOptions });
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(setupPy1);
      expect(res.includes(updateOptions.newValue)).toBe(true);
    });
    it('handles multiple dependencies in same lines in setup.py', () => {
      const updateOptions = {
        depName: 'pycryptodome',
        managerData: { lineNumber: 60 },
        newValue: '==3.8.0',
      };
      const res = updateDependency({ fileContent: setupPy2, updateOptions });
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(setupPy2);
      const expectedUpdate =
        "install_requires=['gunicorn>=19.7.0,<20.0', 'Werkzeug>=0.15.3,<0.16', 'pycryptodome==3.8.0','statsd>=3.2.1,<4.0', 'requests>=2.10.0,<3.0', 'raven>=5.27.1,<7.0','future>=0.15.2,<0.17',],";
      expect(res).toContain(expectedUpdate);
      expect(res.includes(updateOptions.newValue)).toBe(true);
    });
  });
});
