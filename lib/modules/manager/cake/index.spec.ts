import { codeBlock } from 'common-tags';
import upath from 'upath';
import { Fixtures } from '~test/fixtures.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import * as nugetExtractUtil from '../nuget/util.ts';
import type { ExtractConfig } from '../types.ts';
import { extractPackageFile } from './index.ts';

const config: ExtractConfig = {};
const adminConfig: RepoGlobalConfig = {
  localDir: upath.resolve('lib/modules/manager/cake/__fixtures__'),
};

describe('modules/manager/cake/index', () => {
  beforeEach(() => {
    // Initialize GlobalConfig with required values
    GlobalConfig.set(adminConfig);
  });

  it('extracts', async () => {
    expect(
      await extractPackageFile(
        Fixtures.get('build.cake'),
        'build.cake',
        config,
      ),
    ).toMatchObject({
      deps: [
        { depName: 'Foo.Foo', currentValue: undefined },
        { depName: 'Bim.Bim', currentValue: '6.6.6' },
        { depName: 'Bar.Bar', registryUrls: ['https://example.com/'] },
        { depName: 'Cake.Git', registryUrls: ['https://example.com/feed/v3/'] },
        {
          depName: 'Cake.MinVer',
          registryUrls: ['https://example.com/feed/v3/index.json'],
        },
        { depName: 'Baz.Baz', skipReason: 'unsupported-url' },
        { depName: 'Cake.7zip', currentValue: '1.0.3' },
        { depName: 'Cake.asciidoctorj', currentValue: '1.0.0' },
      ],
    });
  });

  it('extracts dotnet tools from single sdk style build file', async () => {
    const content = codeBlock`
    #:sdk Cake.Sdk

    // Install single tool
    InstallTool("dotnet:https://api.nuget.org/v3/index.json?package=SingleTool.Install.First&version=1.0.0");
    InstallTool("dotnet:?package=SingleTool.Install.Second&version=1.2.0");

    // Install multiple tools at once
    InstallTools(
        "dotnet:https://api.nuget.org/v3/index.json?package=MultipleTools.Install.First&version=2.0.0",
        "dotnet:?package=MultipleTools.Install.Second&version=2.1.1"
    );

    var target = Argument("target", "Default");

    Task("Default")
        .Does(() =>
    {
        Information("Hello from Cake.Sdk!");
    });

    var installTools = "dotnet:?Should.Not.Match&version=1.0.0";

    RunTarget(target);
    `;
    expect(await extractPackageFile(content, 'build.cs', config)).toMatchObject(
      {
        deps: [
          {
            depName: 'SingleTool.Install.First',
            currentValue: '1.0.0',
            datasource: 'nuget',
            registryUrls: ['https://api.nuget.org/v3/index.json'],
          },
          {
            depName: 'SingleTool.Install.Second',
            currentValue: '1.2.0',
            datasource: 'nuget',
          },
          {
            depName: 'MultipleTools.Install.First',
            currentValue: '2.0.0',
            datasource: 'nuget',
            registryUrls: ['https://api.nuget.org/v3/index.json'],
          },
          {
            depName: 'MultipleTools.Install.Second',
            currentValue: '2.1.1',
            datasource: 'nuget',
          },
        ],
      },
    );
  });

  it('skips invalid entries in InstallTools', async () => {
    const content = codeBlock`
    #:sdk Cake.Sdk

    // One invalid and one valid tool entry
    InstallTools(
      "dotnet:bad uri",
      "dotnet:?package=Good.Tool&version=1.2.3"
    );
    `;
    expect(await extractPackageFile(content, 'build.cs', config)).toMatchObject(
      {
        deps: [
          {
            depName: 'Good.Tool',
            currentValue: '1.2.3',
            datasource: 'nuget',
          },
        ],
      },
    );
  });

  it('calls applyRegistries to honor nuget.config files if present for .cake files', async () => {
    const applyRegistriesSpy = vi
      .spyOn(nugetExtractUtil, 'applyRegistries')
      .mockImplementation((deps: any) => deps);

    const content = codeBlock`#addin nuget:?package=Contoso.SomePackage&version=1.2.3`;
    await extractPackageFile(content, 'build.cake', config);

    expect(applyRegistriesSpy).toHaveBeenCalled();
  });

  it('calls applyRegistries to honor nuget.config files if present for InstallTools', async () => {
    const applyRegistriesSpy = vi
      .spyOn(nugetExtractUtil, 'applyRegistries')
      .mockImplementation((deps: any) => deps);

    const content = codeBlock`
      #:sdk Cake.Sdk

      InstallTools("dotnet:?package=Good.Tool&version=1.2.3");
      `;
    await extractPackageFile(content, 'build.cs', config);

    expect(applyRegistriesSpy).toHaveBeenCalled();
  });
});
