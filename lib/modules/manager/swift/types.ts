export interface MatchResult {
  idx: number;
  len: number;
  label: string;
  substr: string;
}

export interface PackageResolvedPin {
  identity: string;
  kind: string;
  location: string;
  state: {
    revision: string;
    version: string | null;
    branch?: string | null;
  };
}

export interface PackageResolvedJson {
  pins: PackageResolvedPin[];
  version: number;
  originHash?: string;
}
