export interface ServicesIndexRaw {
  resources: {
    '@id': string;
    '@type': string;
  }[];
}

export interface CatalogEntry {
  version: string;
  published?: string;
  projectUrl?: string;
  listed?: boolean;
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
