import { XmlDocument } from 'xmldoc';
import { bumpPackageVersion } from './update';
import { findVersion } from './util';

describe('modules/manager/nuget/util', () => {
  describe('findVersion', () => {
    it('finds the version in a later property group', () => {
      const content =
        '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net6.0</TargetFramework></PropertyGroup><PropertyGroup><Version>0.0.1</Version></PropertyGroup></Project>';
      const { bumpedContent } = bumpPackageVersion(content, '0.0.1', 'patch');

      const project = new XmlDocument(bumpedContent!);
      const versionNode = findVersion(project);
      const newVersion = versionNode!.val;
      expect(newVersion).toBe('0.0.2');
    });

    it('picks version over versionprefix', () => {
      const content =
        '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><VersionPrefix>0.0.5</VersionPrefix></PropertyGroup><PropertyGroup><Version>0.0.1</Version></PropertyGroup></Project>';
      const { bumpedContent } = bumpPackageVersion(content, '0.0.1', 'patch');

      const project = new XmlDocument(bumpedContent!);
      const versionNode = findVersion(project);
      const newVersion = versionNode!.val;
      expect(newVersion).toBe('0.0.2');
    });
  });
});
