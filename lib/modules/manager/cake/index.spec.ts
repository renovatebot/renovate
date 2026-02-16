import { codeBlock } from 'common-tags';
import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './index.ts';

describe('modules/manager/cake/index', () => {
  it('extracts', () => {
    expect(extractPackageFile(Fixtures.get('build.cake'))).toMatchObject({
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

  it('extracts dotnet tools from single sdk style build file', () => {
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
    expect(extractPackageFile(content)).toMatchObject({
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
    });
  });
});
