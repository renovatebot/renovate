/**
  Represent a GitRepo Kubernetes manifest of Fleet.
  @link https://fleet.rancher.io/gitrepo-add/#create-gitrepo-instance
 */
export interface GitRepo {
  metadata: {
    name: string;
  };
  kind: string;
  spec: {
    repo: string;
    revision?: string;
  };
}

/**
 Represent a Bundle configuration of Fleet, which is located in `fleet.yaml` files.
 @link https://fleet.rancher.io/gitrepo-structure/#fleetyaml
 */
export interface FleetFile {
  helm: FleetFileHelm;
  targetCustomizations?: {
    name: string;
    helm: FleetHelmBlock;
  }[];
}

export interface FleetHelmBlock {
  chart: string;
  repo?: string;
  version?: string;
}

export interface FleetFileHelm extends FleetHelmBlock {
  releaseName: string;
}
