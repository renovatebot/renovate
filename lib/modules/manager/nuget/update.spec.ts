import { XmlDocument } from 'xmldoc';
import { bumpPackageVersion } from '.';

const simpleContent =
  '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><Version>0.0.1</Version></PropertyGroup></Project>';
const minimumContent =
  '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><Version>1</Version></PropertyGroup></Project>';
const prereleaseContent =
  '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><Version>1.0.0-1</Version></PropertyGroup></Project>';

describe('modules/manager/nuget/update', () => {
  describe('bumpPackageVersion', () => {
    it('bumps csproj version', () => {
      const { bumpedContent } = bumpPackageVersion(
        simpleContent,
        '0.0.1',
        'patch'
      );

      const project = new XmlDocument(bumpedContent!);
      expect(project.valueWithPath('PropertyGroup.Version')).toBe('0.0.2');
    });

    it('does not bump version twice', () => {
      const { bumpedContent } = bumpPackageVersion(
        simpleContent,
        '0.0.1',
        'patch'
      );
      const { bumpedContent: bumpedContent2 } = bumpPackageVersion(
        bumpedContent!,
        '0.0.1',
        'patch'
      );

      expect(bumpedContent).toEqual(bumpedContent2);
    });

    it('does not bump version if version is not a semantic version', () => {
      const { bumpedContent } = bumpPackageVersion(
        minimumContent,
        '1',
        'patch'
      );

      const project = new XmlDocument(bumpedContent!);
      expect(project.valueWithPath('PropertyGroup.Version')).toBe('1');
    });

    it('does not bump version if csproj has no version', () => {
      const { bumpedContent } = bumpPackageVersion(
        minimumContent,
        undefined,
        'patch'
      );

      expect(bumpedContent).toEqual(minimumContent);
    });

    it('returns content if bumping errors', () => {
      const { bumpedContent } = bumpPackageVersion(
        simpleContent,
        '0.0.1',
        true as any
      );
      expect(bumpedContent).toEqual(simpleContent);
    });

    it('bumps csproj version with prerelease semver level', () => {
      const { bumpedContent } = bumpPackageVersion(
        prereleaseContent,
        '1.0.0-1',
        'prerelease'
      );

      const project = new XmlDocument(bumpedContent!);
      expect(project.valueWithPath('PropertyGroup.Version')).toBe('1.0.0-2');
    });
  });
});
