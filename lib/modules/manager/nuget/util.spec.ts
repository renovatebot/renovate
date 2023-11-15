import { codeBlock } from 'common-tags';
import { XmlDocument } from 'xmldoc';
import { fs } from '../../../../test/util';
import { bumpPackageVersion } from './update';
import { findVersion, getConfiguredRegistries } from './util';

jest.mock('../../../util/fs');

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

  describe('getConfiguredRegistries', () => {
    it('reads nuget config file', async () => {
      fs.findUpLocal.mockReturnValue(
        Promise.resolve<string | null>('NuGet.config'),
      );
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`
          <configuration>
            <packageSources>
              <clear/>
              <add key="nuget.org" value="https://api.nuget.org/v3/index.json"/>
              <add key="contoso.com" value="https://contoso.com/packages/"/>
            </packageSources>
            <packageSourceMapping>
              <packageSource key="nuget.org">
                <package pattern="*"/>
              </packageSource>
              <packageSource key="contoso.com">
                <package pattern="Contoso.*"/>
                <package pattern="NuGet.Common"/>
              </packageSource>
            </packageSourceMapping>
          </configuration>`,
      );

      const registries = await getConfiguredRegistries('NuGet.config');
      expect(registries?.length).toBe(2);
      expect(registries![0].name).toBe('nuget.org');
      expect(registries![0].url).toBe('https://api.nuget.org/v3/index.json');
      expect(registries![0].sourceMappedPackagePatterns).toEqual(['*']);

      expect(registries![1].name).toBe('contoso.com');
      expect(registries![1].url).toBe('https://contoso.com/packages/');
      expect(registries![1].sourceMappedPackagePatterns).toEqual([
        'Contoso.*',
        'NuGet.Common',
      ]);
    });

    it('reads nuget config file with default registry', async () => {
      fs.findUpLocal.mockReturnValue(
        Promise.resolve<string | null>('NuGet.config'),
      );
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`
        <configuration>
          <packageSources>
            <add key="contoso.com" value="https://contoso.com/packages/"/>
          </packageSources>
          <packageSourceMapping>
            <packageSource key="nuget.org">
              <package pattern="*"/>
            </packageSource>
            <packageSource key="contoso.com">
              <package pattern="Contoso.*"/>
              <package pattern="NuGet.Common"/>
            </packageSource>
          </packageSourceMapping>
        </configuration>`,
      );

      const registries = await getConfiguredRegistries('NuGet.config');
      expect(registries?.length).toBe(2);
      expect(registries![0].name).toBe('nuget.org');
      expect(registries![0].url).toBe('https://api.nuget.org/v3/index.json');
      expect(registries![0].sourceMappedPackagePatterns).toEqual(['*']);

      expect(registries![1].name).toBe('contoso.com');
      expect(registries![1].url).toBe('https://contoso.com/packages/');
      expect(registries![1].sourceMappedPackagePatterns).toEqual([
        'Contoso.*',
        'NuGet.Common',
      ]);
    });
  });
});
