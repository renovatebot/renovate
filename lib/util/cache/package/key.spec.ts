import {
  classNameToCacheNamespace,
  getCombinedKey,
  splitIdentifier,
} from './key';

describe('util/cache/package/key', () => {
  describe('getCombinedKey', () => {
    it('works', () => {
      expect(getCombinedKey('_test-namespace', 'foo:bar')).toBe(
        'global%%_test-namespace%%foo:bar',
      );
    });
  });

  describe('splitIdentifierName', () => {
    test.each`
      identifier     | components
      ${''}          | ${[]}
      ${'Foo'}       | ${['Foo']}
      ${'FooBar'}    | ${['Foo', 'Bar']}
      ${'FooBarBaz'} | ${['Foo', 'Bar', 'Baz']}
      ${'FooBAR'}    | ${['Foo', 'BAR']}
      ${'FooBARBaz'} | ${['Foo', 'BAR', 'Baz']}
      ${'foo'}       | ${['foo']}
      ${'fooBar'}    | ${['foo', 'Bar']}
      ${'fooBarBaz'} | ${['foo', 'Bar', 'Baz']}
      ${'fooBAR'}    | ${['foo', 'BAR']}
      ${'fooBARBaz'} | ${['foo', 'BAR', 'Baz']}
    `('$identifier -> $components', ({ identifier, components }) => {
      expect(splitIdentifier(identifier)).toEqual(components);
    });
  });

  describe('classNameToCacheNamespace', () => {
    test.each`
      className                               | namespace
      ${'ArtifactoryDatasource'}              | ${'datasource-artifactory'}
      ${'AwsMachineImageDatasource'}          | ${'datasource-aws-machine-image'}
      ${'AwsRdsDatasource'}                   | ${'datasource-aws-rds'}
      ${'AzureBicepResourceDatasource'}       | ${'datasource-azure-bicep-resource'}
      ${'AzurePipelinesTasksDatasource'}      | ${'datasource-azure-pipelines-tasks'}
      ${'BazelDatasource'}                    | ${'datasource-bazel'}
      ${'BitbucketTagsDatasource'}            | ${'datasource-bitbucket-tags'}
      ${'BitriseDatasource'}                  | ${'datasource-bitrise'}
      ${'CdnjsDatasource'}                    | ${'datasource-cdnjs'}
      ${'ConanDatasource'}                    | ${'datasource-conan'}
      ${'CondaDatasource'}                    | ${'datasource-conda'}
      ${'CpanDatasource'}                     | ${'datasource-cpan'}
      ${'CrateDatasource'}                    | ${'datasource-crate'}
      ${'DenoDatasource'}                     | ${'datasource-deno'}
      ${'DockerDatasource'}                   | ${'datasource-docker'}
      ${'DotnetVersionDatasource'}            | ${'datasource-dotnet-version'}
      ${'EndoflifeDateDatasource'}            | ${'datasource-endoflife-date'}
      ${'GalaxyDatasource'}                   | ${'datasource-galaxy'}
      ${'GalaxyCollectionDatasource'}         | ${'datasource-galaxy-collection'}
      ${'GitRefsDatasource'}                  | ${'datasource-git-refs'}
      ${'GitTagsDatasource'}                  | ${'datasource-git-tags'}
      ${'GiteaReleasesDatasource'}            | ${'datasource-gitea-releases'}
      ${'GiteaTagsDatasource'}                | ${'datasource-gitea-tags'}
      ${'GithubReleaseAttachmentsDatasource'} | ${'datasource-github-release-attachments'}
      ${'GitlabPackagesDatasource'}           | ${'datasource-gitlab-packages'}
      ${'GitlabReleasesDatasource'}           | ${'datasource-gitlab-releases'}
      ${'GitlabTagsDatasource'}               | ${'datasource-gitlab-tags'}
      ${'GlasskubePackagesDatasource'}        | ${'datasource-glasskube-packages'}
      ${'GoDatasource'}                       | ${'datasource-go'}
      ${'GoDirectDatasource'}                 | ${'datasource-go-direct'}
      ${'GoProxyDatasource'}                  | ${'datasource-go-proxy'}
      ${'GolangVersionDatasource'}            | ${'datasource-golang-version'}
      ${'GradleVersionDatasource'}            | ${'datasource-gradle-version'}
      ${'HelmDatasource'}                     | ${'datasource-helm'}
      ${'HermitDatasource'}                   | ${'datasource-hermit'}
      ${'HexDatasource'}                      | ${'datasource-hex'}
      ${'HexpmBobDatasource'}                 | ${'datasource-hexpm-bob'}
      ${'JavaVersionDatasource'}              | ${'datasource-java-version'}
      ${'JenkinsPluginsDatasource'}           | ${'datasource-jenkins-plugins'}
      ${'NodeVersionDatasource'}              | ${'datasource-node-version'}
      ${'NugetV3Api'}                         | ${'nuget-v3-api'}
      ${'OrbDatasource'}                      | ${'datasource-orb'}
      ${'PackagistDatasource'}                | ${'datasource-packagist'}
      ${'PodDatasource'}                      | ${'datasource-pod'}
      ${'PythonVersionDatasource'}            | ${'datasource-python-version'}
      ${'RepologyDatasource'}                 | ${'datasource-repology'}
      ${'RubyVersionDatasource'}              | ${'datasource-ruby-version'}
      ${'RubygemsDatasource'}                 | ${'datasource-rubygems'}
      ${'TerraformDatasource'}                | ${'datasource-terraform'}
      ${'TerraformModuleDatasource'}          | ${'datasource-terraform-module'}
      ${'TerraformProviderDatasource'}        | ${'datasource-terraform-provider'}
      ${'TerraformProviderHash'}              | ${'terraform-provider-hash'}
      ${'Unity3dDatasource'}                  | ${'datasource-unity3d'}
      ${'GitDatasource'}                      | ${'datasource-git'}
    `('$className -> $namespace', ({ className, namespace }) => {
      expect(classNameToCacheNamespace(className)).toBe(namespace);
    });
  });
});
