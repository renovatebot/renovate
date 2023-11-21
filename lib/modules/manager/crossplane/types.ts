export interface KubernetesResource {
  apiVersion: string;
}

export interface PackageSpec {
  package: string;
}

export interface XPFunction extends KubernetesResource {
  kind: 'Function';
  spec: PackageSpec;
}

export interface XPConfiguration extends KubernetesResource {
  kind: 'Configuration';
  spec: PackageSpec;
}

export interface XPProvider extends KubernetesResource {
  kind: 'Provider';
  spec: PackageSpec;
}

export type PackageDefinition = XPConfiguration | XPFunction | XPProvider;
