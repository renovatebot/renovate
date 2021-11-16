export interface Image {
  name: string;
  newTag: string;
  newName?: string;
  digest?: string;
}
export interface Kustomize {
  kind: string;
  resources?: string[];
  images?: Image[];
}
