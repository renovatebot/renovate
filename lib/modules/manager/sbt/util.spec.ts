import { normalizeScalaVersion, sortPackageFiles } from './util';

describe('modules/manager/sbt/util', () => {
  describe('sortPackageFiles()', () => {
    it('places build.sbt first', () => {
      const packageFiles = [
        'project/build.properties',
        'project/Dependencies.scala',
        'build.sbt',
      ];
      expect(sortPackageFiles(packageFiles)).toEqual([
        'build.sbt',
        'project/build.properties',
        'project/Dependencies.scala',
      ]);
    });
  });

  describe('normalizeScalaVersion()', () => {
    it('does not normalize prior to 2.10', () => {
      const version = '2.9.3';
      expect(normalizeScalaVersion(version)).toBe('2.9.3');
    });

    it('normalizes a Scala 2.10 version number', () => {
      const version = '2.10.7';
      expect(normalizeScalaVersion(version)).toBe('2.10');
    });

    it('normalizes a Scala 2.11 version number', () => {
      const version = '2.11.12';
      expect(normalizeScalaVersion(version)).toBe('2.11');
    });

    it('normalizes a Scala 2.12 version number', () => {
      const version = '2.12.19';
      expect(normalizeScalaVersion(version)).toBe('2.12');
    });

    it('normalizes a Scala 2.13 version number', () => {
      const version = '2.13.14';
      expect(normalizeScalaVersion(version)).toBe('2.13');
    });

    it('normalizes a Scala 3 LTS version number', () => {
      const version = '3.3.3';
      expect(normalizeScalaVersion(version)).toBe('3');
    });

    it('normalizes a Scala 3 current version number', () => {
      const version = '3.4.2';
      expect(normalizeScalaVersion(version)).toBe('3');
    });
  });
});
