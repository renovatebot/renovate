export interface RepologyPackage {
  repo: string;
  visiblename: string;
  version: string;
  srcname?: string;
  binname?: string;
  origversion?: string;
}

export type RepologyPackageType = 'binname' | 'srcname';
