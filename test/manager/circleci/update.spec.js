const fs = require('fs');
const dcUpdate = require('../../../lib/manager/circleci/update');

const yamlFile = fs.readFileSync('test/_fixtures/circleci/config.yml', 'utf8');
const yamlFile2 = fs.readFileSync(
  'test/_fixtures/circleci/config2.yml',
  'utf8'
);

describe('manager/circleci/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        lineNumber: 65,
        depType: 'docker',
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
        depType: 'docker',
        depName: 'node',
      };
      const res = dcUpdate.updateDependency(yamlFile, upgrade);
      expect(res).toEqual(yamlFile);
    });
    it('returns null if mismatch', () => {
      const upgrade = {
        lineNumber: 17,
        depType: 'docker',
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
    it('replaces orbs', () => {
      const upgrade = {
        currentValue: '4.1.0',
        depName: 'release-workflows',
        depType: 'orb',
        lineNumber: 3,
        newValue: '4.2.0',
      };
      const res = dcUpdate.updateDependency(yamlFile2, upgrade);
      expect(res).not.toEqual(yamlFile2);
      expect(res.includes(upgrade.newValue)).toBe(true);
    });
    it('returns same orb', () => {
      const upgrade = {
        currentValue: '4.0.0',
        depName: 'release-workflows',
        depType: 'orb',
        lineNumber: 3,
        newValue: '4.1.0',
      };
      const res = dcUpdate.updateDependency(yamlFile2, upgrade);
      expect(res).toEqual(yamlFile2);
    });
    it('returns null for orb mismatch', () => {
      const upgrade = {
        currentValue: '4.1.0',
        depName: 'release-workflows',
        depType: 'orb',
        lineNumber: 2,
        newValue: '4.2.0',
      };
      const res = dcUpdate.updateDependency(yamlFile2, upgrade);
      expect(res).toBeNull();
    });
    it('returns null for unknown depType', () => {
      const upgrade = {
        currentValue: '4.1.0',
        depName: 'release-workflows',
        lineNumber: 3,
        newValue: '4.2.0',
      };
      const res = dcUpdate.updateDependency(yamlFile2, upgrade);
      expect(res).toBeNull();
    });
  });
});
