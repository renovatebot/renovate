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

export interface HelmRepository extends KubernetesResource {
  kind: 'HelmRepository';
  spec: {
    url: string;
  };
}

export type FluxResource = HelmRelease | HelmRepository;

export interface FluxFile {
  file: string;
}

export interface ResourceFluxManifest extends FluxFile {
  kind: 'resource';
  releases: HelmRelease[];
  repositories: HelmRepository[];
}

export interface SystemFluxManifest extends FluxFile {
  kind: 'system';
  version: string;
}

export type FluxManifest = ResourceFluxManifest | SystemFluxManifest;
