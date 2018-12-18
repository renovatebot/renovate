const fs = require('fs');
const dcUpdate = require('../../../lib/manager/ansible/update');

const yamlFile1 = fs.readFileSync('test/_fixtures/ansible/main1.yaml', 'utf8');
const yamlFile2 = fs.readFileSync('test/_fixtures/ansible/main2.yaml', 'utf8');

describe('manager/ansible/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value from docker_container', () => {
      const upgrade = {
        lineNumber: 4,
        depName: 'busybox',
        newValue: '1.29.3',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = dcUpdate.updateDependency(yamlFile1, upgrade);
      expect(res).not.toEqual(yamlFile1);
      expect(res.includes(upgrade.newDigest)).toBe(true);
    });
    it('replaces existing value from docker_service', () => {
      const upgrade = {
        lineNumber: 8,
        depName: 'sameersbn/gitlab',
        newValue: '11.5.1',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = dcUpdate.updateDependency(yamlFile2, upgrade);
      expect(res).not.toEqual(yamlFile2);
      expect(res.includes(upgrade.newDigest)).toBe(true);
    });
    it('returns same', () => {
      const upgrade = {
        lineNumber: 38,
        depName: 'sameersbn/redis',
        newValue: '4.0.9-1',
      };
      const res = dcUpdate.updateDependency(yamlFile2, upgrade);
      expect(res).toEqual(yamlFile2);
    });
    it('returns null if mismatch', () => {
      const upgrade = {
        lineNumber: 52,
        newFrom: 'registry:2.6.2@sha256:abcdefghijklmnop',
      };
      const res = dcUpdate.updateDependency(yamlFile2, upgrade);
      expect(res).toBe(null);
    });
    it('returns null if error', () => {
      const res = dcUpdate.updateDependency(null, null);
      expect(res).toBe(null);
    });
  });
});
