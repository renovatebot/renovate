const fs = require('fs');
const { updateDependency } = require('../../../lib/manager/poetry/update');

const pyproject1toml = fs.readFileSync(
  'test/manager/poetry/_fixtures/pyproject.1.toml',
  'utf8'
);

const pyproject2toml = fs.readFileSync(
  'test/manager/poetry/_fixtures/pyproject.2.toml',
  'utf8'
);

describe('manager/poetry/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        depName: 'dep1',
        depType: 'dependencies',
        newValue: '1.0.0',
        managerData: { nestedVersion: false },
      };
      const res = updateDependency(pyproject1toml, upgrade);
      expect(res).not.toEqual(pyproject1toml);
      expect(res.includes(upgrade.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
    it('handles already replace values', () => {
      const upgrade = {
        depName: 'dep1',
        depType: 'dependencies',
        newValue: '0.0.0',
        managerData: { nestedVersion: false },
      };
      const res = updateDependency(pyproject1toml, upgrade);
      expect(res).toEqual(pyproject1toml);
    });
    it('replaces nested value', () => {
      const upgrade = {
        depName: 'dep1',
        depType: 'dependencies',
        newValue: '1.0.0',
        managerData: { nestedVersion: true },
      };
      const res = updateDependency(pyproject2toml, upgrade);
      expect(res).not.toEqual(pyproject2toml);
      expect(res.includes(upgrade.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
    it('replaces nested value for path dependency', () => {
      const upgrade = {
        depName: 'dep3',
        depType: 'dependencies',
        newValue: '1.0.0',
        managerData: { nestedVersion: true },
      };
      const res = updateDependency(pyproject2toml, upgrade);
      expect(res).not.toEqual(pyproject2toml);
      expect(res.includes(upgrade.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
    it('gracefully handles nested value for path dependency withou version field', () => {
      const upgrade = {
        depName: 'dep4',
        depType: 'dependencies',
        newValue: '1.0.0',
        managerData: { nestedVersion: true },
      };
      const res = updateDependency(pyproject2toml, upgrade);
      expect(res).toBeNull();
    });
    it('upgrades extras', () => {
      const upgrade = {
        depName: 'extra_dep1',
        depType: 'extras',
        newValue: '1.0.0',
        managerData: { nestedVersion: false },
      };
      const res = updateDependency(pyproject1toml, upgrade);
      expect(res).not.toEqual(pyproject1toml);
      expect(res.includes(upgrade.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
    it('upgrades dev-dependencies', () => {
      const upgrade = {
        depName: 'dev_dep1',
        depType: 'dev-dependencies',
        newValue: '1.0.0',
        managerData: { nestedVersion: false },
      };
      const res = updateDependency(pyproject1toml, upgrade);
      expect(res).not.toEqual(pyproject1toml);
      expect(res.includes(upgrade.newValue)).toBe(true);
      expect(res).toMatchSnapshot();
    });
    it('returns null if upgrade is null', () => {
      const res = updateDependency(null, null);
      expect(res).toBeNull();
    });
    it('handles nonexistent depType gracefully', () => {
      const upgrade = {
        depName: 'dev1',
        depType: '!invalid-dev-type!',
        newValue: '1.0.0',
        managerData: { nestedVersion: false },
      };
      const res = updateDependency(pyproject1toml, upgrade);
      expect(res).toBeNull();
    });
    it('handles nonexistent depType gracefully', () => {
      const upgrade = {
        depName: 'dev_dev1',
        depType: 'dev-dependencies',
        newValue: '1.0.0',
        managerData: { nestedVersion: false },
      };
      const res = updateDependency(pyproject2toml, upgrade);
      expect(res).toBeNull();
    });
    it('handles nonexistent depName gracefully', () => {
      const upgrade = {
        depName: '~invalid-dep-name~',
        depType: 'dependencies',
        newValue: '1.0.0',
        managerData: { nestedVersion: false },
      };
      const res = updateDependency(pyproject1toml, upgrade);
      expect(res).toBeNull();
    });
    it('handles nonexistent depName with nested value gracefully', () => {
      const upgrade = {
        depName: '~invalid-dep-name~',
        depType: 'dependencies',
        managerData: { nestedVersion: true },
        newValue: '1.0.0',
      };
      const res = updateDependency(pyproject2toml, upgrade);
      expect(res).toBeNull();
    });
  });
});
