const docker = require('../../lib/versioning/docker');
const semver = require('../../lib/versioning/semver');

describe('docker.', () => {
  describe('isValid(version)', () => {
    it('should support all versions length', () => {
      expect(docker.isValid(null)).toBe(null);
      expect(docker.isValid('1.2.3')).toBe('1.2.3');
      expect(docker.isValid('18.04')).toBe('18.04');
      expect(docker.isValid('10.1')).toBe('10.1');
      expect(docker.isValid('3')).toBe('3');
      expect(docker.isValid('foo')).toBe(null);
    });
  });
  describe('getMajor(version)', () => {
    it('should support all versions length', () => {
      expect(docker.getMajor('1.2.3')).toBe(1);
      expect(docker.getMajor('18.04')).toBe(18);
      expect(docker.getMajor('10.1')).toBe(10);
      expect(docker.getMajor('3')).toBe(3);
      expect(docker.getMajor('foo')).toBe(null);
    });
  });
  describe('getMinor(version)', () => {
    it('should support all versions length', () => {
      expect(docker.getMinor('1.2.3')).toBe(2);
      expect(docker.getMinor('18.04')).toBe(4);
      expect(docker.getMinor('10.1')).toBe(1);
      expect(docker.getMinor('3')).toBe(null);
      expect(docker.getMinor('foo')).toBe(null);
    });
  });
  describe('getPatch(version)', () => {
    it('should support all versions length', () => {
      expect(docker.getPatch('1.2.3')).toBe(3);
      expect(docker.getPatch('18.04')).toBe(null);
      expect(docker.getPatch('10.1')).toBe(null);
      expect(docker.getPatch('3')).toBe(null);
      expect(docker.getPatch('foo')).toBe(null);
    });
  });

  describe('isGreaterThan(version, other)', () => {
    it('should support all versions length', () => {
      expect(docker.isGreaterThan('1.2.3', '1.2')).toBe(false);
      expect(docker.isGreaterThan('18.04', '18.1')).toBe(true);
      expect(docker.isGreaterThan('10.1', '10.1.2')).toBe(true);
      expect(docker.isGreaterThan('3', '2')).toBe(true);
      expect(docker.isGreaterThan('1.2.3', '1.2.3')).toBe(false);
    });
  });
  describe('isLessThanRange(version, range)', () => {
    it('should support all versions length', () => {
      expect(docker.isLessThanRange('1.2.3', '2.0')).toBe(true);
      expect(docker.isLessThanRange('18.04', '18.1')).toBe(false);
      expect(docker.isLessThanRange('10.1', '10.0.4')).toBe(false);
      expect(docker.isLessThanRange('3', '4.0')).toBe(true);
      expect(docker.isLessThanRange('1.2', '1.3.4')).toBe(true);
    });
  });
  describe('equals(version, other)', () => {
    it('should support all versions length', () => {
      expect(docker.equals('1.2.3', '1.2.3')).toBe(true);
      expect(docker.equals('18.04', '18.4')).toBe(true);
      expect(docker.equals('10.0', '10.0.4')).toBe(false);
      expect(docker.equals('3', '4.0')).toBe(false);
      expect(docker.equals('1.2', '1.2.3')).toBe(false);
    });
  });
  describe('equals(version, other)', () => {
    it('should support all versions length', () => {
      expect(docker.equals('1.2.3', '1.2.3')).toBe(true);
      expect(docker.equals('18.04', '18.4')).toBe(true);
      expect(docker.equals('10.0', '10.0.4')).toBe(false);
      expect(docker.equals('3', '4.0')).toBe(false);
      expect(docker.equals('1.2', '1.2.3')).toBe(false);
    });
  });
  describe('maxSatisfyingVersion(versions, range)', () => {
    it('should support all versions length', () => {
      [docker.minSatisfyingVersion, docker.maxSatisfyingVersion].forEach(
        max => {
          const versions = [
            '0.9.8',
            '1.1.1',
            '1.1',
            '1.2.3',
            '1.2',
            '1',
            '2.2.2',
            '2.2',
            '2',
          ];
          // returns range if found
          expect(max(versions, '1.2.3')).toBe('1.2.3');
          expect(max(versions, '1.2')).toBe('1.2');
          expect(max(versions, '1')).toBe('1');
          // return null if not found
          expect(max(versions, '1.3')).toBe(null);
          expect(max(versions, '0.9')).toBe(null);
        }
      );
    });
  });
  describe('sortVersions(v1, v2)', () => {
    it('behaves like semver.sortVersions', () => {
      [
        ['1.1.1', '1.2.3'],
        ['1.2.3', '1.3.4'],
        ['2.0.1', '1.2.3'],
        ['1.2.3', '0.9.5'],
      ].forEach(pair => {
        expect(docker.sortVersions(...pair)).toBe(semver.sortVersions(...pair));
      });
    });
  });
  describe('getNewValue(', () => {
    it('returns toVersion', () => {
      expect(docker.getNewValue(null, null, null, '1.2.3')).toBe('1.2.3');
    });
  });
});
