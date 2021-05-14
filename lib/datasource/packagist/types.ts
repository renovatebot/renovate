import type { ReleaseResult } from '../types';

export interface PackageMeta {
  includes?: Record<string, { sha256: string }>;
  packages: Record<string, RegistryFile>;
  'provider-includes': Record<string, { sha256: string }>;
  providers: Record<string, { sha256: string }>;
  'providers-url'?: string;
}
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
  packages?: Record<string, RegistryFile>;
}

export interface PackagistFile {
  providers: Record<string, RegistryFile>;
  packages?: Record<string, RegistryFile>;
}

export interface AllPackages {
  packages: Record<string, RegistryFile>;
  providersUrl: string;
  providersLazyUrl: string;
  providerPackages: Record<string, string>;

  includesPackages: Record<string, ReleaseResult>;
}
