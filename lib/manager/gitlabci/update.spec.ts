import { readFileSync } from 'fs';
import { updateDependency } from './update';

const yamlFile = readFileSync(
  'lib/manager/gitlabci/__fixtures__/gitlab-ci.yaml',
  'utf8'
);

describe('manager/gitlabci/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const updateOptions = {
        managerData: { lineNumber: 36 },
        depType: 'image',
        depName: 'hadolint/hadolint',
        newValue: '7.0.0',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = updateDependency({ fileContent: yamlFile, updateOptions });
      expect(res).not.toEqual(yamlFile);
      expect(res.includes(updateOptions.newDigest)).toBe(true);
    });
    it('returns same', () => {
      const updateOptions = {
        depType: 'image',
        managerData: { lineNumber: 36 },
        depName: 'hadolint/hadolint',
        newValue: 'latest',
      };
      const res = updateDependency({ fileContent: yamlFile, updateOptions });
      expect(res).toEqual(yamlFile);
    });
    it('returns null if mismatch', () => {
      const updateOptions = {
        managerData: { lineNumber: 17 },
        depType: 'image',
        depName: 'postgres',
        newValue: '9.6.8',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = updateDependency({ fileContent: yamlFile, updateOptions });
      expect(res).toBeNull();
    });
    it('replaces image-name value', () => {
      const updateOptions = {
        managerData: { lineNumber: 102 },
        depType: 'image-name',
        depName: 'image-name-test',
        newValue: '1.35',
      };
      const res = updateDependency({ fileContent: yamlFile, updateOptions });
      expect(res).not.toEqual(yamlFile);
    });
    it('returns same image-name value', () => {
      const updateOptions = {
        managerData: { lineNumber: 102 },
        depType: 'image-name',
        depName: 'image-name-test',
        newValue: '1.15',
      };
      const res = updateDependency({ fileContent: yamlFile, updateOptions });
      expect(res).toEqual(yamlFile);
    });
    it('replaces service-image update', () => {
      const updateOptions = {
        managerData: { lineNumber: 55 },
        depType: 'service-image',
        depName: 'hadolint/hadolint',
        newValue: '7.0.0',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = updateDependency({ fileContent: yamlFile, updateOptions });
      expect(res).not.toEqual(yamlFile);
      expect(res.includes(updateOptions.newDigest)).toBe(true);
    });
    it('returns null if service-image mismatch', () => {
      const updateOptions = {
        managerData: { lineNumber: 17 },
        depType: 'service-image',
        depName: 'postgres',
        newValue: '9.6.8',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = updateDependency({ fileContent: yamlFile, updateOptions });
      expect(res).toBeNull();
    });
    it('returns service-image same', () => {
      const updateOptions = {
        depType: 'serviceimage',
        managerData: { lineNumber: 55 },
        depName: 'docker',
        newValue: 'dind',
      };
      const res = updateDependency({ fileContent: yamlFile, updateOptions });
      expect(res).toEqual(yamlFile);
    });
    it('returns null if error', () => {
      const res = updateDependency({ fileContent: null, updateOptions: null });
      expect(res).toBeNull();
    });
  });
});
