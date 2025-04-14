import { ArtifactoryDatasource } from './artifactory';
import { AwsEKSAddonDataSource } from './aws-eks-addon';
import { AwsMachineImageDatasource } from './aws-machine-image';
import { AwsRdsDatasource } from './aws-rds';
import { AzureBicepResourceDatasource } from './azure-bicep-resource';
import { AzurePipelinesTasksDatasource } from './azure-pipelines-tasks';
import { BazelDatasource } from './bazel';
import { BitbucketServerTagsDatasource } from './bitbucket-server-tags';
import { BitbucketTagsDatasource } from './bitbucket-tags';
import { BitriseDatasource } from './bitrise';
import { BuildpacksRegistryDatasource } from './buildpacks-registry';
import { CdnjsDatasource } from './cdnjs';
import { ClojureDatasource } from './clojure';
import { ConanDatasource } from './conan';
import { CondaDatasource } from './conda';
import { CpanDatasource } from './cpan';
import { CrateDatasource } from './crate';
import { CustomDatasource } from './custom';
import { DartDatasource } from './dart';
import { DartVersionDatasource } from './dart-version';
import { DebDatasource } from './deb';
import { DenoDatasource } from './deno';
import { DevboxDatasource } from './devbox';
import { DockerDatasource } from './docker';
import { DotnetVersionDatasource } from './dotnet-version';
import { EndoflifeDateDatasource } from './endoflife-date';
import { FlutterVersionDatasource } from './flutter-version';
import { GalaxyDatasource } from './galaxy';
import { GalaxyCollectionDatasource } from './galaxy-collection';
import { GitRefsDatasource } from './git-refs';
import { GitTagsDatasource } from './git-tags';
import { GiteaReleasesDatasource } from './gitea-releases';
import { GiteaTagsDatasource } from './gitea-tags';
import { GithubReleaseAttachmentsDatasource } from './github-release-attachments';
import { GithubReleasesDatasource } from './github-releases';
import { GithubRunnersDatasource } from './github-runners';
import { GithubTagsDatasource } from './github-tags';
import { GitlabPackagesDatasource } from './gitlab-packages';
import { GitlabReleasesDatasource } from './gitlab-releases';
import { GitlabTagsDatasource } from './gitlab-tags';
import { GlasskubePackagesDatasource } from './glasskube-packages';
import { GoDatasource } from './go';
import { GolangVersionDatasource } from './golang-version';
import { GradleVersionDatasource } from './gradle-version';
import { HackageDatasource } from './hackage';
import { HelmDatasource } from './helm';
import { HermitDatasource } from './hermit';
import { HexDatasource } from './hex';
import { HexpmBobDatasource } from './hexpm-bob';
import { JavaVersionDatasource } from './java-version';
import { JenkinsPluginsDatasource } from './jenkins-plugins';
import { KubernetesApiDatasource } from './kubernetes-api';
import { MavenDatasource } from './maven';
import { NodeVersionDatasource } from './node-version';
import { NpmDatasource } from './npm';
import { NugetDatasource } from './nuget';
import { OrbDatasource } from './orb';
import { PackagistDatasource } from './packagist';
import { PodDatasource } from './pod';
import { PuppetForgeDatasource } from './puppet-forge';
import { PypiDatasource } from './pypi';
import { PythonVersionDatasource } from './python-version';
import { RepologyDatasource } from './repology';
import { RubyVersionDatasource } from './ruby-version';
import { RubygemsDatasource } from './rubygems';
import { SbtPackageDatasource } from './sbt-package';
import { SbtPluginDatasource } from './sbt-plugin';
import { TerraformModuleDatasource } from './terraform-module';
import { TerraformProviderDatasource } from './terraform-provider';
import type { DatasourceApi } from './types';
import { Unity3dDatasource } from './unity3d';

const api = new Map<string, DatasourceApi>();
export default api;

