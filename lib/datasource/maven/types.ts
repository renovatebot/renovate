import type { XmlDocument } from 'xmldoc';

export interface MavenDependency {
  display: string;
  group?: string;
  name?: string;
  dependencyUrl: string;
}

export interface MavenXml {
  authorization?: boolean;
  xml?: XmlDocument;
}
