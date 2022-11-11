export interface DenoAPIModuleResponse {
  name: string;
  latest_version: string;
  star_count: number;
  popularity_score: number;
  tags: DenoAPITags[];
  versions: string[];
  description: string;
}

export interface DenoAPIModuleVersionResponse {
  upload_options: DenoAPIUploadOptions;
  analysis_version: string;
  description: string;
  uploaded_at: string; // ISO date
  name: string;
  version: string;
}

export interface DenoAPIUploadOptions {
  ref: string; // commit ref / tag
  type: 'github' | unknown; // type of hosting. seen: ['github']
  repository: string; // repo of hosting e.g. denodrivers/postgres
  subdir?: string;
}

export interface DenoAPITags {
  kind: string; // e.g. popularity
  value: string; // e.g. top_5_percent
}