api.set(ArtifactoryDatasource.id, new ArtifactoryDatasource());
api.set(AwsEKSAddonDataSource.id, new AwsEKSAddonDataSource());
api.set(AwsMachineImageDatasource.id, new AwsMachineImageDatasource());
api.set(AwsRdsDatasource.id, new AwsRdsDatasource());
api.set(AzureBicepResourceDatasource.id, new AzureBicepResourceDatasource());
api.set(AzurePipelinesTasksDatasource.id, new AzurePipelinesTasksDatasource());
api.set(BazelDatasource.id, new BazelDatasource());
api.set(BitbucketServerTagsDatasource.id, new BitbucketServerTagsDatasource());
api.set(BitbucketTagsDatasource.id, new BitbucketTagsDatasource());
api.set(BitriseDatasource.id, new BitriseDatasource());
api.set(BuildpacksRegistryDatasource.id, new BuildpacksRegistryDatasource());
api.set(CdnjsDatasource.id, new CdnjsDatasource());
api.set(ClojureDatasource.id, new ClojureDatasource());
api.set(ConanDatasource.id, new ConanDatasource());
api.set(CondaDatasource.id, new CondaDatasource());
api.set(CpanDatasource.id, new CpanDatasource());
api.set(CrateDatasource.id, new CrateDatasource());
api.set(CustomDatasource.id, new CustomDatasource());
api.set(DartDatasource.id, new DartDatasource());
api.set(DartVersionDatasource.id, new DartVersionDatasource());
api.set(DebDatasource.id, new DebDatasource());
api.set(DenoDatasource.id, new DenoDatasource());
api.set(DevboxDatasource.id, new DevboxDatasource());
api.set(DockerDatasource.id, new DockerDatasource());
api.set(DotnetVersionDatasource.id, new DotnetVersionDatasource());
api.set(EndoflifeDateDatasource.id, new EndoflifeDateDatasource());
api.set(FlutterVersionDatasource.id, new FlutterVersionDatasource());
api.set(GalaxyDatasource.id, new GalaxyDatasource());
api.set(GalaxyCollectionDatasource.id, new GalaxyCollectionDatasource());
api.set(GitRefsDatasource.id, new GitRefsDatasource());
api.set(GitTagsDatasource.id, new GitTagsDatasource());
api.set(GiteaReleasesDatasource.id, new GiteaReleasesDatasource());
api.set(GiteaTagsDatasource.id, new GiteaTagsDatasource());
api.set(
  GithubReleaseAttachmentsDatasource.id,
  new GithubReleaseAttachmentsDatasource(),
);
api.set(GithubReleasesDatasource.id, new GithubReleasesDatasource());
api.set(GithubRunnersDatasource.id, new GithubRunnersDatasource());
api.set(GithubTagsDatasource.id, new GithubTagsDatasource());
api.set(GitlabPackagesDatasource.id, new GitlabPackagesDatasource());
api.set(GitlabReleasesDatasource.id, new GitlabReleasesDatasource());
api.set(GitlabTagsDatasource.id, new GitlabTagsDatasource());
api.set(GlasskubePackagesDatasource.id, new GlasskubePackagesDatasource());
api.set(GoDatasource.id, new GoDatasource());
api.set(GolangVersionDatasource.id, new GolangVersionDatasource());
api.set(GradleVersionDatasource.id, new GradleVersionDatasource());
api.set(HackageDatasource.id, new HackageDatasource());
api.set(HelmDatasource.id, new HelmDatasource());
api.set(HermitDatasource.id, new HermitDatasource());
api.set(HexDatasource.id, new HexDatasource());
api.set(HexpmBobDatasource.id, new HexpmBobDatasource());
api.set(JavaVersionDatasource.id, new JavaVersionDatasource());
api.set(JenkinsPluginsDatasource.id, new JenkinsPluginsDatasource());
api.set(KubernetesApiDatasource.id, new KubernetesApiDatasource());
api.set(MavenDatasource.id, new MavenDatasource());
api.set(NodeVersionDatasource.id, new NodeVersionDatasource());
api.set(NpmDatasource.id, new NpmDatasource());
api.set(NugetDatasource.id, new NugetDatasource());
api.set(OrbDatasource.id, new OrbDatasource());
api.set(PackagistDatasource.id, new PackagistDatasource());
api.set(PodDatasource.id, new PodDatasource());
api.set(PuppetForgeDatasource.id, new PuppetForgeDatasource());
api.set(PypiDatasource.id, new PypiDatasource());
api.set(PythonVersionDatasource.id, new PythonVersionDatasource());
api.set(RepologyDatasource.id, new RepologyDatasource());
api.set(RubyVersionDatasource.id, new RubyVersionDatasource());
api.set(RubygemsDatasource.id, new RubygemsDatasource());
api.set(SbtPackageDatasource.id, new SbtPackageDatasource());
api.set(SbtPluginDatasource.id, new SbtPluginDatasource());
api.set(TerraformModuleDatasource.id, new TerraformModuleDatasource());
api.set(TerraformProviderDatasource.id, new TerraformProviderDatasource());
api.set(Unity3dDatasource.id, new Unity3dDatasource());
