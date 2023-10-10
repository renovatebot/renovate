export interface OrbRelease {
  homeUrl?: string;
  isPrivate?: boolean;
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
