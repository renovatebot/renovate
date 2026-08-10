// REST `/api/v3/orb/packages` API types
export interface OrbPackageVersion {
  attributes: {
    version: string;
    created_at?: string;
  };
}

export interface OrbPackage {
  attributes: {
    name: string;
    is_private?: boolean;
    home_url?: string;
  };
  references?: {
    orb_versions?: OrbPackageVersion[];
  };
}

export interface OrbPackagesResponse {
  data: OrbPackage[];
}
