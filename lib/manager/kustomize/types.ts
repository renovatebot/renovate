export interface Image {
  name: string;
  newTag: string;
  newName?: string;
  digest?: string;
}

export interface HelmChart {
  name: string;
  repo: string;
  version: string;
}

export interface Kustomize {
  kind: string;
  bases: string[];
  images: Image[];
  helmCharts?: HelmChart[];
}
