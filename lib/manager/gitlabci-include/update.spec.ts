import { readFileSync } from 'fs';
import { updateDependency } from './update';

const yamlFile = readFileSync(
  'lib/manager/gitlabci-include/__fixtures__/gitlab-ci.yaml',
  'utf8'
);

describe('manager/gitlabci-include/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        depType: 'repository',
        depName: 'mikebryant/include-source-example',
        newValue: '1.0.1',
      };
      const res = updateDependency({ fileContent: yamlFile, upgrade });
      expect(res).not.toEqual(yamlFile);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('returns same', () => {
      const upgrade = {
        depType: 'repository',
        depName: 'mikebryant/include-source-example',
        newValue: '1.0.0',
      };
      const res = updateDependency({ fileContent: yamlFile, upgrade });
      expect(res).toEqual(yamlFile);
    });
    it('returns null if error', () => {
      const res = updateDependency({ fileContent: null, upgrade: null });
      expect(res).toBeNull();
    });
  });
});
