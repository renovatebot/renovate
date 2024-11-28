import type { XmlDocument } from 'xmldoc';
import type { Release, ReleaseResult } from '../types';

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

export type DependencyInfo = Pick<
  ReleaseResult,
  'homepage' | 'sourceUrl' | 'packageScope'
>;
