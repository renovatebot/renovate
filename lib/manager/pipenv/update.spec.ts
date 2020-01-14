import { readFileSync } from 'fs';
import { updateDependency } from './update';

const pipfile = readFileSync(
  'lib/manager/pipenv/__fixtures__/Pipfile1',
  'utf8'
);

describe('manager/pipenv/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const updateOptions = {
        depName: 'some-package',
        newValue: '==1.0.1',
        depType: 'packages',
      };
      const res = updateDependency({ fileContent: pipfile, updateOptions });
      expect(res).not.toEqual(pipfile);
      expect(res.includes(updateOptions.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
    it('handles already replace values', () => {
      const updateOptions = {
        depName: 'some-package',
        newValue: '==0.3.1',
        depType: 'packages',
      };
      const res = updateDependency({ fileContent: pipfile, updateOptions });
      expect(res).toEqual(pipfile);
    });
    it('replaces nested value', () => {
      const updateOptions = {
        depName: 'pytest-benchmark',
        newValue: '==1.9.1',
        depType: 'packages',
        managerData: { nestedVersion: true },
      };
      const res = updateDependency({ fileContent: pipfile, updateOptions });
      expect(res).not.toEqual(pipfile);
      expect(res.includes(updateOptions.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
    it('upgrades dev packages', () => {
      const updateOptions = {
        depName: 'dev-package',
        newValue: '==0.2.0',
        depType: 'dev-packages',
      };
      const res = updateDependency({ fileContent: pipfile, updateOptions });
      expect(res).not.toEqual(pipfile);
      expect(res.includes(updateOptions.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
    it('returns null if error', () => {
      const res = updateDependency({ fileContent: null, updateOptions: null });
      expect(res).toBeNull();
    });
  });
});
