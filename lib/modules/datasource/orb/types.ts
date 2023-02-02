export interface OrbRelease {
  homeUrl?: string;
  versions: {
    version: string;
    createdAt?: string;
  }[];
}

export interface OrbResponse {
  data?: {
    orb?: OrbRelease;
  };
}
