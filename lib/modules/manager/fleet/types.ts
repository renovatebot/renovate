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

export interface FleetFile {
  helm: FleetFileHelm;
}

export interface FleetFileHelm {
  chart: string;
  repo?: string;
  version: string;
  releaseName: string;
}
