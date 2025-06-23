/* For values of unknown type that are not used with renovate,
   any object is accepted in the types defined here
*/

// This can be improved with the documentation at
// https://docs.conda.io/projects/conda/en/latest/user-guide/concepts/pkg-specs.html#supported-version-strings
export type CondaVersion = string;

export interface CondaPackage {
  app_entry: Record<string, unknown>;
  conda_platforms: string[];
  full_name: string;
  owner: CondaPackageOwner;
  home: string;
  source_git_url: string;
  source_git_tag: string;
  app_type: Record<string, unknown>;
  upvoted: number;
  id: string;
  app_summary: Record<string, unknown>;
  public: boolean;
  revision: number;
  files: CondaFile[];
  package_types: string[];
  description: string;
  releases: CondaRelease[];
  html_url: string;
  builds: string[];
  watchers: number;
  dev_url: string;
  name: string;
  license: string;
  versions: CondaVersion[];
  url: string;
  created_at: string;
  modified_at: string;
  latest_version: CondaVersion;
  summary: string;
  license_url: string;
  doc_url: string;
}

export interface CondaPackageOwner {
  description: string;
  url: string;
  company: string;
  user_type: string;
  location: string;
  login: string;
  created_at: string;
  name: string;
}

export interface CondaRelease {
  version: CondaVersion;
  distributions: string[];
  full_name: string;
}

export interface CondaFile {
  description: string;
  basename: string;
  labels: string[];
  dependencies: string[];
  distribution_type: string;
  full_name: string;
  owner: string;
  size: number;
  upload_time: string;
  ndownloads: number;
  download_url: string;
  version: CondaVersion;
  md5: string;
  type: string;
  attrs: {
    build_number: number;
    name: string;
    license: string;
    timestamp: number;
    source_url: string;
    platform: string;
    depends: string[];
    version: CondaVersion;
    subdir: string;
    build: string;
    sha256: string;
    arch: string;
    md5: string;
    size: number;
  };
}
