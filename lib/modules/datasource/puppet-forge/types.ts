export interface PuppetModule {
  uri: string;
  slug: string;
  name: string;
  deprecated_at: string | null;
  owner: PuppetModuleOwner;
  downloads: number;
  created_at: string;
  updated_at: string;
  deprecated_for: string | null;
  superseded_by: PuppetSupercededBy | null;
  endorsement: PuppetEndorsement | null;
  module_group: PuppetModuleGroup;
  premium: boolean;
  current_release: PuppetRelease;
  releases: PuppetReleaseAbbreviated[];
  homepage_url: string;
  issues_url: string;
}

export type PuppetModuleAbbreviated = Pick<
  PuppetModule,
  'uri' | 'slug' | 'name' | 'deprecated_at' | 'owner'
>;

export interface PuppetRelease {
  uri: string;
  slug: string;
  module: PuppetModuleAbbreviated;
  version: string;
  metadata: Record<string, any>;
  tags: string[];
  pdk: boolean;
  file_uri: string;
  file_size: number;
  file_md5: string;
  file_sha256: string;
  downloads: number;
  readme: string;
  changelog: string;
  license: string;
  reference: string;
  pe_compatibility: string[] | null | undefined;
  tasks: PuppetBoltTask[];
  plans: PuppetBoltPlan[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_for: string | null;
}

export type PuppetReleaseAbbreviated = Pick<
  PuppetRelease,
  | 'uri'
  | 'slug'
  | 'version'
  | 'created_at'
  | 'deleted_at'
  | 'file_uri'
  | 'file_size'
>;

export interface PuppetBoltPlan {
  uri: string;
  name: string;
  private: boolean;
}

export interface PuppetBoltTask {
  name: string;
  executables: string[];
  description: string;
  metadata: Record<string, any>;
}

export interface PuppetSupercededBy {
  uri: string;
  slug: string;
}

export interface PuppetModuleOwner {
  uri: string;
  slug: string;
  username: string;
  gravatar_id: string;
}

export type PuppetEndorsement = 'supported' | 'approved' | 'partner';
export type PuppetModuleGroup = 'base' | 'pe_only';
