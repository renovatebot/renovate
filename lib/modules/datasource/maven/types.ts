import type { XmlDocument } from 'xmldoc';

export interface MavenDependency {
  display: string;
  group?: string;
  name?: string;
  dependencyUrl: string;
}

export interface MavenXml {
  isCacheable?: boolean;
  xml?: XmlDocument;
}

export type HttpResourceCheckResult = 'found' | 'not-found' | 'error' | Date;
