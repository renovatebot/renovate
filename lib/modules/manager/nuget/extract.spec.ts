import { codeBlock } from 'common-tags';
import upath from 'upath';
import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { DotnetVersionDatasource } from '../../datasource/dotnet-version';
import type { ExtractConfig } from '../types';
import { extractPackageFile } from '.';

const config: ExtractConfig = {};

const adminConfig: RepoGlobalConfig = {
  localDir: upath.resolve('lib/modules/manager/nuget/__fixtures__'),
};

describe('modules/manager/nuget/extract', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      GlobalConfig.set(adminConfig);
    });

    afterEach(() => {
      GlobalConfig.reset();
    });

    it('returns null for invalid csproj', async () => {
      expect(
        await extractPackageFile('nothing here', 'bogus', config),
      ).toBeNull();
    });

    it('extracts package version dependency', async () => {
      const packageFile =
        'with-centralized-package-versions/Directory.Packages.props';
      const sample = Fixtures.get(packageFile);
      const res = await extractPackageFile(sample, packageFile, config);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(1);
    });

    it('extracts package file version', async () => {
      const packageFile = 'sample.csproj';
      const sample = Fixtures.get(packageFile);
      const res = await extractPackageFile(sample, packageFile, config);
      expect(res?.packageFileVersion).toBe('0.1.0');
    });

    it('does not fail on package file without version', async () => {
      const packageFile = 'single-project-file/single.csproj';
      const sample = Fixtures.get(packageFile);
      const res = await extractPackageFile(sample, packageFile, config);
      expect(res?.packageFileVersion).toBeUndefined();
    });

    it('extracts all dependencies', async () => {
      const packageFile = 'sample.csproj';
      const sample = Fixtures.get(packageFile);
      const res = await extractPackageFile(sample, packageFile, config);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(17);
    });

    it('extracts dependency with lower-case Version attribute', async () => {
      const contents = codeBlock`
        <Project Sdk="Microsoft.NET.Sdk">
          <PropertyGroup>
            <TargetFramework>net8.0</TargetFramework>
          </PropertyGroup>
          <ItemGroup>
            <PackageReference Include="Moq" version="4.18.4" />
          </ItemGroup>
        </Project>`;
      const res = await extractPackageFile(contents, 'some.csproj', config);
      expect(res?.deps).toHaveLength(1);
    });

    it('extracts all dependencies from global packages file', async () => {
      const packageFile = 'packages.props';
      const sample = Fixtures.get(packageFile);
      const res = await extractPackageFile(sample, packageFile, config);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(17);
    });

    it('extracts ContainerBaseImage', async () => {
      const contents = codeBlock`
      <Project Sdk="Microsoft.NET.Sdk.Worker">
        <PropertyGroup>
          <Version>0.1.0</Version>
          <ContainerBaseImage>mcr.microsoft.com/dotnet/runtime:7.0.10</ContainerBaseImage>
        </PropertyGroup>
      </Project>`;

      expect(await extractPackageFile(contents, contents, config)).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            depName: 'mcr.microsoft.com/dotnet/runtime',
            depType: 'docker',
            datasource: 'docker',
            currentValue: '7.0.10',
            replaceString: 'mcr.microsoft.com/dotnet/runtime:7.0.10',
          },
        ],
        packageFileVersion: '0.1.0',
      });
    });

    it('extracts ContainerBaseImage with pinned digest', async () => {
      const contents = codeBlock`
      <Project Sdk="Microsoft.NET.Sdk.Worker">
        <PropertyGroup>
          <Version>0.1.0</Version>
          <ContainerBaseImage>mcr.microsoft.com/dotnet/runtime:7.0.10@sha256:181067029e094856691ee1ce3782ea3bd3fda01bb5b6d19411d0f673cab1ab19</ContainerBaseImage>
        </PropertyGroup>
      </Project>`;

      expect(await extractPackageFile(contents, contents, config)).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            depName: 'mcr.microsoft.com/dotnet/runtime',
            depType: 'docker',
            datasource: 'docker',
            currentValue: '7.0.10',
            currentDigest:
              'sha256:181067029e094856691ee1ce3782ea3bd3fda01bb5b6d19411d0f673cab1ab19',
            replaceString:
              'mcr.microsoft.com/dotnet/runtime:7.0.10@sha256:181067029e094856691ee1ce3782ea3bd3fda01bb5b6d19411d0f673cab1ab19',
          },
        ],
        packageFileVersion: '0.1.0',
      });
    });

    it('considers NuGet.config', async () => {
      const packageFile = 'with-config-file/with-config-file.csproj';
      const contents = Fixtures.get(packageFile);
      expect(await extractPackageFile(contents, packageFile, config)).toEqual({
        deps: [
          {
            currentValue: '4.5.0',
            datasource: 'nuget',
            depName: 'Autofac',
            depType: 'nuget',
            registryUrls: [
              'https://api.nuget.org/v3/index.json#protocolVersion=3',
              'https://contoso.com/packages/',
            ],
          },
        ],
        packageFileVersion: '0.1.0',
      });
    });

    it('considers lower-case nuget.config', async () => {
      const packageFile =
        'with-lower-case-config-file/with-lower-case-config-file.csproj';
      const contents = Fixtures.get(packageFile);
      expect(await extractPackageFile(contents, packageFile, config)).toEqual({
        deps: [
          {
            currentValue: '4.5.0',
            datasource: 'nuget',
            depName: 'Autofac',
            depType: 'nuget',
            registryUrls: [
              'https://api.nuget.org/v3/index.json#protocolVersion=3',
              'https://contoso.com/packages/',
            ],
          },
        ],
        packageFileVersion: '0.1.0',
      });
    });

    it('considers pascal-case NuGet.Config', async () => {
      const packageFile =
        'with-pascal-case-config-file/with-pascal-case-config-file.csproj';
      const contents = Fixtures.get(packageFile);
      expect(await extractPackageFile(contents, packageFile, config)).toEqual({
        deps: [
          {
            currentValue: '4.5.0',
            datasource: 'nuget',
            depName: 'Autofac',
            depType: 'nuget',
            registryUrls: [
              'https://api.nuget.org/v3/index.json#protocolVersion=3',
              'https://contoso.com/packages/',
            ],
          },
        ],
        packageFileVersion: '0.1.0',
      });
    });

    it('handles malformed NuGet.config', async () => {
      const packageFile =
        'with-malformed-config-file/with-malformed-config-file.csproj';
      const contents = Fixtures.get(packageFile);
      expect(await extractPackageFile(contents, packageFile, config)).toEqual({
        deps: [
          {
            currentValue: '4.5.0',
            datasource: 'nuget',
            depName: 'Autofac',
            depType: 'nuget',
          },
        ],
        packageFileVersion: '0.1.0',
      });
    });

    it('handles NuGet.config without package sources', async () => {
      const packageFile =
        'without-package-sources/without-package-sources.csproj';
      const contents = Fixtures.get(packageFile);
      expect(await extractPackageFile(contents, packageFile, config)).toEqual({
        deps: [
          {
            currentValue: '4.5.0',
            datasource: 'nuget',
            depName: 'Autofac',
            depType: 'nuget',
          },
        ],
        packageFileVersion: '0.1.0',
      });
    });

    it('handles NuGet.config with whitespaces in package source keys', async () => {
      const packageFile = 'with-whitespaces/with-whitespaces.csproj';
      const contents = Fixtures.get(packageFile);
      expect(await extractPackageFile(contents, packageFile, config)).toEqual({
        deps: [
          {
            currentValue: '12.0.3',
            datasource: 'nuget',
            depName: 'Newtonsoft.Json',
            depType: 'nuget',
            registryUrls: [
              'https://api.nuget.org/v3/index.json#protocolVersion=3',
              'https://my.myget.org/F/my/auth/guid/api/v3/index.json',
            ],
          },
        ],
      });
    });

    it('ignores local feed in NuGet.config', async () => {
      const packageFile =
        'with-local-feed-in-config-file/with-local-feed-in-config-file.csproj';
      const contents = Fixtures.get(packageFile);
      expect(await extractPackageFile(contents, packageFile, config)).toEqual({
        deps: [
          {
            currentValue: '4.5.0',
            datasource: 'nuget',
            depName: 'Autofac',
            depType: 'nuget',
            registryUrls: ['https://contoso.com/packages/'],
          },
        ],
        packageFileVersion: '0.1.0',
      });
    });

    it('extracts registry URLs independently', async () => {
      const packageFile = 'multiple-package-files/one/one.csproj';
      const contents = Fixtures.get(packageFile);
      const otherPackageFile = 'multiple-package-files/two/two.csproj';
      const otherContents = Fixtures.get(otherPackageFile);
      expect(await extractPackageFile(contents, packageFile, config)).toEqual({
        deps: [
          {
            currentValue: '4.5.0',
            datasource: 'nuget',
            depName: 'Autofac',
            depType: 'nuget',
            registryUrls: [
              'https://api.nuget.org/v3/index.json',
              'https://example.org/one',
            ],
          },
        ],
        packageFileVersion: '0.1.0',
      });
      expect(
        await extractPackageFile(otherContents, otherPackageFile, config),
      ).toEqual({
        deps: [
          {
            currentValue: '4.5.0',
            datasource: 'nuget',
            depName: 'Autofac',
            depType: 'nuget',
            registryUrls: [
              'https://api.nuget.org/v3/index.json',
              'https://example.org/two',
            ],
          },
        ],
        packageFileVersion: '0.2.0',
      });
    });

    it('extracts msbuild-sdks from global.json', async () => {
      const packageFile = 'msbuild-sdk-files/global.json';
      const contents = Fixtures.get(packageFile);
      expect(await extractPackageFile(contents, packageFile, config)).toEqual({
        deps: [
          {
            currentValue: '5.0.302',
            depName: 'dotnet-sdk',
            depType: 'dotnet-sdk',
            datasource: DotnetVersionDatasource.id,
          },
          {
            currentValue: '0.2.0',
            datasource: 'nuget',
            depName: 'YoloDev.Sdk',
            depType: 'msbuild-sdk',
          },
        ],
        extractedConstraints: { 'dotnet-sdk': '5.0.302' },
      });
    });

    it('extracts dotnet-sdk from global.json', async () => {
      const packageFile = 'msbuild-sdk-files/global.1.json';
      const contents = Fixtures.get(packageFile);
      expect(await extractPackageFile(contents, 'global.json', config)).toEqual(
        {
          deps: [
            {
              currentValue: '5.0.302',
              depName: 'dotnet-sdk',
              depType: 'dotnet-sdk',
              datasource: DotnetVersionDatasource.id,
            },
          ],
          extractedConstraints: { 'dotnet-sdk': '5.0.302' },
        },
      );
    });

    it('handles malformed global.json', async () => {
      const packageFile = 'msbuild-sdk-files/invalid-json/global.json';
      const contents = Fixtures.get(packageFile);
      expect(
        await extractPackageFile(contents, packageFile, config),
      ).toBeNull();
    });

    it('handles not-a-nuget global.json', async () => {
      const packageFile = 'msbuild-sdk-files/not-nuget/global.json';
      const contents = Fixtures.get(packageFile);
      expect(
        await extractPackageFile(contents, packageFile, config),
      ).toBeNull();
    });

    describe('.config/dotnet-tools.json', () => {
      const packageFile = '.config/dotnet-tools.json';
      const contents = Fixtures.get('dotnet-tools.json');

      it('works', async () => {
        expect(await extractPackageFile(contents, packageFile, config)).toEqual(
          {
            deps: [
              {
                currentValue: '2.0.0',
                datasource: 'nuget',
                depName: 'minver-cli',
                depType: 'nuget',
              },
            ],
          },
        );
      });

      it('with-config', async () => {
        expect(
          await extractPackageFile(
            contents,
            `with-config-file/${packageFile}`,
            config,
          ),
        ).toEqual({
          deps: [
            {
              currentValue: '2.0.0',
              datasource: 'nuget',
              depName: 'minver-cli',
              depType: 'nuget',
              registryUrls: [
                'https://api.nuget.org/v3/index.json#protocolVersion=3',
                'https://contoso.com/packages/',
              ],
            },
          ],
        });
      });

      it('wrong version', async () => {
        expect(
          await extractPackageFile(
            contents.replace('"version": 1,', '"version": 2,'),
            packageFile,
            config,
          ),
        ).toBeNull();
      });

      it('returns null for no deps', async () => {
        expect(
          await extractPackageFile('{"version": 1}', packageFile, config),
        ).toBeNull();
      });

      it('does not throw', async () => {
        expect(await extractPackageFile('{{', packageFile, config)).toBeNull();
      });
    });
  });
});
