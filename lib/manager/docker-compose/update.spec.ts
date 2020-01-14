import { readFileSync } from 'fs';
import { updateDependency } from './update';

const yamlFile = readFileSync(
  'lib/manager/docker-compose/__fixtures__/docker-compose.1.yml',
  'utf8'
);

describe('manager/docker-compose/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const updateOptions = {
        managerData: { lineNumber: 18 },
        depName: 'postgres',
        newValue: '9.6.8',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = updateDependency({ fileContent: yamlFile, updateOptions });
      expect(res).not.toEqual(yamlFile);
      expect(res.includes(updateOptions.newDigest)).toBe(true);
    });
    it('returns same', () => {
      const updateOptions = {
        managerData: { lineNumber: 4 },
        depName: 'quay.io/something/redis',
        newValue: 'alpine',
      };
      const res = updateDependency({ fileContent: yamlFile, updateOptions });
      expect(res).toEqual(yamlFile);
    });
    it('returns null if mismatch', () => {
      const updateOptions = {
        managerData: { lineNumber: 17 },
        newFrom: 'postgres:9.6.8@sha256:abcdefghijklmnop',
      };
      const res = updateDependency({ fileContent: yamlFile, updateOptions });
      expect(res).toBeNull();
    });
    it('returns null if error', () => {
      const res = updateDependency({ fileContent: null, updateOptions: null });
      expect(res).toBeNull();
    });
  });
});
