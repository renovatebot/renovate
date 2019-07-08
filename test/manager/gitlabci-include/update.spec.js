const fs = require('fs');
const dcUpdate = require('../../../lib/manager/gitlabci-include/update');

const yamlFile = fs.readFileSync(
  'test/manager/gitlabci-include/_fixtures/gitlab-ci.yaml',
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
      const res = dcUpdate.updateDependency(yamlFile, upgrade);
      expect(res).not.toEqual(yamlFile);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('returns same', () => {
      const upgrade = {
        depType: 'repository',
        depName: 'mikebryant/include-source-example',
        newValue: '1.0.0',
      };
      const res = dcUpdate.updateDependency(yamlFile, upgrade);
      expect(res).toEqual(yamlFile);
    });
    it('returns null if error', () => {
      const res = dcUpdate.updateDependency(null, null);
      expect(res).toBeNull();
    });
  });
});
