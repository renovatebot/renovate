import semver from '../semver';
import docker from '.';

describe('docker.', () => {
  describe('isValid(version)', () => {
    it('should support all versions length', () => {
      expect(docker.isValid(null)).toBeNull();
      expect(docker.isValid('1.2.3')).toBe('1.2.3');
      expect(docker.isValid('18.04')).toBe('18.04');
      expect(docker.isValid('10.1')).toBe('10.1');
      expect(docker.isValid('3')).toBe('3');
      expect(docker.isValid('foo')).toBeNull();
    });
    it('should return null if the version string looks like a git commit hash', () => {
      [
        '0a1b2c3',
        '0a1b2c3d',
        '0a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d',
      ].forEach((version) => {
        expect(docker.isValid(version)).toBeNull();
      });
      [
        '0a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0',
        '0a1b2C3',
        '0z1b2c3',
        '0A1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d',
        '123098140293',
      ].forEach((version) => {
        expect(docker.isValid(version)).toBe(version);
      });
    });
  });
  describe('getMajor(version)', () => {
    it('should support all versions length', () => {
      expect(docker.getMajor('1.2.3')).toBe(1);
      expect(docker.getMajor('18.04')).toBe(18);
      expect(docker.getMajor('10.1')).toBe(10);
      expect(docker.getMajor('3')).toBe(3);
      expect(docker.getMajor('foo')).toBeNull();
    });
  });
  describe('getMinor(version)', () => {
    it('should support all versions length', () => {
      expect(docker.getMinor('1.2.3')).toBe(2);
      expect(docker.getMinor('18.04')).toBe(4);
      expect(docker.getMinor('10.1')).toBe(1);
      expect(docker.getMinor('3')).toBeNull();
      expect(docker.getMinor('foo')).toBeNull();
    });
  });
  describe('getPatch(version)', () => {
    it('should support all versions length', () => {
      expect(docker.getPatch('1.2.3')).toBe(3);
      expect(docker.getPatch('18.04')).toBeNull();
      expect(docker.getPatch('10.1')).toBeNull();
      expect(docker.getPatch('3')).toBeNull();
      expect(docker.getPatch('foo')).toBeNull();
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
  describe('getSatisfyingVersion(versions, range)', () => {
    it('should support all versions length', () => {
      [docker.minSatisfyingVersion, docker.getSatisfyingVersion].forEach(
        (max) => {
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
          expect(max(versions, '1.3')).toBeNull();
          expect(max(versions, '0.9')).toBeNull();
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
      ].forEach((pair) => {
        expect(docker.sortVersions(pair[0], pair[1])).toBe(
          semver.sortVersions(pair[0], pair[1])
        );
      });
    });

    it('sorts unstable', () => {
      const versions = [
        '3.7.0',
        '3.7-alpine',
        '3.7.0b1',
        '3.7.0b5',
        '3.8.0b1-alpine',
        '3.8.0-alpine',
        '3.8.2',
        '3.8.0',
      ];

      expect(versions.sort(docker.sortVersions)).toEqual([
        '3.7.0b1',
        '3.7.0b5',
        '3.7.0',
        '3.7-alpine',
        '3.8.0b1-alpine',
        '3.8.0-alpine',
        '3.8.0',
        '3.8.2',
      ]);
    });
  });
  describe('getNewValue(', () => {
    it('returns newVersion', () => {
      expect(
        docker.getNewValue({
          currentValue: null,
          rangeStrategy: null,
          currentVersion: null,
          newVersion: '1.2.3',
        })
      ).toBe('1.2.3');
    });
  });

  it('isStable(version)', () => {
    const versions = [
      '3.7.0',
      '3.7.0b1',
      '3.7-alpine',
      '3.8.0-alpine',
      '3.8.0b1-alpine',
      '3.8.2',
    ];

    expect(versions.filter(docker.isStable)).toEqual([
      '3.7.0',
      '3.7-alpine',
      '3.8.0-alpine',
      '3.8.2',
    ]);
  });

  it('isCompatible(version)', () => {
    const versions = [
      '3.7.0',
      '3.7.0b1',
      '3.7-alpine',
      '3.8.0-alpine',
      '3.8.0b1-alpine',
      '3.8.2',
    ];

    expect(versions.filter((v) => docker.isCompatible(v, '3.7.0'))).toEqual([
      '3.7.0',
      '3.7.0b1',
      '3.8.2',
    ]);

    expect(
      versions.filter((v) => docker.isCompatible(v, '3.7.0-alpine'))
    ).toEqual(['3.8.0-alpine', '3.8.0b1-alpine']);
  });

  it('valueToVersion(version)', () => {
    const versions = [
      '3.7.0',
      '3.7.0b1',
      '3.7-alpine',
      '3.8.0-alpine',
      '3.8.0b1-alpine',
      '3.8.2',
      undefined,
    ];

    expect(versions.map(docker.valueToVersion)).toEqual([
      '3.7.0',
      '3.7.0b1',
      '3.7',
      '3.8.0',
      '3.8.0b1',
      '3.8.2',
      undefined,
    ]);
  });
});
