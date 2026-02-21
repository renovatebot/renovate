import { extractPackageFile } from './index.ts';

describe('modules/manager/cake-sdk/index', () => {
  describe('extractPackageFile', () => {
    it('extracts SDK, package directives and InstallTools from build.cs', () => {
      const buildCs = `#:sdk Cake.Sdk@6.0.0

#:package Cake.Sonar@5.0.0

InstallTools(
    "dotnet:?package=GitVersion.Tool&version=6.5.1",
    "dotnet:?package=dotnet-sonarscanner&version=11.0.0"
);

var target = Argument("target", "Default");

Task("Build")
    .Does(() =>
{
    DotNetBuild("./src/Example.sln");
});

RunTarget(target);
`;
      expect(extractPackageFile(buildCs)).toMatchObject({
        deps: [
          { depName: 'Cake.Sdk', currentValue: '6.0.0' },
          { depName: 'Cake.Sonar', currentValue: '5.0.0' },
          { depName: 'GitVersion.Tool', currentValue: '6.5.1' },
          { depName: 'dotnet-sonarscanner', currentValue: '11.0.0' },
        ],
      });
    });

    it('extracts SDK and InstallTool from cake.cs', () => {
      const cakeCs = `#:sdk Cake.Sdk@5.0.0

InstallTool("nuget:?package=xunit.runner.console&version=2.4.1");
InstallTool("dotnet:https://api.nuget.org/v3/index.json?package=GitVersion.Tool&version=6.3.0");

Task("Test").Does(() => { });

RunTarget("Test");
`;
      expect(extractPackageFile(cakeCs)).toMatchObject({
        deps: [
          { depName: 'Cake.Sdk', currentValue: '5.0.0' },
          { depName: 'xunit.runner.console', currentValue: '2.4.1' },
          {
            depName: 'GitVersion.Tool',
            currentValue: '6.3.0',
            registryUrls: ['https://api.nuget.org/v3/index.json'],
          },
        ],
      });
    });

    it('extracts SDK and tool with custom registry URL', () => {
      const withRegistryCs = `#:sdk Cake.Sdk@6.0.0

InstallTool("nuget:https://example.com/feed/v3/index.json?package=My.Tool&version=1.2.3");

RunTarget("Default");
`;
      expect(extractPackageFile(withRegistryCs)).toMatchObject({
        deps: [
          { depName: 'Cake.Sdk', currentValue: '6.0.0' },
          {
            depName: 'My.Tool',
            currentValue: '1.2.3',
            registryUrls: ['https://example.com/feed/v3/index.json'],
          },
        ],
      });
    });

    it('sets skipReason for non-http tool URL (e.g. file:)', () => {
      const content = `
#:sdk Cake.Sdk@6.0.0
InstallTool("nuget:file:///tmp/feed?package=FileBased.Tool&version=1.0.0");
RunTarget("Default");
`;
      const res = extractPackageFile(content);
      expect(res).not.toBeNull();
      expect(res!.deps).toMatchObject([
        { depName: 'Cake.Sdk', currentValue: '6.0.0' },
        {
          depName: 'FileBased.Tool',
          currentValue: '1.0.0',
          skipReason: 'unsupported-url',
        },
      ]);
    });

    it('ignores tool spec when URL parsing fails', () => {
      const content = `
#:sdk Cake.Sdk@6.0.0
InstallTool("dotnet:not a valid url");
RunTarget("Default");
`;
      const res = extractPackageFile(content);
      expect(res).not.toBeNull();
      expect(res!.deps).toHaveLength(1);
      expect(res!.deps).toMatchObject([
        { depName: 'Cake.Sdk', currentValue: '6.0.0' },
      ]);
    });
  });
});
