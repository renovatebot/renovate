export interface RegistryFile {
  key: string;
  sha256: string;
}

export interface PackagistFile {
  providers: Record<string, RegistryFile>;
  packages?: Record<string, RegistryFile>;
}
