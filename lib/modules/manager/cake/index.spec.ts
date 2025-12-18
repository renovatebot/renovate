import { codeBlock } from 'common-tags';
import { extractPackageFile } from '.';
import { Fixtures } from '~test/fixtures';

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
    InstallTool("dotnet:?package=SingleTool.Install.Second&version=1.2.0")

    // Install multiple tools at once
    InstallTools(
        "dotnet:https://api.nuget.org/v3/index.json?package=MultipleTools.Install.First&version=2.0.0",
        "dotnet:https://api.nuget.org/v3/index.json?package=MultipleTools.Install.Second&version=2.1.1"
    );

    var target = Argument("target", "Default");

    Task("Default")
        .Does(() =>
    {
        Information("Hello from Cake.Sdk!");
    });

    RunTarget(target);
    `;
    expect(extractPackageFile(content)).toEqual({
      deps: [{ depName: '', currentValue: '', registryUrls: [''] }],
    });
  });
});
