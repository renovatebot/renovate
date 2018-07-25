const fs = require('fs');
const dcUpdate = require('../../../lib/manager/circleci/update');

const yamlFile = fs.readFileSync('test/_fixtures/circleci/config.yml', 'utf8');

describe('manager/circleci/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        lineNumber: 65,
        depName: 'node',
        newValue: '8.10.0',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = dcUpdate.updateDependency(yamlFile, upgrade);
      expect(res).not.toEqual(yamlFile);
      expect(res.includes(upgrade.newDigest)).toBe(true);
    });
    it('returns same', () => {
      const upgrade = {
        lineNumber: 12,
        depName: 'node',
      };
      const res = dcUpdate.updateDependency(yamlFile, upgrade);
      expect(res).toEqual(yamlFile);
    });
    it('returns null if mismatch', () => {
      const upgrade = {
        lineNumber: 17,
        depName: 'postgres',
        newValue: '9.6.8',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = dcUpdate.updateDependency(yamlFile, upgrade);
      expect(res).toBe(null);
    });
    it('returns null if error', () => {
      const res = dcUpdate.updateDependency(null, null);
      expect(res).toBe(null);
    });
  });
});
