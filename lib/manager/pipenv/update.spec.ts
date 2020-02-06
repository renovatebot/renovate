import { readFileSync } from 'fs';
import { updateDependency } from './update';

const pipfile = readFileSync(
  'lib/manager/pipenv/__fixtures__/Pipfile1',
  'utf8'
);

describe('manager/pipenv/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        depName: 'some-package',
        newValue: '==1.0.1',
        depType: 'packages',
      };
      const res = updateDependency({ fileContent: pipfile, upgrade });
      expect(res).not.toEqual(pipfile);
      expect(res.includes(upgrade.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
    it('handles already replace values', () => {
      const upgrade = {
        depName: 'some-package',
        newValue: '==0.3.1',
        depType: 'packages',
      };
      const res = updateDependency({ fileContent: pipfile, upgrade });
      expect(res).toEqual(pipfile);
    });
    it('replaces nested value', () => {
      const upgrade = {
        depName: 'pytest-benchmark',
        newValue: '==1.9.1',
        depType: 'packages',
        managerData: { nestedVersion: true },
      };
      const res = updateDependency({ fileContent: pipfile, upgrade });
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
      const res = updateDependency({ fileContent: pipfile, upgrade });
      expect(res).not.toEqual(pipfile);
      expect(res.includes(upgrade.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
    it('returns null if error', () => {
      const res = updateDependency({ fileContent: null, upgrade: null });
      expect(res).toBeNull();
    });
  });
});
