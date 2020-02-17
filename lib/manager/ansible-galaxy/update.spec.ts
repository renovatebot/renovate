import { readFileSync } from 'fs';
import updateDependency from './update';

const yamlFile1 = readFileSync(
  'lib/manager/ansible-galaxy/__fixtures__/requirements01.yml',
  'utf8'
);

describe('manager/ansible/update', () => {
  describe('updateDependency', () => {
    it('updating value', () => {
      const upgrade = {
        managerData: { lineNumber: 2 },
        depName: 'yatesr.timezone',
        newValue: '1.29.3',
      };
      const res = updateDependency({ fileContent: yamlFile1, upgrade });
      expect(res).not.toEqual(yamlFile1);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('replaces existing value from docker_service', () => {
      const upgrade = {
        managerData: { lineNumber: 11 },
        depName: 'willthames/git-ansible-galaxy',
        newValue: 'v2.0',
      };
      const res = updateDependency({ fileContent: yamlFile1, upgrade });
      expect(res).not.toEqual(yamlFile1);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('returns same', () => {
      const upgrade = {
        managerData: { lineNumber: 16 },
        depName: 'mygroup/ansible-base',
        newValue: '0.1',
      };
      const res = updateDependency({ fileContent: yamlFile1, upgrade });
      expect(res).toEqual(yamlFile1);
    });
    it('returns null if mismatch', () => {
      const upgrade = {
        managerData: { lineNumber: 19 },
        depName: 'mygroup/ansible-base',
        newValue: '0.1',
      };
      const res = updateDependency({ fileContent: yamlFile1, upgrade });
      expect(res).toBeNull();
    });
    it('returns null if error', () => {
      const res = updateDependency({ fileContent: null, upgrade: null });
      expect(res).toBeNull();
    });
  });
});
