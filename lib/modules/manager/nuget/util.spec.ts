import { codeBlock } from 'common-tags';
import { XmlDocument } from 'xmldoc';
import type { Registry } from './types';
import { bumpPackageVersion } from './update';
import {
  applyRegistries,
  findGlobalJson,
  findVersion,
  getConfiguredRegistries,
} from './util';
import { fs } from '~test/util';

vi.mock('../../../util/fs');

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
      fs.findUpLocal.mockResolvedValue('NuGet.config');
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
      expect(registries).toEqual([
        {
          name: 'nuget.org',
          url: 'https://api.nuget.org/v3/index.json',
          sourceMappedPackagePatterns: ['*'],
        },
        {
          name: 'contoso.com',
          url: 'https://contoso.com/packages/',
          sourceMappedPackagePatterns: ['Contoso.*', 'NuGet.Common'],
        },
      ]);
    });

    it('deduplicates registries', async () => {
      fs.findUpLocal.mockResolvedValue('NuGet.config');
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`
          <?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" />
  </packageSources>
</configuration>`,
      );

      const registries = await getConfiguredRegistries('NuGet.config');
      expect(registries).toEqual([
        {
          name: 'nuget.org',
          url: 'https://api.nuget.org/v3/index.json#protocolVersion=3',
        },
      ]);
    });

    it('reads nuget config file with default registry', async () => {
      fs.findUpLocal.mockResolvedValue('NuGet.config');
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
      expect(registries).toEqual([
        {
          name: 'nuget.org',
          url: 'https://api.nuget.org/v3/index.json',
          sourceMappedPackagePatterns: ['*'],
        },
        {
          name: 'contoso.com',
          url: 'https://contoso.com/packages/',
          sourceMappedPackagePatterns: ['Contoso.*', 'NuGet.Common'],
        },
      ]);
    });

    it('reads nuget config file with default registry disabled and added sources', async () => {
      fs.findUpLocal.mockResolvedValue('NuGet.config');
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`
          <configuration>
            <packageSources>
              <add key="contoso.com" value="https://contoso.com/packages/"/>
            </packageSources>
            <disabledPackageSources>
              <add key="nuget.org" value="true" />
            </disabledPackageSources>
          </configuration>`,
      );

      const registries = await getConfiguredRegistries('NuGet.config');
      expect(registries).toEqual([
        {
          name: 'contoso.com',
          url: 'https://contoso.com/packages/',
        },
      ]);
    });

    it('reads nuget config file with default registry disabled given default registry added', async () => {
      fs.findUpLocal.mockResolvedValue('NuGet.config');
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`
          <configuration>
            <packageSources>
              <add key="nuget.org" value="https://api.nuget.org/v3/index.json"/>
              <add key="contoso.com" value="https://contoso.com/packages/"/>
            </packageSources>
            <disabledPackageSources>
              <add key="nuget.org" value="true" />
            </disabledPackageSources>
          </configuration>`,
      );

      const registries = await getConfiguredRegistries('NuGet.config');
      expect(registries).toEqual([
        {
          name: 'contoso.com',
          url: 'https://contoso.com/packages/',
        },
      ]);
    });

    it('reads nuget config file with unknown disabled source', async () => {
      fs.findUpLocal.mockResolvedValue('NuGet.config');
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`
          <configuration>
            <packageSources>
              <add key="contoso.com" value="https://contoso.com/packages/"/>
            </packageSources>
            <disabledPackageSources>
              <add key="unknown" value="true" />
            </disabledPackageSources>
          </configuration>`,
      );

      const registries = await getConfiguredRegistries('NuGet.config');
      expect(registries).toEqual([
        {
          name: 'nuget.org',
          url: 'https://api.nuget.org/v3/index.json',
        },
        {
          name: 'contoso.com',
          url: 'https://contoso.com/packages/',
        },
      ]);
    });

    it('reads nuget config file with disabled source with value false', async () => {
      fs.findUpLocal.mockResolvedValue('NuGet.config');
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`
          <configuration>
            <packageSources>
              <clear />
              <add key="nuget.org" value="https://api.nuget.org/v3/index.json"/>
              <add key="contoso.com" value="https://contoso.com/packages/"/>
            </packageSources>
            <disabledPackageSources>
              <add key="contoso.com" value="false" />
            </disabledPackageSources>
          </configuration>`,
      );

      const registries = await getConfiguredRegistries('NuGet.config');
      expect(registries).toEqual([
        {
          name: 'nuget.org',
          url: 'https://api.nuget.org/v3/index.json',
        },
        {
          name: 'contoso.com',
          url: 'https://contoso.com/packages/',
        },
      ]);
    });

    it('reads nuget config file without packageSources and ignores disabledPackageSources', async () => {
      fs.findUpLocal.mockResolvedValue('NuGet.config');
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`
          <configuration>
            <disabledPackageSources>
              <add key="contoso.com" value="true" />
            </disabledPackageSources>
          </configuration>`,
      );

      const registries = await getConfiguredRegistries('NuGet.config');
      expect(registries).toBeUndefined();
    });
  });

  describe('applyRegistries', () => {
    it('applies registry to package name via source mapping', () => {
      const registries: Registry[] = [
        {
          name: 'nuget.org',
          url: 'https://api.nuget.org/v3/index.json',
          sourceMappedPackagePatterns: ['*'],
        },
        {
          name: 'contoso.com',
          url: 'https://contoso.com/packages/',
          sourceMappedPackagePatterns: [
            'Contoso.*',
            'NuGet.Common',
            'AdventureWorks*',
          ],
        },
        {
          name: 'contoso.test',
          url: 'https://contoso.test/packages/',
          sourceMappedPackagePatterns: [
            'Contoso.*',
            'Contoso.Test.*',
            'NuGet.*',
            'NuGet.Common*',
            'AdventureWorks.Test.*',
          ],
        },
      ];

      expect(
        applyRegistries({ depName: 'Newtonsoft.Json' }, registries),
      ).toEqual({
        depName: 'Newtonsoft.Json',
        registryUrls: ['https://api.nuget.org/v3/index.json'],
      });

      expect(
        applyRegistries({ depName: 'Contoso.SomePackage' }, registries),
      ).toEqual({
        depName: 'Contoso.SomePackage',
        registryUrls: [
          'https://contoso.com/packages/',
          'https://contoso.test/packages/',
        ],
      });

      expect(applyRegistries({ depName: 'NuGet.Some' }, registries)).toEqual({
        depName: 'NuGet.Some',
        registryUrls: ['https://contoso.test/packages/'],
      });

      expect(
        applyRegistries({ depName: 'Contoso.Test.SomePackage' }, registries),
      ).toEqual({
        depName: 'Contoso.Test.SomePackage',
        registryUrls: ['https://contoso.test/packages/'],
      });

      expect(
        applyRegistries(
          { depName: 'AdventureWorks.Test.SomePackage' },
          registries,
        ),
      ).toEqual({
        depName: 'AdventureWorks.Test.SomePackage',
        registryUrls: ['https://contoso.test/packages/'],
      });
    });

    it('applies registry to package name case insensitive', () => {
      const registries: Registry[] = [
        {
          name: 'nuget.org',
          url: 'https://api.nuget.org/v3/index.json',
          sourceMappedPackagePatterns: ['*'],
        },
        {
          name: 'contoso.com',
          url: 'https://contoso.com/packages/',
          sourceMappedPackagePatterns: ['Contoso.*', 'Nuget.common'],
        },
      ];

      expect(applyRegistries({ depName: 'NuGet.Common' }, registries)).toEqual({
        depName: 'NuGet.Common',
        registryUrls: ['https://contoso.com/packages/'],
      });
    });

    it('applies all registries to package name', () => {
      const registries: Registry[] = [
        {
          name: 'nuget.org',
          url: 'https://api.nuget.org/v3/index.json',
        },
        {
          name: 'contoso.com',
          url: 'https://contoso.com/packages/',
        },
      ];

      expect(
        applyRegistries(
          {
            depName: 'Newtonsoft.Json',
          },
          registries,
        ),
      ).toEqual({
        depName: 'Newtonsoft.Json',
        registryUrls: [
          'https://api.nuget.org/v3/index.json',
          'https://contoso.com/packages/',
        ],
      });
    });

    it('applies nothing', () => {
      expect(
        applyRegistries(
          {
            depName: 'Newtonsoft.Json',
          },
          undefined,
        ),
      ).toEqual({
        depName: 'Newtonsoft.Json',
      });
    });
  });

  describe('findGlobalJson', () => {
    it('not found', async () => {
      fs.findLocalSiblingOrParent.mockResolvedValueOnce(null);
      const globalJson = await findGlobalJson('project.csproj');
      expect(globalJson).toBeNull();
    });

    it('no content', async () => {
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('global.json');
      const globalJson = await findGlobalJson('project.csproj');
      expect(globalJson).toBeNull();
    });

    it('fails to parse', async () => {
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('global.json');
      fs.readLocalFile.mockResolvedValueOnce('{');
      const globalJson = await findGlobalJson('project.csproj');
      expect(globalJson).toBeNull();
    });

    it('parses', async () => {
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('global.json');
      fs.readLocalFile.mockResolvedValueOnce(
        '{   /* This is comment */ "sdk": { "version": "5.0.100" }, "some": true }',
      );
      const globalJson = await findGlobalJson('project.csproj');
      expect(globalJson).toEqual({ sdk: { version: '5.0.100' } });
    });
  });
});
