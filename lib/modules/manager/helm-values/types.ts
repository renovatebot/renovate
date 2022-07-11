export interface HelmDockerImageDependencyBasic {
  registry?: string;
  repository: string;
}

export interface HelmDockerImageDependencyTag
  extends HelmDockerImageDependencyBasic {
  tag: string;
  version?: never;
}

export interface HelmDockerImageDependencyVersion
  extends HelmDockerImageDependencyBasic {
  version: string;
  tag?: never;
}

export type HelmDockerImageDependency =
  | HelmDockerImageDependencyTag
  | HelmDockerImageDependencyVersion;
