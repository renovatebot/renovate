import { readFileSync } from 'fs';
import { updateDependency } from './update';

const yamlFile = readFileSync(
  'lib/manager/docker-compose/__fixtures__/docker-compose.1.yml',
  'utf8'
);

describe('manager/docker-compose/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        managerData: { lineNumber: 18 },
        depName: 'postgres',
        newValue: '9.6.8',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = updateDependency({ fileContent: yamlFile, upgrade });
      expect(res).not.toEqual(yamlFile);
      expect(res.includes(upgrade.newDigest)).toBe(true);
    });
    it('returns same', () => {
      const upgrade = {
        managerData: { lineNumber: 4 },
        depName: 'quay.io/something/redis',
        newValue: 'alpine',
      };
      const res = updateDependency({ fileContent: yamlFile, upgrade });
      expect(res).toEqual(yamlFile);
    });
    it('returns null if mismatch', () => {
      const upgrade = {
        managerData: { lineNumber: 17 },
        newFrom: 'postgres:9.6.8@sha256:abcdefghijklmnop',
      };
      const res = updateDependency({ fileContent: yamlFile, upgrade });
      expect(res).toBeNull();
    });
    it('returns null if error', () => {
      const res = updateDependency({ fileContent: null, upgrade: null });
      expect(res).toBeNull();
    });
  });
});
