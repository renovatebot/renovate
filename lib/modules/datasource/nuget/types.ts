export interface ServicesIndexRaw {
  resources: {
    '@id': string;
    '@type': string;
  }[];
}

// See https://learn.microsoft.com/en-us/nuget/api/registration-base-url-resource#catalog-entry
export interface CatalogEntry {
  version: string;
  published?: string;
  projectUrl?: string;
  listed?: boolean;
  packageContent?: string;
  deprecation?: Deprecation;
}

export interface Deprecation {
  reasons: string[];
}

export interface CatalogPage {
  '@id': string;
  items: {
    catalogEntry: CatalogEntry;
  }[];
}

export interface PackageRegistration {
  items: CatalogPage[];
}

export interface ParsedRegistryUrl {
  feedUrl: string;
  protocolVersion: number | null;
}
