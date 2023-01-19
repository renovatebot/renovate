import type { ReleaseResult } from '../types';

export interface RegistryFile {
  key: string;
  sha256: string;
}
export interface RegistryMeta {
  files?: RegistryFile[];
  providerPackages: Record<string, string>;
  providersUrl?: string;
  providersLazyUrl?: string;
  includesFiles?: RegistryFile[];
  packages: Record<string, RegistryFile>;
}

export interface PackagistFile {
  providers: Record<string, RegistryFile>;
  packages?: Record<string, RegistryFile>;
}

export interface AllPackages {
  providersUrl: string | null;
  providersLazyUrl: string | null;
  providerPackages: Record<string, string | null>;

  includesPackages: Record<string, ReleaseResult>;
}
