interface CdnjsAsset {
  version: string;
  files: string[];
  sri: Record<string, string>;
}

export interface CdnjsResponse {
  homepage?: string;
  repository?: {
    url?: string;
  };
  assets: CdnjsAsset[];
}
