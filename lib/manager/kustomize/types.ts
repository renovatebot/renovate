export interface KustomizeImage {
  name: string;
  newTag?: string;
  newName?: string;

  digest?: string;
}

export interface Kustomize {
  kind: string;
  bases: string[];
  images: KustomizeImage[];
}
