export interface GlasskubePackageVersions {
  latestVersion: string;
  versions: { version: string }[];
}

export interface GlasskubePackageManifest {
  references?: { label: string; url: string }[];
}
