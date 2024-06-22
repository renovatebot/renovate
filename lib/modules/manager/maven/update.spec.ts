// TODO #22198
import { XmlDocument } from 'xmldoc';
import { Fixtures } from '../../../../test/fixtures';
import { bumpPackageVersion, updateDependency } from './update';

const simpleContent = Fixtures.get(`simple.pom.xml`);
const minimumContent = Fixtures.get(`minimum.pom.xml`);
const minimumSnapshotContent = Fixtures.get(`minimum_snapshot.pom.xml`);
const prereleaseContent = Fixtures.get(`prerelease.pom.xml`);

describe('modules/manager/maven/update', () => {
  describe('updateDependency', () => {
    it('should return null for replacement', () => {
      const res = updateDependency({
        fileContent: '',
        upgrade: { updateType: 'replacement' },
      });
      expect(res).toBeNull();
    });
  });

  describe('bumpPackageVersion', () => {
    it('bumps pom.xml version', () => {
      const { bumpedContent } = bumpPackageVersion(
        simpleContent,
        '0.0.1',
        'patch',
      );

      const project = new XmlDocument(bumpedContent!);
      expect(project.valueWithPath('version')).toBe('0.0.2');
    });

    it('bumps pom.xml version keeping SNAPSHOT', () => {
      const { bumpedContent } = bumpPackageVersion(
        minimumSnapshotContent,
        '0.0.1-SNAPSHOT',
        'patch',
      );

      const project = new XmlDocument(bumpedContent!);
      expect(project.valueWithPath('version')).toBe('0.0.2-SNAPSHOT');
    });

    it('bumps pom.xml minor version keeping SNAPSHOT', () => {
      const { bumpedContent } = bumpPackageVersion(
        minimumSnapshotContent,
        '0.0.1-SNAPSHOT',
        'minor',
      );

      const project = new XmlDocument(bumpedContent!);
      expect(project.valueWithPath('version')).toBe('0.1.0-SNAPSHOT');
    });

    it('bumps pom.xml major version keeping SNAPSHOT', () => {
      const { bumpedContent } = bumpPackageVersion(
        minimumSnapshotContent,
        '0.0.1-SNAPSHOT',
        'major',
      );

      const project = new XmlDocument(bumpedContent!);
      expect(project.valueWithPath('version')).toBe('1.0.0-SNAPSHOT');
    });

    it('bumps pom.xml version keeping qualifier with -SNAPSHOT', () => {
      const { bumpedContent } = bumpPackageVersion(
        minimumSnapshotContent.replace(
          '0.0.1-SNAPSHOT',
          '0.0.1-qualified-SNAPSHOT',
        ),
        '0.0.1-qualified-SNAPSHOT',
        'patch',
      );

      const project = new XmlDocument(bumpedContent!);
      expect(project.valueWithPath('version')).toBe('0.0.2-qualified-SNAPSHOT');
    });

    it('does not bump version twice', () => {
      const { bumpedContent } = bumpPackageVersion(
        simpleContent,
        '0.0.1',
        'patch',
      );
      const { bumpedContent: bumpedContent2 } = bumpPackageVersion(
        bumpedContent!,
        '0.0.1',
        'patch',
      );

      expect(bumpedContent).toEqual(bumpedContent2);
    });

    it('does not bump version if version is not a semantic version', () => {
      const { bumpedContent } = bumpPackageVersion(
        minimumContent,
        '1',
        'patch',
      );

      const project = new XmlDocument(bumpedContent!);
      expect(project.valueWithPath('version')).toBe('1');
    });

    it('does not bump version if pom.xml has no version', () => {
      const { bumpedContent } = bumpPackageVersion(minimumContent, '', 'patch');

      expect(bumpedContent).toEqual(minimumContent);
    });

    it('returns content if bumping errors', () => {
      const { bumpedContent } = bumpPackageVersion(
        simpleContent,
        '0.0.1',
        true as any,
      );
      expect(bumpedContent).toEqual(simpleContent);
    });

    it('bumps pom.xml version to SNAPSHOT with prerelease', () => {
      const { bumpedContent } = bumpPackageVersion(
        simpleContent,
        '0.0.1',
        'prerelease',
      );

      const project = new XmlDocument(bumpedContent!);
      expect(project.valueWithPath('version')).toBe('0.0.2-SNAPSHOT');
    });

    it('bumps pom.xml version with prerelease semver level', () => {
      const { bumpedContent } = bumpPackageVersion(
        prereleaseContent,
        '1.0.0-1',
        'prerelease',
      );

      const project = new XmlDocument(bumpedContent!);
      expect(project.valueWithPath('version')).toBe('1.0.0-2');
    });
  });
});
