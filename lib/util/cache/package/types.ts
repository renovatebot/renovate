export interface PackageCache {
  get<T = any>(namespace: string, key: string): Promise<T | undefined>;

  set<T = any>(
    namespace: string,
    key: string,
    value: T,
    ttlMinutes?: number,
  ): Promise<void>;

  cleanup?(): Promise<void>;
}

export interface DecoratorCachedRecord {
  value: unknown;
  cachedAt: string;
}

export type PackageCacheNamespace =
  | '_test-namespace'
  | 'changelog-bitbucket-notes@v2'
  | 'changelog-bitbucket-release'
  | 'changelog-gitea-notes@v2'
  | 'changelog-gitea-release'
  | 'changelog-github-notes@v2'
  | 'changelog-github-release'
  | 'changelog-gitlab-notes@v2'
  | 'changelog-gitlab-release'
  | 'datasource-artifactory'
  | 'datasource-aws-machine-image'
  | 'datasource-aws-rds'
  | 'datasource-aws-eks-addon'
  | 'datasource-azure-bicep-resource'
  | 'datasource-azure-pipelines-tasks'
  | 'datasource-bazel'
  | 'datasource-bitbucket-tags'
  | 'datasource-bitrise'
  | 'datasource-buildpacks-registry'
  | 'datasource-cdnjs'
  | 'datasource-conan'
  | 'datasource-conda'
  | 'datasource-cpan'
  | 'datasource-crate-metadata'
  | 'datasource-crate'
  | 'datasource-deb'
  | 'datasource-deno'
  | 'datasource-docker-architecture'
  | 'datasource-docker-hub-cache'
  | 'datasource-docker-digest'
  | 'datasource-docker-hub-tags'
  | 'datasource-docker-imageconfig'
  | 'datasource-docker-labels'
  | 'datasource-docker-releases-v2'
  | 'datasource-docker-tags'
  | 'datasource-dotnet-version'
  | 'datasource-endoflife-date'
  | 'datasource-galaxy-collection'
  | 'datasource-galaxy'
  | 'datasource-git-refs'
  | 'datasource-git-tags'
  | 'datasource-git'
  | 'datasource-gitea-releases'
  | 'datasource-gitea-tags'
  | 'datasource-github-release-attachments'
  | 'datasource-gitlab-packages'
  | 'datasource-gitlab-releases'
  | 'datasource-gitlab-tags'
  | 'datasource-glasskube-packages'
  | 'datasource-go-direct'
  | 'datasource-go-proxy'
  | 'datasource-go'
  | 'datasource-golang-version'
  | 'datasource-gradle-version'
  | 'datasource-helm'
  | 'datasource-hermit'
  | 'datasource-hex'
  | 'datasource-hexpm-bob'
  | 'datasource-java-version'
  | 'datasource-jenkins-plugins'
  | 'datasource-maven'
  | 'datasource-maven:head-requests-timeout'
  | 'datasource-maven:head-requests'
  | 'datasource-maven:metadata-xml'
  | 'datasource-node-version'
  | 'datasource-npm:data'
  | 'datasource-nuget-v3'
  | 'datasource-orb'
  | 'datasource-packagist'
  | 'datasource-pod'
  | 'datasource-python-version'
  | 'datasource-releases'
  | 'datasource-repology'
  | 'datasource-ruby-version'
  | 'datasource-rubygems'
  | 'datasource-sbt-package'
  | 'datasource-terraform-module'
  | 'datasource-terraform-provider'
  | 'datasource-terraform'
  | 'datasource-unity3d'
  | 'github-releases-datasource-v2'
  | 'github-tags-datasource-v2'
  | 'merge-confidence'
  | 'preset'
  | 'terraform-provider-hash'
  | 'url-sha256';

export type CombinedKey = `global%%${PackageCacheNamespace}%%${string}`;
