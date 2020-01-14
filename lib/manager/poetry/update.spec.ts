import { readFileSync } from 'fs';
import { updateDependency } from './update';

const pyproject1toml = readFileSync(
  'lib/manager/poetry/__fixtures__/pyproject.1.toml',
  'utf8'
);

const pyproject2toml = readFileSync(
  'lib/manager/poetry/__fixtures__/pyproject.2.toml',
  'utf8'
);

describe('manager/poetry/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const updateOptions = {
        depName: 'dep1',
        depType: 'dependencies',
        newValue: '1.0.0',
        managerData: { nestedVersion: false },
      };
      const res = updateDependency({
        fileContent: pyproject1toml,
        updateOptions,
      });
      expect(res).not.toEqual(pyproject1toml);
      expect(res.includes(updateOptions.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
    it('handles already replace values', () => {
      const updateOptions = {
        depName: 'dep1',
        depType: 'dependencies',
        newValue: '0.0.0',
        managerData: { nestedVersion: false },
      };
      const res = updateDependency({
        fileContent: pyproject1toml,
        updateOptions,
      });
      expect(res).toEqual(pyproject1toml);
    });
    it('replaces nested value', () => {
      const updateOptions = {
        depName: 'dep1',
        depType: 'dependencies',
        newValue: '1.0.0',
        managerData: { nestedVersion: true },
      };
      const res = updateDependency({
        fileContent: pyproject2toml,
        updateOptions,
      });
      expect(res).not.toEqual(pyproject2toml);
      expect(res.includes(updateOptions.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
    it('replaces nested value for path dependency', () => {
      const updateOptions = {
        depName: 'dep3',
        depType: 'dependencies',
        newValue: '1.0.0',
        managerData: { nestedVersion: true },
      };
      const res = updateDependency({
        fileContent: pyproject2toml,
        updateOptions,
      });
      expect(res).not.toEqual(pyproject2toml);
      expect(res.includes(updateOptions.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
    it('gracefully handles nested value for path dependency without version field', () => {
      const updateOptions = {
        depName: 'dep4',
        depType: 'dependencies',
        newValue: '1.0.0',
        managerData: { nestedVersion: true },
      };
      const res = updateDependency({
        fileContent: pyproject1toml,
        updateOptions,
      });
      expect(res).toBeNull();
    });
    it('upgrades extras', () => {
      const updateOptions = {
        depName: 'extra_dep1',
        depType: 'extras',
        newValue: '1.0.0',
        managerData: { nestedVersion: false },
      };
      const res = updateDependency({
        fileContent: pyproject1toml,
        updateOptions,
      });
      expect(res).not.toEqual(pyproject1toml);
      expect(res.includes(updateOptions.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
    it('upgrades dev-dependencies', () => {
      const updateOptions = {
        depName: 'dev_dep1',
        depType: 'dev-dependencies',
        newValue: '1.0.0',
        managerData: { nestedVersion: false },
      };
      const res = updateDependency({
        fileContent: pyproject1toml,
        updateOptions,
      });
      expect(res).not.toEqual(pyproject1toml);
      expect(res.includes(updateOptions.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
    it('returns null if upgrade is null', () => {
      const res = updateDependency({ fileContent: null, updateOptions: null });
      expect(res).toBeNull();
    });
    it('handles nonexistent depType gracefully', () => {
      const updateOptions = {
        depName: 'dev1',
        depType: '!invalid-dev-type!',
        newValue: '1.0.0',
        managerData: { nestedVersion: false },
      };
      const res = updateDependency({
        fileContent: pyproject1toml,
        updateOptions,
      });
      expect(res).toBeNull();
    });
    it('handles nonexistent depType gracefully', () => {
      const updateOptions = {
        depName: 'dev_dev1',
        depType: 'dev-dependencies',
        newValue: '1.0.0',
        managerData: { nestedVersion: false },
      };
      const res = updateDependency({
        fileContent: pyproject2toml,
        updateOptions,
      });
      expect(res).toBeNull();
    });
    it('handles nonexistent depName gracefully', () => {
      const updateOptions = {
        depName: '~invalid-dep-name~',
        depType: 'dependencies',
        newValue: '1.0.0',
        managerData: { nestedVersion: false },
      };
      const res = updateDependency({
        fileContent: pyproject1toml,
        updateOptions,
      });
      expect(res).toBeNull();
    });
    it('handles nonexistent depName with nested value gracefully', () => {
      const updateOptions = {
        depName: '~invalid-dep-name~',
        depType: 'dependencies',
        managerData: { nestedVersion: true },
        newValue: '1.0.0',
      };
      const res = updateDependency({
        fileContent: pyproject2toml,
        updateOptions,
      });
      expect(res).toBeNull();
    });
  });
});
