const fs = require('fs');
const dcUpdate = require('../../../lib/manager/gitlabci/update');

const yamlFile = fs.readFileSync(
  'test/_fixtures/gitlabci/gitlab-ci.yaml',
  'utf8'
);

describe('manager/gitlabci/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        lineNumber: 36,
        depType: 'image',
        depName: 'hadolint/hadolint',
        newValue: '7.0.0',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = dcUpdate.updateDependency(yamlFile, upgrade);
      expect(res).not.toEqual(yamlFile);
      expect(res.includes(upgrade.newDigest)).toBe(true);
    });
    it('returns same', () => {
      const upgrade = {
        depType: 'image',
        lineNumber: 36,
        depName: 'hadolint/hadolint',
        newValue: 'latest',
      };
      const res = dcUpdate.updateDependency(yamlFile, upgrade);
      expect(res).toEqual(yamlFile);
    });
    it('returns null if mismatch', () => {
      const upgrade = {
        lineNumber: 17,
        depType: 'image',
        depName: 'postgres',
        newValue: '9.6.8',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = dcUpdate.updateDependency(yamlFile, upgrade);
      expect(res).toBe(null);
    });
    it('replaces service-image update', () => {
      const upgrade = {
        lineNumber: 55,
        depType: 'service-image',
        depName: 'hadolint/hadolint',
        newValue: '7.0.0',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = dcUpdate.updateDependency(yamlFile, upgrade);
      expect(res).not.toEqual(yamlFile);
      expect(res.includes(upgrade.newDigest)).toBe(true);
    });
    it('returns null if service-image mismatch', () => {
      const upgrade = {
        lineNumber: 17,
        depType: 'service-image',
        depName: 'postgres',
        newValue: '9.6.8',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = dcUpdate.updateDependency(yamlFile, upgrade);
      expect(res).toBe(null);
    });
    it('returns service-image same', () => {
      const upgrade = {
        depType: 'serviceimage',
        lineNumber: 55,
        depName: 'docker',
        newValue: 'dind',
      };
      const res = dcUpdate.updateDependency(yamlFile, upgrade);
      expect(res).toEqual(yamlFile);
    });
    it('returns null if error', () => {
      const res = dcUpdate.updateDependency(null, null);
      expect(res).toBe(null);
    });
  });
});
