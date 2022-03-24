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
  kind?: string;
  bases?: string[]; // deprecated since kustomize v2.1.0
  resources?: string[];
  components?: string[];
  images?: Image[];
  helmCharts?: HelmChart[];
}
