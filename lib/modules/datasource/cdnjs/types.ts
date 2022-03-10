interface CdnjsAsset {
  version: string;
  files: string[];
  sri?: Record<string, string>;
}

export interface CdnjsResponse {
  homepage?: string;
  repository?: {
    type: 'git' | unknown;
    url?: string;
  };
  assets?: CdnjsAsset[];
}
