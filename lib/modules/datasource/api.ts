import { AdoptiumJavaDatasource } from './adoptium-java';
import { ArtifactoryDatasource } from './artifactory';
import { AwsMachineImageDataSource } from './aws-machine-image';
import { BitBucketTagsDatasource } from './bitbucket-tags';
import { CdnJsDatasource } from './cdnjs';
import { ClojureDatasource } from './clojure';
import { ConanDatasource } from './conan';
import { CondaDatasource } from './conda';
import { CrateDatasource } from './crate';
import { DartDatasource } from './dart';
import { DockerDatasource } from './docker';
import { ForgeDatasource } from './forge';
import { GalaxyDatasource } from './galaxy';
import { GalaxyCollectionDatasource } from './galaxy-collection';
import { GitRefsDatasource } from './git-refs';
import { GitTagsDatasource } from './git-tags';
import { GithubReleasesDatasource } from './github-releases';
import { GithubTagsDatasource } from './github-tags';
import { GitlabPackagesDatasource } from './gitlab-packages';
import { GitlabReleasesDatasource } from './gitlab-releases';
import { GitlabTagsDatasource } from './gitlab-tags';
import { GoDatasource } from './go';
import { GolangVersionDatasource } from './golang-version';
import { GradleVersionDatasource } from './gradle-version';
import { HelmDatasource } from './helm';
import { HexDatasource } from './hex';
import { JenkinsPluginsDatasource } from './jenkins-plugins';
import { MavenDatasource } from './maven';
import { NodeDatasource } from './node';
import { NpmDatasource } from './npm';
import { NugetDatasource } from './nuget';
import { OrbDatasource } from './orb';
import { PackagistDatasource } from './packagist';
import { PodDatasource } from './pod';
import { PypiDatasource } from './pypi';
import { RepologyDatasource } from './repology';
import { RubyVersionDatasource } from './ruby-version';
import { RubyGemsDatasource } from './rubygems';
import { SbtPackageDatasource } from './sbt-package';
import { SbtPluginDatasource } from './sbt-plugin';
import { TerraformModuleDatasource } from './terraform-module';
import { TerraformProviderDatasource } from './terraform-provider';
import type { DatasourceApi } from './types';

const api = new Map<string, DatasourceApi>();
export default api;

api.set(AdoptiumJavaDatasource.id, new AdoptiumJavaDatasource());
api.set(ArtifactoryDatasource.id, new ArtifactoryDatasource());
api.set(AwsMachineImageDataSource.id, new AwsMachineImageDataSource());
api.set(BitBucketTagsDatasource.id, new BitBucketTagsDatasource());
api.set(CdnJsDatasource.id, new CdnJsDatasource());
api.set(ClojureDatasource.id, new ClojureDatasource());
api.set(ConanDatasource.id, new ConanDatasource());
api.set(CondaDatasource.id, new CondaDatasource());
api.set(CrateDatasource.id, new CrateDatasource());
api.set(DartDatasource.id, new DartDatasource());
api.set(DockerDatasource.id, new DockerDatasource());
api.set(GalaxyDatasource.id, new GalaxyDatasource());
api.set(GalaxyCollectionDatasource.id, new GalaxyCollectionDatasource());
api.set(GitRefsDatasource.id, new GitRefsDatasource());
api.set(GitTagsDatasource.id, new GitTagsDatasource());
api.set(GithubReleasesDatasource.id, new GithubReleasesDatasource());
api.set(GithubTagsDatasource.id, new GithubTagsDatasource());
api.set(GitlabPackagesDatasource.id, new GitlabPackagesDatasource());
api.set(GitlabReleasesDatasource.id, new GitlabReleasesDatasource());
api.set(GitlabTagsDatasource.id, new GitlabTagsDatasource());
api.set(GoDatasource.id, new GoDatasource());
api.set(GolangVersionDatasource.id, new GolangVersionDatasource());
api.set(GradleVersionDatasource.id, new GradleVersionDatasource());
api.set(HelmDatasource.id, new HelmDatasource());
api.set(HexDatasource.id, new HexDatasource());
api.set(JenkinsPluginsDatasource.id, new JenkinsPluginsDatasource());
api.set(MavenDatasource.id, new MavenDatasource());
api.set(NodeDatasource.id, new NodeDatasource());
api.set(NpmDatasource.id, new NpmDatasource());
api.set(NugetDatasource.id, new NugetDatasource());
api.set(OrbDatasource.id, new OrbDatasource());
api.set(PackagistDatasource.id, new PackagistDatasource());
api.set(PodDatasource.id, new PodDatasource());
api.set(ForgeDatasource.id, new ForgeDatasource());
api.set(PypiDatasource.id, new PypiDatasource());
api.set(RepologyDatasource.id, new RepologyDatasource());
api.set(RubyVersionDatasource.id, new RubyVersionDatasource());
api.set(RubyGemsDatasource.id, new RubyGemsDatasource());
api.set(SbtPackageDatasource.id, new SbtPackageDatasource());
api.set(SbtPluginDatasource.id, new SbtPluginDatasource());
api.set(TerraformModuleDatasource.id, new TerraformModuleDatasource());
api.set(TerraformProviderDatasource.id, new TerraformProviderDatasource());
