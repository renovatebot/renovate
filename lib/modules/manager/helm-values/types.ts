interface HelmDockerImageDependencyBasic {
  registry?: string;
  repository: string;
}
interface HelmDockerImageDependencyTag {
  tag: string;
  version?: never;
}
interface HelmDockerImageDependencyVersion {
  version: string;
  tag?: never;
}
export type HelmDockerImageDependency = HelmDockerImageDependencyBasic & (HelmDockerImageDependencyTag | HelmDockerImageDependencyVersion);
