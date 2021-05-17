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

export type ArtifactsInfo = Record<string, boolean | null>;

export type ArtifactInfoResult = [string, boolean | string | null];
