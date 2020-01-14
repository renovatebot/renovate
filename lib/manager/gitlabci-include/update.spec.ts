import { readFileSync } from 'fs';
import { updateDependency } from './update';

const yamlFile = readFileSync(
  'lib/manager/gitlabci-include/__fixtures__/gitlab-ci.yaml',
  'utf8'
);

describe('manager/gitlabci-include/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const updateOptions = {
        depType: 'repository',
        depName: 'mikebryant/include-source-example',
        newValue: '1.0.1',
      };
      const res = updateDependency({ fileContent: yamlFile, updateOptions });
      expect(res).not.toEqual(yamlFile);
      expect(res.includes(updateOptions.newValue)).toBe(true);
    });
    it('returns same', () => {
      const updateOptions = {
        depType: 'repository',
        depName: 'mikebryant/include-source-example',
        newValue: '1.0.0',
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
