export type FluxManagerData = {
  components: string;
};

export interface KubernetesResource {
  apiVersion: string;
  metadata: {
    name: string;
    // For Flux, the namespace property is optional, but matching HelmReleases to HelmRepositories would be
    // much more difficult without it (we'd have to examine the parent Kustomizations to discover the value),
    // so we require it for renovation.
    namespace: string;
  };
}

export interface HelmRelease extends KubernetesResource {
  kind: 'HelmRelease';
  spec: {
    chart: {
      spec: {
        chart: string;
        sourceRef: {
          kind: string;
          name: string;
          namespace?: string;
        };
        version?: string;
      };
    };
  };
}

export type HelmRepositoryType = 'oci' | 'default';

export interface HelmRepository extends KubernetesResource {
  kind: 'HelmRepository';
  spec: {
    url: string;
    type: HelmRepositoryType;
  };
}

export interface GitRepository extends KubernetesResource {
  kind: 'GitRepository';
  spec: {
    ref: {
      tag?: string;
      commit?: string;
    };
    url: string;
  };
}

export interface OciRepository extends KubernetesResource {
  kind: 'OCIRepository';
  spec: {
    ref: {
      digest?: string;
      tag?: string;
    };
    url: string;
  };
}

export type FluxResource =
  | HelmRelease
  | HelmRepository
  | GitRepository
  | OciRepository;

export interface FluxFile {
  file: string;
}

export interface ResourceFluxManifest extends FluxFile {
  kind: 'resource';
  resources: FluxResource[];
}

export interface SystemFluxManifest extends FluxFile {
  kind: 'system';
  version: string;
  components: string;
}

export type FluxManifest = ResourceFluxManifest | SystemFluxManifest;
